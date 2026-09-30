import unittest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.client.client_model import Client
from app.user.user_model import User
from app.client.client_repository import (
    count_users_in_client,
    count_active_users_in_client,
    get_all_clients_with_user_counts,
    get_client_admins_by_client_ids,
)
from app.client.client_service import (
    get_all_clients_with_stats,
    get_client_by_id_with_stats,
)
from app.client.client_controller import _format_client_response, create_client_controller
from app.client.client_schema import ClientCreateRequest, ClientAdminCreate, ClientResponse


class TestClientStats(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()

    def tearDown(self):
        self.db.rollback()
        # Clean up tables between tests
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()
        self.db.close()

    def test_repository_all_users_active(self):
        client = Client(name="ActiveCorp", company_code="ACT", max_users=10, is_active=True)
        self.db.add(client)
        self.db.flush()

        for i in range(5):
            u = User(
                client_id=client.id,
                username=f"user_act_{i}",
                email=f"act_{i}@test.com",
                password_hash="fakehash",
                role="user",
                is_active=True,
            )
            self.db.add(u)
        self.db.commit()

        total = count_users_in_client(self.db, client.id)
        active = count_active_users_in_client(self.db, client.id)

        self.assertEqual(total, 5)
        self.assertEqual(active, 5)

    def test_repository_some_users_inactive(self):
        client = Client(name="MixedCorp", company_code="MIX", max_users=10, is_active=True)
        self.db.add(client)
        self.db.flush()

        # 3 active, 2 inactive
        for i in range(3):
            u = User(
                client_id=client.id,
                username=f"user_mix_act_{i}",
                email=f"mix_act_{i}@test.com",
                password_hash="fakehash",
                role="user",
                is_active=True,
            )
            self.db.add(u)

        for i in range(2):
            u = User(
                client_id=client.id,
                username=f"user_mix_inact_{i}",
                email=f"mix_inact_{i}@test.com",
                password_hash="fakehash",
                role="user",
                is_active=False,
            )
            self.db.add(u)
        self.db.commit()

        total = count_users_in_client(self.db, client.id)
        active = count_active_users_in_client(self.db, client.id)

        self.assertEqual(total, 5)
        self.assertEqual(active, 3)

    def test_repository_no_active_users(self):
        client = Client(name="InactiveCorp", company_code="INA", max_users=10, is_active=True)
        self.db.add(client)
        self.db.flush()

        for i in range(4):
            u = User(
                client_id=client.id,
                username=f"user_inact_{i}",
                email=f"inact_{i}@test.com",
                password_hash="fakehash",
                role="user",
                is_active=False,
            )
            self.db.add(u)
        self.db.commit()

        total = count_users_in_client(self.db, client.id)
        active = count_active_users_in_client(self.db, client.id)

        self.assertEqual(total, 4)
        self.assertEqual(active, 0)

    def test_service_and_controller_stats(self):
        client = Client(name="ServiceCorp", company_code="SRV", max_users=10, is_active=True)
        self.db.add(client)
        self.db.flush()

        # Add 1 admin (active)
        admin = User(
            client_id=client.id,
            username="admin_srv",
            email="admin@srv.com",
            password_hash="fakehash",
            role="client_admin",
            is_active=True,
        )
        # Add 2 active users, 2 inactive users
        self.db.add(admin)
        for i in range(2):
            self.db.add(
                User(
                    client_id=client.id,
                    username=f"srv_act_{i}",
                    email=f"srv_act_{i}@test.com",
                    password_hash="fakehash",
                    role="user",
                    is_active=True,
                )
            )
        for i in range(2):
            self.db.add(
                User(
                    client_id=client.id,
                    username=f"srv_inact_{i}",
                    email=f"srv_inact_{i}@test.com",
                    password_hash="fakehash",
                    role="user",
                    is_active=False,
                )
            )
        self.db.commit()

        # Test service: get_client_by_id_with_stats
        stats = get_client_by_id_with_stats(self.db, client.id)
        self.assertEqual(stats["current_users_count"], 5)
        self.assertEqual(stats["active_users"], 3)

        # Test controller formatting
        resp = _format_client_response(stats)
        self.assertEqual(resp.current_users_count, 5)
        self.assertEqual(resp.active_users, 3)

        # Test service: get_all_clients_with_stats
        all_stats = get_all_clients_with_stats(self.db)
        self.assertEqual(len(all_stats), 1)
        self.assertEqual(all_stats[0]["current_users_count"], 5)
        self.assertEqual(all_stats[0]["active_users"], 3)

    def test_batch_query_count_and_correctness(self):
        """
        Verify that get_all_clients_with_stats executes exactly 2 queries
        for multiple clients with varying user counts and admins, completely
        eliminating the N+1 query problem.
        """
        # Client A: 5 total users (3 active, 2 inactive) + 1 admin
        client_a = Client(name="Client A", company_code="CLA", max_users=20, is_active=True)
        # Client B: 2 total users (2 active) + 1 admin
        client_b = Client(name="Client B", company_code="CLB", max_users=10, is_active=True)
        # Client C: 0 users, no admin
        client_c = Client(name="Client C", company_code="CLC", max_users=10, is_active=True)

        self.db.add_all([client_a, client_b, client_c])
        self.db.flush()

        # Users for Client A: 1 active admin, 2 active users, 2 inactive users
        now = datetime.now(timezone.utc)
        admin_a = User(
            client_id=client_a.id,
            username="admin_a",
            email="admin_a@example.com",
            password_hash="fakehash",
            role="client_admin",
            is_active=True,
            created_at=now - timedelta(days=2),
        )
        self.db.add(admin_a)
        for i in range(2):
            self.db.add(
                User(
                    client_id=client_a.id,
                    username=f"user_a_act_{i}",
                    email=f"user_a_act_{i}@example.com",
                    password_hash="fakehash",
                    role="user",
                    is_active=True,
                )
            )
        for i in range(2):
            self.db.add(
                User(
                    client_id=client_a.id,
                    username=f"user_a_inact_{i}",
                    email=f"user_a_inact_{i}@example.com",
                    password_hash="fakehash",
                    role="user",
                    is_active=False,
                )
            )

        # Users for Client B: 1 active admin, 1 active user
        admin_b = User(
            client_id=client_b.id,
            username="admin_b",
            email="admin_b@example.com",
            password_hash="fakehash",
            role="client_admin",
            is_active=True,
            created_at=now - timedelta(days=1),
        )
        self.db.add(admin_b)
        self.db.add(
            User(
                client_id=client_b.id,
                username="user_b_act_0",
                email="user_b_act_0@example.com",
                password_hash="fakehash",
                role="user",
                is_active=True,
            )
        )

        self.db.commit()

        # Measure executed queries
        executed_queries = []

        def query_listener(conn, cursor, statement, parameters, context, executemany):
            executed_queries.append(statement)

        event.listen(self.engine, "before_cursor_execute", query_listener)

        try:
            results = get_all_clients_with_stats(self.db)

            # Query count MUST be exactly 2:
            # Query 1: batch client + user counts
            # Query 2: batch client admins
            self.assertEqual(
                len(executed_queries),
                2,
                f"Expected exactly 2 queries, but got {len(executed_queries)}:\n"
                + "\n---\n".join(executed_queries),
            )

            # Validate results
            self.assertEqual(len(results), 3)

            results_by_code = {r["client"].company_code: r for r in results}

            # Check Client A stats
            res_a = results_by_code["CLA"]
            self.assertEqual(res_a["current_users_count"], 5)
            self.assertEqual(res_a["active_users"], 3)
            self.assertEqual(res_a["admin_email"], "admin_a@example.com")
            self.assertEqual(res_a["admin_username"], "admin_a")

            # Check Client B stats
            res_b = results_by_code["CLB"]
            self.assertEqual(res_b["current_users_count"], 2)
            self.assertEqual(res_b["active_users"], 2)
            self.assertEqual(res_b["admin_email"], "admin_b@example.com")
            self.assertEqual(res_b["admin_username"], "admin_b")

            # Check Client C stats (0 users, no admin)
            res_c = results_by_code["CLC"]
            self.assertEqual(res_c["current_users_count"], 0)
            self.assertEqual(res_c["active_users"], 0)
            self.assertIsNone(res_c["admin_email"])
            self.assertIsNone(res_c["admin_username"])

            # Verify formatting into ClientResponse schema
            for item in results:
                formatted = _format_client_response(item)
                self.assertIsInstance(formatted, ClientResponse)
                self.assertIsNotNone(formatted.id)
                self.assertIsNotNone(formatted.name)
                self.assertIsNotNone(formatted.company_code)
                self.assertIsNotNone(formatted.max_users)
                self.assertIsNotNone(formatted.is_active)
                self.assertIsNotNone(formatted.created_at)
                self.assertIsNotNone(formatted.updated_at)

        finally:
            event.remove(self.engine, "before_cursor_execute", query_listener)

    def test_admin_selection_picks_earliest_created(self):
        """
        Verify that when a client has multiple users with client_admin role,
        the earliest created admin is consistently selected.
        """
        client = Client(name="MultiAdminCorp", company_code="MAC", max_users=10, is_active=True)
        self.db.add(client)
        self.db.flush()

        base_time = datetime.now(timezone.utc)
        first_admin = User(
            client_id=client.id,
            username="first_admin",
            email="first@example.com",
            password_hash="fakehash",
            role="client_admin",
            is_active=True,
            created_at=base_time - timedelta(days=5),
        )
        second_admin = User(
            client_id=client.id,
            username="second_admin",
            email="second@example.com",
            password_hash="fakehash",
            role="client_admin",
            is_active=True,
            created_at=base_time - timedelta(days=1),
        )
        self.db.add_all([first_admin, second_admin])
        self.db.commit()

        results = get_all_clients_with_stats(self.db)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["admin_username"], "first_admin")
        self.assertEqual(results[0]["admin_email"], "first@example.com")

    def test_empty_database_returns_empty_list(self):
        results = get_all_clients_with_stats(self.db)
        self.assertEqual(results, [])

    def test_create_client_flow_stats(self):
        data = ClientCreateRequest(
            name="NewCorp",
            company_code="NEW",
            max_users=15,
            admin=ClientAdminCreate(
                username="newadmin",
                email="newadmin@newcorp.com",
                password="SecurePassword123!",
            ),
        )
        resp = create_client_controller(self.db, data)
        self.assertEqual(resp.current_users_count, 1)
        self.assertEqual(resp.active_users, 1)


if __name__ == "__main__":
    unittest.main()
