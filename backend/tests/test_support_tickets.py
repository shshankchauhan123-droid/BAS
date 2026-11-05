import os
import sys
import unittest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Ensure all database models are mapped
import app.client.client_model
import app.user.user_model
import app.user.user_permission_model
import app.case.case_model
import app.bank_transactions.bank_transaction_model
import app.audit.audit_model
import app.support.support_model

from app.core.database import Base, get_db
from app.client.client_model import Client
from app.user.user_model import User
from app.audit.audit_model import AuditLog
from app.support.support_model import SupportTicket, TicketActivity
from app.core.security import hash_password, create_access_token
from app.main import app


class TestSupportTickets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        target_dir = os.path.join("storage", "support_attachments")
        if os.path.exists(target_dir):
            for f in os.listdir(target_dir):
                fp = os.path.join(target_dir, f)
                try:
                    if os.path.isfile(fp):
                        os.remove(fp)
                except Exception:
                    pass

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(TicketActivity).delete()
        self.db.query(SupportTicket).delete()
        self.db.query(AuditLog).delete()
        self.db.query(User).delete()
        self.db.query(Client).delete()
        self.db.commit()

        # Seed Client 1
        self.client_1 = Client(
            id=1,
            name="Bank Corp A",
            company_code="BCORPA",
            is_active=True,
        )
        # Seed Client 2
        self.client_2 = Client(
            id=2,
            name="Bank Corp B",
            company_code="BCORPB",
            is_active=True,
        )
        self.db.add_all([self.client_1, self.client_2])
        self.db.commit()

        # Seed User A (Client 1)
        self.user_a = User(
            id=10,
            client_id=self.client_1.id,
            username="investigator_alice",
            email="alice@bcorpa.com",
            password_hash=hash_password("Pass123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        # Seed User A2 (Client 1)
        self.user_a2 = User(
            id=11,
            client_id=self.client_1.id,
            username="investigator_alice2",
            email="alice2@bcorpa.com",
            password_hash=hash_password("Pass123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        # Seed User B (Client 2)
        self.user_b = User(
            id=20,
            client_id=self.client_2.id,
            username="investigator_bob",
            email="bob@bcorpb.com",
            password_hash=hash_password("Pass123!"),
            role="user",
            is_active=True,
            first_login=False,
        )
        # Seed Client Admin 1 (Client 1)
        self.client_admin_1 = User(
            id=30,
            client_id=self.client_1.id,
            username="client_admin_corp_a",
            email="admin@bcorpa.com",
            password_hash=hash_password("Pass123!"),
            role="client_admin",
            is_active=True,
            first_login=False,
        )
        # Seed Client Admin 2 (Client 2)
        self.client_admin_2 = User(
            id=31,
            client_id=self.client_2.id,
            username="client_admin_corp_b",
            email="admin@bcorpb.com",
            password_hash=hash_password("Pass123!"),
            role="client_admin",
            is_active=True,
            first_login=False,
        )
        # Seed SuperAdmin
        self.super_admin = User(
            id=1,
            client_id=None,
            username="super_director",
            email="superadmin@bas.gov",
            password_hash=hash_password("SuperSecret123!"),
            role="superadmin",
            is_active=True,
            first_login=False,
        )
        self.db.add_all([self.user_a, self.user_a2, self.user_b, self.client_admin_1, self.client_admin_2, self.super_admin])
        self.db.commit()

        self.token_a = create_access_token(user_id=self.user_a.id, role=self.user_a.role)
        self.token_a2 = create_access_token(user_id=self.user_a2.id, role=self.user_a2.role)
        self.token_b = create_access_token(user_id=self.user_b.id, role=self.user_b.role)
        self.token_client_1 = create_access_token(user_id=self.client_admin_1.id, role=self.client_admin_1.role)
        self.token_client_2 = create_access_token(user_id=self.client_admin_2.id, role=self.client_admin_2.role)
        self.token_super = create_access_token(user_id=self.super_admin.id, role=self.super_admin.role)

    def tearDown(self):
        self.db.close()

    def test_01_user_create_ticket_and_sequential_numbering(self):
        """User can create ticket and receives unique BAS-TKT-YYYY-XXXXXX number."""
        payload_1 = {
            "subject": "Statement parser fails on SBI CSV",
            "category": "Data/Report Issue",
            "description": "SBI CSV file upload gets stuck on row 45 with date format error.",
            "priority": "high",
            "related_module": "Bank Statement",
        }
        res_1 = self.client.post(
            "/api/v1/support/tickets",
            json=payload_1,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res_1.status_code, 201)
        data_1 = res_1.json()
        self.assertTrue(data_1["ticket_number"].startswith("BAS-TKT-"))
        self.assertTrue(data_1["ticket_number"].endswith("000001"))
        self.assertEqual(data_1["status"], "open")
        self.assertEqual(data_1["priority"], "high")
        self.assertEqual(data_1["user_id"], self.user_a.id)
        self.assertEqual(data_1["client_id"], self.client_1.id)

        # Create second ticket -> should end with 000002
        payload_2 = {
            "subject": "Missing Export button on NCRP Layer Report",
            "category": "Feature Request",
            "description": "Please add Excel export button to the Layer 2 table.",
            "priority": "medium",
            "related_module": "NCRP Reports",
        }
        res_2 = self.client.post(
            "/api/v1/support/tickets",
            json=payload_2,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res_2.status_code, 201)
        data_2 = res_2.json()
        self.assertTrue(data_2["ticket_number"].endswith("000002"))

    def test_02_user_ticket_isolation_and_summary(self):
        """User A only sees User A's tickets; User B only sees User B's tickets."""
        # Create ticket for User A
        self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Alice's Issue",
                "category": "Technical Issue",
                "description": "Detailed description from Alice.",
                "priority": "low",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        # Create ticket for User B
        self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Bob's Issue",
                "category": "Account/Access",
                "description": "Detailed description from Bob.",
                "priority": "critical",
            },
            headers={"Authorization": f"Bearer {self.token_b}"},
        )

        # Alice checks list
        res_a = self.client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res_a.status_code, 200)
        items_a = res_a.json()["data"]
        self.assertEqual(len(items_a), 1)
        self.assertEqual(items_a[0]["subject"], "Alice's Issue")

        # Alice checks summary
        res_sum_a = self.client.get(
            "/api/v1/support/tickets/my/summary",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res_sum_a.status_code, 200)
        self.assertEqual(res_sum_a.json()["total"], 1)
        self.assertEqual(res_sum_a.json()["open"], 1)

        # Bob checks list
        res_b = self.client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {self.token_b}"},
        )
        self.assertEqual(res_b.status_code, 200)
        items_b = res_b.json()["data"]
        self.assertEqual(len(items_b), 1)
        self.assertEqual(items_b[0]["subject"], "Bob's Issue")

    def test_03_idor_prevention_detail_and_reply(self):
        """User A cannot view or reply to User B's ticket."""
        res_b = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Bob Secret Case Help",
                "category": "Other",
                "description": "Private ticket content.",
                "priority": "medium",
            },
            headers={"Authorization": f"Bearer {self.token_b}"},
        )
        ticket_b_id = res_b.json()["id"]

        # Alice attempts to view Bob's ticket -> 403 Forbidden
        view_res = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_b_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(view_res.status_code, 403)

        # Alice attempts to reply to Bob's ticket -> 403 Forbidden
        reply_res = self.client.post(
            f"/api/v1/support/tickets/my/{ticket_b_id}/replies",
            json={"message": "I am eavesdropping"},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(reply_res.status_code, 403)

    def test_04_user_reply_and_waiting_user_transition(self):
        """User reply transitions status from waiting_user back to in_progress."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Password reset inquiry",
                "category": "Account/Access",
                "description": "Need to clarify account role.",
                "priority": "low",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        ticket_id = res.json()["id"]

        # SuperAdmin sets status to waiting_user
        self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "waiting_user", "admin_response": "Please provide employee ID."},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )

        # Alice views ticket details
        detail_res = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(detail_res.json()["status"], "waiting_user")
        self.assertEqual(detail_res.json()["admin_response"], "Please provide employee ID.")

        # Alice replies with her ID
        reply_res = self.client.post(
            f"/api/v1/support/tickets/my/{ticket_id}/replies",
            json={"message": "My employee ID is EMP-8821."},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(reply_res.status_code, 201)

        # Ticket status should automatically transition back to in_progress
        updated_detail = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(updated_detail.json()["status"], "in_progress")

    def test_05_internal_note_isolation(self):
        """Internal admin notes are visible to SuperAdmin but NEVER exposed to user."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Discrepancy in hold amount",
                "category": "Data/Report Issue",
                "description": "Hold recovery report shows Rs 50,000 difference.",
                "priority": "high",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        ticket_id = res.json()["id"]

        # SuperAdmin adds an INTERNAL note
        note_res = self.client.post(
            f"/api/v1/admin/support/tickets/{ticket_id}/replies",
            json={
                "message": "INTERNAL NOTE: Investigating possible database sync lag with core banking mirror.",
                "is_internal": True,
            },
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(note_res.status_code, 201)

        # SuperAdmin adds a PUBLIC reply
        pub_res = self.client.post(
            f"/api/v1/admin/support/tickets/{ticket_id}/replies",
            json={
                "message": "We are verifying the hold figures with the nodal branch.",
                "is_internal": False,
            },
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(pub_res.status_code, 201)

        # SuperAdmin views ticket -> sees BOTH internal note and public reply
        admin_view = self.client.get(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        admin_activities = admin_view.json()["activities"]
        internal_acts = [a for a in admin_activities if a["is_internal"]]
        self.assertEqual(len(internal_acts), 1)
        self.assertIn("INTERNAL NOTE", internal_acts[0]["message"])

        # User views ticket -> internal note is completely FILTERED OUT
        user_view = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        user_activities = user_view.json()["activities"]
        user_internal_acts = [a for a in user_activities if a["is_internal"]]
        self.assertEqual(len(user_internal_acts), 0)

        # Ensure user can see the public message
        user_messages = [a["message"] for a in user_activities]
        self.assertIn("We are verifying the hold figures with the nodal branch.", user_messages)

    def test_06_superadmin_status_transitions_and_resolution(self):
        """SuperAdmin updates status, marks resolved, and reopens."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Clarification on CIN Search",
                "category": "Feature Request",
                "description": "How do we search LLPs?",
                "priority": "low",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        ticket_id = res.json()["id"]

        # SuperAdmin marks resolved with resolution note
        patch_res = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={
                "status": "resolved",
                "admin_response": "LLPs are supported under MCA CIN Advance Search by entering the LLPIN directly.",
            },
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(patch_res.status_code, 200)
        data = patch_res.json()
        self.assertEqual(data["status"], "resolved")
        self.assertIsNotNone(data["resolved_at"])

        # SuperAdmin reopens ticket
        reopen_res = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "in_progress"},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(reopen_res.status_code, 200)
        self.assertEqual(reopen_res.json()["status"], "in_progress")
        self.assertIsNone(reopen_res.json()["resolved_at"])

    def test_07_regular_user_cannot_access_admin_support_apis(self):
        """Regular users are blocked from admin endpoints with 403 Forbidden."""
        res = self.client.get(
            "/api/v1/admin/support/tickets",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 403)

    def test_08_resolved_and_closed_reply_restrictions_user_and_admin(self):
        """User and Admin cannot reply to Resolved or Closed tickets."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "GST mismatch in tax calculation",
                "category": "Data/Report Issue",
                "description": "GST summary shows 18% instead of 12% on specific HSN.",
                "priority": "medium",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 201)
        ticket_id = res.json()["id"]

        # 1. User can reply to Open ticket
        user_reply_1 = self.client.post(
            f"/api/v1/support/tickets/my/{ticket_id}/replies",
            json={"message": "Attaching the invoice sample."},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(user_reply_1.status_code, 201)

        # 2. Admin can reply to Open/In-Progress ticket
        admin_reply_1 = self.client.post(
            f"/api/v1/admin/support/tickets/{ticket_id}/replies",
            json={"message": "Checking the HSN tax rate table.", "is_internal": False},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(admin_reply_1.status_code, 201)

        # SuperAdmin marks ticket as RESOLVED
        res_resolved = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "resolved", "admin_response": "HSN tax rate updated in system."},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(res_resolved.status_code, 200)
        self.assertEqual(res_resolved.json()["status"], "resolved")

        # 3. User CAN reply to Resolved ticket (status remains resolved, activity recorded)
        user_reply_resolved = self.client.post(
            f"/api/v1/support/tickets/my/{ticket_id}/replies",
            json={"message": "The tax rate is still showing 18% on invoice #9921."},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(user_reply_resolved.status_code, 201)
        self.assertEqual(user_reply_resolved.json()["message"], "The tax rate is still showing 18% on invoice #9921.")

        # Verify status remains 'resolved' and reply appears in activities
        resolved_detail = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(resolved_detail.json()["status"], "resolved")
        messages = [a["message"] for a in resolved_detail.json()["activities"]]
        self.assertIn("The tax rate is still showing 18% on invoice #9921.", messages)

        # 4. Super Admin CAN reply to Resolved ticket (status remains resolved, activity recorded)
        admin_reply_resolved = self.client.post(
            f"/api/v1/admin/support/tickets/{ticket_id}/replies",
            json={"message": "Admin followup response on resolved ticket.", "is_internal": False},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(admin_reply_resolved.status_code, 201)
        self.assertEqual(admin_reply_resolved.json()["message"], "Admin followup response on resolved ticket.")

        # Verify status is still 'resolved' after admin reply
        admin_view_resolved = self.client.get(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(admin_view_resolved.json()["status"], "resolved")
        admin_msgs = [a["message"] for a in admin_view_resolved.json()["activities"]]
        self.assertIn("Admin followup response on resolved ticket.", admin_msgs)

        # SuperAdmin marks ticket as CLOSED
        res_closed = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"status": "closed"},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(res_closed.status_code, 200)
        self.assertEqual(res_closed.json()["status"], "closed")

        # 5. User CANNOT reply to Closed ticket
        user_reply_closed = self.client.post(
            f"/api/v1/support/tickets/my/{ticket_id}/replies",
            json={"message": "Still having issues."},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(user_reply_closed.status_code, 400)
        self.assertIn("This ticket is closed. Replies are disabled.", user_reply_closed.json()["detail"])

        # 6. Super Admin CANNOT reply to Closed ticket
        admin_reply_closed = self.client.post(
            f"/api/v1/admin/support/tickets/{ticket_id}/replies",
            json={"message": "Admin closed reply attempt.", "is_internal": False},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(admin_reply_closed.status_code, 400)
        self.assertIn("This ticket is closed. Replies are disabled.", admin_reply_closed.json()["detail"])

    def test_09_superadmin_cannot_change_priority_via_api_and_updates_preserve_priority(self):
        """Direct API requests cannot modify ticket priority; status updates preserve priority."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Initial high priority issue",
                "category": "Technical Issue",
                "description": "API latency spikes above 2 seconds during batch processing.",
                "priority": "high",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 201)
        ticket_id = res.json()["id"]
        self.assertEqual(res.json()["priority"], "high")

        # 1. Attempt to change priority via SuperAdmin PATCH -> MUST BE REJECTED (400)
        patch_priority_res = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={"priority": "low"},
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(patch_priority_res.status_code, 400)
        self.assertIn("Ticket priority cannot be modified after creation.", patch_priority_res.json()["detail"])

        # 2. SuperAdmin updates status and resolution note without priority -> SUCCEEDS (200)
        patch_status_res = self.client.patch(
            f"/api/v1/admin/support/tickets/{ticket_id}",
            json={
                "status": "in_progress",
                "admin_response": "Optimized database indexes to mitigate batch latency.",
            },
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(patch_status_res.status_code, 200)
        updated_data = patch_status_res.json()
        self.assertEqual(updated_data["status"], "in_progress")
        # Priority must remain untouched as 'high'
        self.assertEqual(updated_data["priority"], "high")
        self.assertEqual(updated_data["admin_response"], "Optimized database indexes to mitigate batch latency.")

        # 3. Check details endpoint for user -> Priority still intact
        user_detail = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(user_detail.json()["priority"], "high")
        self.assertEqual(user_detail.json()["status"], "in_progress")

    def test_10_create_ticket_with_attachment_and_download(self):
        """User can upload attachment; both user and superadmin can download it."""
        import io

        file_content = b"Sample Excel binary or CSV test payload for ticket attachment"
        file_obj = io.BytesIO(file_content)

        data = {
            "subject": "Statement error with attachment",
            "category": "Technical Issue",
            "description": "Attached file demonstrates the exact error log.",
            "priority": "medium",
            "related_module": "Bank Statement",
        }
        files = {
            "attachment": (
                "error_log.xlsx",
                file_obj,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
        }

        res = self.client.post(
            "/api/v1/support/tickets",
            data=data,
            files=files,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 201)
        ticket_data = res.json()
        ticket_id = ticket_data["id"]

        self.assertEqual(ticket_data["attachment_filename"], "error_log.xlsx")
        self.assertEqual(ticket_data["attachment_size"], len(file_content))
        self.assertTrue(ticket_data["has_attachment"])

        # 1. User downloads own attachment
        user_dl = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}/attachment",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(user_dl.status_code, 200)
        self.assertEqual(user_dl.content, file_content)
        self.assertIn("error_log.xlsx", user_dl.headers.get("content-disposition", ""))

        # 2. Superadmin downloads attachment
        admin_dl = self.client.get(
            f"/api/v1/admin/support/tickets/{ticket_id}/attachment",
            headers={"Authorization": f"Bearer {self.token_super}"},
        )
        self.assertEqual(admin_dl.status_code, 200)
        self.assertEqual(admin_dl.content, file_content)

    def test_11_attachment_idor_protection(self):
        """User B cannot download User A's attachment."""
        import io

        file_content = b"Confidential client A document"
        files = {
            "attachment": ("secret.pdf", io.BytesIO(file_content), "application/pdf"),
        }
        res = self.client.post(
            "/api/v1/support/tickets",
            data={
                "subject": "User A ticket",
                "category": "Account/Access",
                "description": "Sensitive details",
            },
            files=files,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 201)
        ticket_id = res.json()["id"]

        # User B attempts to download User A's attachment
        unauth_dl = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}/attachment",
            headers={"Authorization": f"Bearer {self.token_b}"},
        )
        self.assertEqual(unauth_dl.status_code, 403)
        self.assertIn("Access denied", unauth_dl.json()["detail"])

    def test_12_attachment_file_size_limit_rejection(self):
        """Uploading attachment > 10 MB must be rejected with 400 Bad Request."""
        import io

        # 10 MB + 1 KB
        oversized_content = b"0" * (10 * 1024 * 1024 + 1024)
        files = {
            "attachment": ("huge_dump.csv", io.BytesIO(oversized_content), "text/csv"),
        }
        res = self.client.post(
            "/api/v1/support/tickets",
            data={
                "subject": "Oversized file ticket",
                "category": "Technical Issue",
                "description": "This file is too large",
            },
            files=files,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("File size must be 10 MB or less", res.json()["detail"])

    def test_13_attachment_invalid_extension_rejection(self):
        """Uploading dangerous or unsupported file types must be rejected."""
        import io

        files = {
            "attachment": ("payload.exe", io.BytesIO(b"MZ\x90\x00executable"), "application/octet-stream"),
        }
        res = self.client.post(
            "/api/v1/support/tickets",
            data={
                "subject": "Executable file ticket",
                "category": "Technical Issue",
                "description": "Attempting to upload exe",
            },
            files=files,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unsupported file type", res.json()["detail"])

    def test_14_backward_compatibility_json_creation_and_no_attachment_download(self):
        """Pure JSON creation remains fully supported and downloading non-existent attachment yields 404."""
        res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "No attachment ticket",
                "category": "Feature Request",
                "description": "General question without files.",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res.status_code, 201)
        ticket_id = res.json()["id"]
        self.assertFalse(res.json()["has_attachment"])
        self.assertIsNone(res.json()["attachment_filename"])

        # Attempt to download attachment when none was attached
        dl_res = self.client.get(
            f"/api/v1/support/tickets/my/{ticket_id}/attachment",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(dl_res.status_code, 404)
        self.assertIn("This ticket does not have an attachment", dl_res.json()["detail"])

    def test_15_client_admin_visibility_of_all_users_under_client(self):
        """Client Admin sees all tickets created by users belonging to that client."""
        # Alice (User A, Client 1) creates Ticket 1
        t1_res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Alice's Issue with Statement",
                "category": "Technical Issue",
                "description": "Alice cannot parse ICICI statement.",
                "priority": "high",
            },
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(t1_res.status_code, 201)
        t1_id = t1_res.json()["id"]

        # Alice 2 (User A2, Client 1) creates Ticket 2
        t2_res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Alice 2's Question on NCRP",
                "category": "Data/Report Issue",
                "description": "Alice 2 has questions on report 07.",
                "priority": "medium",
            },
            headers={"Authorization": f"Bearer {self.token_a2}"},
        )
        self.assertEqual(t2_res.status_code, 201)
        t2_id = t2_res.json()["id"]

        # Bob (User B, Client 2) creates Ticket 3
        t3_res = self.client.post(
            "/api/v1/support/tickets",
            json={
                "subject": "Bob's Client 2 Ticket",
                "category": "Feature Request",
                "description": "Bob belongs to Client 2.",
                "priority": "low",
            },
            headers={"Authorization": f"Bearer {self.token_b}"},
        )
        self.assertEqual(t3_res.status_code, 201)
        t3_id = t3_res.json()["id"]

        # 1. User A only sees their own ticket (Ticket 1)
        res_a = self.client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(res_a.status_code, 200)
        user_a_ids = [t["id"] for t in res_a.json()["data"]]
        self.assertEqual(user_a_ids, [t1_id])

        # 2. Client Admin 1 sees BOTH Ticket 1 and Ticket 2 (all users under Client 1), but NOT Ticket 3
        res_client_1 = self.client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(res_client_1.status_code, 200)
        client_1_ids = [t["id"] for t in res_client_1.json()["data"]]
        self.assertIn(t1_id, client_1_ids)
        self.assertIn(t2_id, client_1_ids)
        self.assertNotIn(t3_id, client_1_ids)
        self.assertEqual(len(client_1_ids), 2)

        # Creator info is populated
        items = res_client_1.json()["data"]
        usernames = {i["user_name"] for i in items}
        self.assertIn("investigator_alice", usernames)
        self.assertIn("investigator_alice2", usernames)

        # 3. Client Admin 2 sees ONLY Ticket 3 (Client 2 user)
        res_client_2 = self.client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {self.token_client_2}"},
        )
        self.assertEqual(res_client_2.status_code, 200)
        client_2_ids = [t["id"] for t in res_client_2.json()["data"]]
        self.assertEqual(client_2_ids, [t3_id])

    def test_16_client_admin_summary_counts(self):
        """Client Admin summary reflects total tickets of all users under that client."""
        # Create 2 tickets under Client 1 and 1 ticket under Client 2
        p1 = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "Subject 1", "category": "Tech", "description": "Description 1", "priority": "low"},
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(p1.status_code, 201)

        p2 = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "Subject 2", "category": "Tech", "description": "Description 2", "priority": "high"},
            headers={"Authorization": f"Bearer {self.token_a2}"},
        )
        self.assertEqual(p2.status_code, 201)

        p3 = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "Subject 3", "category": "Tech", "description": "Description 3", "priority": "medium"},
            headers={"Authorization": f"Bearer {self.token_b}"},
        )
        self.assertEqual(p3.status_code, 201)

        # Client Admin 1 summary
        sum_1 = self.client.get(
            "/api/v1/support/tickets/my/summary",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(sum_1.status_code, 200)
        self.assertEqual(sum_1.json()["total"], 2)
        self.assertEqual(sum_1.json()["open"], 2)

        # Client Admin 2 summary
        sum_2 = self.client.get(
            "/api/v1/support/tickets/my/summary",
            headers={"Authorization": f"Bearer {self.token_client_2}"},
        )
        self.assertEqual(sum_2.status_code, 200)
        self.assertEqual(sum_2.json()["total"], 1)

    def test_17_client_admin_cannot_view_other_client_ticket_details(self):
        """Client Admin is forbidden from viewing ticket details belonging to another client."""
        # Bob (Client 2) creates a ticket
        bob_ticket = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "Bob Secret", "category": "Audit", "description": "Client 2 internal", "priority": "medium"},
            headers={"Authorization": f"Bearer {self.token_b}"},
        ).json()

        # Client Admin 1 attempts to view Bob's ticket
        res = self.client.get(
            f"/api/v1/support/tickets/my/{bob_ticket['id']}",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("belonging to another client", res.json()["detail"])

    def test_18_client_admin_read_only_rejection_for_creation_and_replies(self):
        """Client Admin cannot create tickets or post replies (read-only enforcement)."""
        # 1. Attempt to create ticket as Client Admin
        create_res = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "Client Admin Ticket", "category": "General", "description": "Testing creation", "priority": "low"},
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(create_res.status_code, 403)
        self.assertIn("Client accounts have read-only access", create_res.json()["detail"])

        # 2. User A creates a ticket
        user_ticket = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "User A Ticket", "category": "General", "description": "Testing", "priority": "low"},
            headers={"Authorization": f"Bearer {self.token_a}"},
        ).json()

        # 3. Client Admin attempts to reply
        reply_res = self.client.post(
            f"/api/v1/support/tickets/my/{user_ticket['id']}/replies",
            json={"message": "Client admin reply attempt"},
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(reply_res.status_code, 403)
        self.assertIn("Client accounts have read-only access", reply_res.json()["detail"])

    def test_19_client_admin_rejection_for_status_update_assign_and_delete(self):
        """Client Admin cannot update status, assign, or delete tickets."""
        user_ticket = self.client.post(
            "/api/v1/support/tickets",
            json={"subject": "User Ticket", "category": "General", "description": "Testing", "priority": "low"},
            headers={"Authorization": f"Bearer {self.token_a}"},
        ).json()
        tid = user_ticket["id"]

        # Attempt DELETE
        del_res = self.client.delete(
            f"/api/v1/support/tickets/{tid}",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(del_res.status_code, 403)

        # Attempt PATCH status
        patch_status_res = self.client.patch(
            f"/api/v1/support/tickets/{tid}/status",
            json={"status": "resolved"},
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(patch_status_res.status_code, 403)

        # Attempt POST assign
        assign_res = self.client.post(
            f"/api/v1/support/tickets/{tid}/assign",
            json={"assigned_to": 1},
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(assign_res.status_code, 403)

        # Attempt SuperAdmin update endpoint with client admin token
        admin_patch_res = self.client.patch(
            f"/api/v1/admin/support/tickets/{tid}",
            json={"status": "resolved"},
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(admin_patch_res.status_code, 403)

    def test_20_client_admin_can_view_details_and_download_attachment_for_client_users(self):
        """Client Admin can view ticket details and download attachment of user tickets under their client."""
        import io
        files = {
            "attachment": ("sample_report.pdf", io.BytesIO(b"%PDF-1.4 sample content"), "application/pdf"),
        }
        create_res = self.client.post(
            "/api/v1/support/tickets",
            data={
                "subject": "Statement with attachment",
                "category": "Technical Issue",
                "description": "Please review attached document",
                "priority": "medium",
            },
            files=files,
            headers={"Authorization": f"Bearer {self.token_a}"},
        )
        self.assertEqual(create_res.status_code, 201)
        tid = create_res.json()["id"]

        # Client Admin 1 can view details
        detail_res = self.client.get(
            f"/api/v1/support/tickets/my/{tid}",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json()["id"], tid)
        self.assertEqual(detail_res.json()["user_name"], "investigator_alice")

        # Client Admin 1 can download attachment
        dl_res = self.client.get(
            f"/api/v1/support/tickets/my/{tid}/attachment",
            headers={"Authorization": f"Bearer {self.token_client_1}"},
        )
        self.assertEqual(dl_res.status_code, 200)
        self.assertEqual(dl_res.content, b"%PDF-1.4 sample content")

        # Client Admin 2 CANNOT download attachment of Client 1's ticket
        dl_res_2 = self.client.get(
            f"/api/v1/support/tickets/my/{tid}/attachment",
            headers={"Authorization": f"Bearer {self.token_client_2}"},
        )
        self.assertEqual(dl_res_2.status_code, 403)



if __name__ == "__main__":
    unittest.main()
