import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies.auth import get_current_user
from app.core.database import get_db
from app.user.user_schema import UserPermissionsSchema, UserPermissionsUpdateRequest


class TestFactServicesPermissions(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_schema_defaults_and_computed_fields(self):
        # Default should deny access (False)
        perms = UserPermissionsSchema()
        self.assertFalse(perms.can_gst_advance_search)
        self.assertFalse(perms.can_cin_advance_search)
        self.assertFalse(perms.gst_advance_search)
        self.assertFalse(perms.cin_advance_search)

        # Explicit grant
        perms_granted = UserPermissionsSchema(
            can_gst_advance_search=True,
            can_cin_advance_search=True,
        )
        self.assertTrue(perms_granted.can_gst_advance_search)
        self.assertTrue(perms_granted.can_cin_advance_search)
        self.assertTrue(perms_granted.gst_advance_search)
        self.assertTrue(perms_granted.cin_advance_search)

        # Update request syncs alternative keys
        update_req = UserPermissionsUpdateRequest(
            gst_advance_search=True,
            cin_advance_search=False,
        )
        self.assertTrue(update_req.can_gst_advance_search)
        self.assertFalse(update_req.can_cin_advance_search)

    def test_gst_endpoint_authorization_matrix(self):
        # 1. User without permission -> 403 Forbidden
        user_no_perms = MagicMock()
        user_no_perms.id = 101
        user_no_perms.role = "user"
        user_no_perms.is_active = True
        user_no_perms.permissions = MagicMock(can_gst_advance_search=False)

        app.dependency_overrides[get_current_user] = lambda: user_no_perms

        with patch("app.gst.gst_router.execute_gst_advance_search", new_callable=AsyncMock) as mock_exec:
            res = self.client.post("/api/v1/gst/advance-search", json={"gstNumber": "27AAAAA0000A1Z5"})
            self.assertEqual(res.status_code, 403)
            self.assertIn("Access denied", res.json()["detail"])
            mock_exec.assert_not_called()

        # 2. User with permission -> 200 OK
        user_with_perms = MagicMock()
        user_with_perms.id = 102
        user_with_perms.role = "user"
        user_with_perms.is_active = True
        user_with_perms.permissions = MagicMock(can_gst_advance_search=True)

        app.dependency_overrides[get_current_user] = lambda: user_with_perms

        with patch("app.gst.gst_router.execute_gst_advance_search", new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = {"success": True, "data": {"gstin": "07AAAAA0000A1Z5"}}
            res = self.client.post("/api/v1/gst/advance-search", json={"gstNumber": "27AAAAA0000A1Z5"})
            self.assertEqual(res.status_code, 200)
            mock_exec.assert_called_once()

        # 3. SuperAdmin / Admin -> 200 OK (bypass role)
        admin_user = MagicMock()
        admin_user.id = 1
        admin_user.role = "admin"
        admin_user.is_active = True
        admin_user.permissions = None

        app.dependency_overrides[get_current_user] = lambda: admin_user

        with patch("app.gst.gst_router.execute_gst_advance_search", new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = {"success": True}
            res = self.client.post("/api/v1/gst/advance-search", json={"gstNumber": "27AAAAA0000A1Z5"})
            self.assertEqual(res.status_code, 200)
            mock_exec.assert_called_once()

    def test_cin_endpoint_authorization_matrix(self):
        # 1. User without permission -> 403 Forbidden
        user_no_perms = MagicMock()
        user_no_perms.id = 101
        user_no_perms.role = "user"
        user_no_perms.is_active = True
        user_no_perms.permissions = MagicMock(can_cin_advance_search=False)

        app.dependency_overrides[get_current_user] = lambda: user_no_perms

        with patch("app.cin.cin_router.execute_cin_advance_search", new_callable=AsyncMock) as mock_exec:
            res = self.client.get("/api/v1/cin/advance-search", params={"searchNumber": "ADB-0675"})
            self.assertEqual(res.status_code, 403)
            self.assertIn("Access denied", res.json()["detail"])
            mock_exec.assert_not_called()

        # 2. User with permission -> 200 OK
        user_with_perms = MagicMock()
        user_with_perms.id = 102
        user_with_perms.role = "user"
        user_with_perms.is_active = True
        user_with_perms.permissions = MagicMock(can_cin_advance_search=True)

        app.dependency_overrides[get_current_user] = lambda: user_with_perms

        with patch("app.cin.cin_router.execute_cin_advance_search", new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = {"success": True, "data": {"cin": "ADB-0675"}}
            res = self.client.get("/api/v1/cin/advance-search", params={"searchNumber": "ADB-0675"})
            self.assertEqual(res.status_code, 200)
            mock_exec.assert_called_once()

        # 3. Client Admin -> 200 OK (bypass role)
        client_admin = MagicMock()
        client_admin.id = 2
        client_admin.role = "client_admin"
        client_admin.is_active = True
        client_admin.permissions = None

        app.dependency_overrides[get_current_user] = lambda: client_admin

        with patch("app.cin.cin_router.execute_cin_advance_search", new_callable=AsyncMock) as mock_exec:
            mock_exec.return_value = {"success": True}
            res = self.client.get("/api/v1/cin/advance-search", params={"searchNumber": "ADB-0675"})
            self.assertEqual(res.status_code, 200)
            mock_exec.assert_called_once()

    def test_independent_access_combinations(self):
        # Scenario: User has GST rights, but lacks CIN rights
        gst_only_user = MagicMock()
        gst_only_user.id = 103
        gst_only_user.role = "user"
        gst_only_user.is_active = True
        gst_only_user.permissions = MagicMock(
            can_gst_advance_search=True,
            can_cin_advance_search=False,
        )

        app.dependency_overrides[get_current_user] = lambda: gst_only_user

        with patch("app.gst.gst_router.execute_gst_advance_search", new_callable=AsyncMock) as mock_gst, \
             patch("app.cin.cin_router.execute_cin_advance_search", new_callable=AsyncMock) as mock_cin:
            mock_gst.return_value = {"success": True}
            mock_cin.return_value = {"success": True}

            # GST succeeds
            res_gst = self.client.post("/api/v1/gst/advance-search", json={"gstNumber": "27AAAAA0000A1Z5"})
            self.assertEqual(res_gst.status_code, 200)
            mock_gst.assert_called_once()

            # CIN is rejected with 403
            res_cin = self.client.get("/api/v1/cin/advance-search", params={"searchNumber": "ADB-0675"})
            self.assertEqual(res_cin.status_code, 403)
            mock_cin.assert_not_called()

        # Scenario: User has CIN rights, but lacks GST rights
        cin_only_user = MagicMock()
        cin_only_user.id = 104
        cin_only_user.role = "user"
        cin_only_user.is_active = True
        cin_only_user.permissions = MagicMock(
            can_gst_advance_search=False,
            can_cin_advance_search=True,
        )

        app.dependency_overrides[get_current_user] = lambda: cin_only_user

        with patch("app.gst.gst_router.execute_gst_advance_search", new_callable=AsyncMock) as mock_gst, \
             patch("app.cin.cin_router.execute_cin_advance_search", new_callable=AsyncMock) as mock_cin:
            mock_gst.return_value = {"success": True}
            mock_cin.return_value = {"success": True}

            # GST is rejected with 403
            res_gst = self.client.post("/api/v1/gst/advance-search", json={"gstNumber": "27AAAAA0000A1Z5"})
            self.assertEqual(res_gst.status_code, 403)
            mock_gst.assert_not_called()

            # CIN succeeds
            res_cin = self.client.get("/api/v1/cin/advance-search", params={"searchNumber": "ADB-0675"})
            self.assertEqual(res_cin.status_code, 200)
            mock_cin.assert_called_once()


if __name__ == "__main__":
    unittest.main()
