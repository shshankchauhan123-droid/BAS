import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.user.user_model import User
from app.audit.audit_model import AuditLog
from app.core.security import verify_password, hash_password
from app.authentication.auth_service import change_first_login_password, dismiss_first_login


class TestFirstLoginAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.db.query(User).delete()
        self.db.commit()

        # User requiring first-login password change
        self.user = User(
            id=1,
            username="investigator_john",
            email="john@example.com",
            password_hash=hash_password("InitialTemp123"),
            role="user",
            first_login=True,
            is_active=True,
        )
        self.db.add(self.user)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_change_first_login_password_success(self):
        """User with first_login=True can successfully update their password."""
        new_pwd = "SecurePersonalPassword@2026"
        updated_user = change_first_login_password(
            db=self.db,
            user=self.user,
            new_password=new_pwd,
        )

        self.assertFalse(updated_user.first_login)
        self.assertTrue(verify_password(new_pwd, updated_user.password_hash))
        self.assertFalse(verify_password("InitialTemp123", updated_user.password_hash))

    def test_change_first_login_password_too_short(self):
        """Passwords under 6 characters are rejected."""
        with self.assertRaises(ValueError) as ctx:
            change_first_login_password(
                db=self.db,
                user=self.user,
                new_password="12345",
            )
        self.assertIn("at least 6 characters", str(ctx.exception))

    def test_change_first_login_password_when_already_completed(self):
        """If first_login is already False, change_first_login_password is rejected."""
        self.user.first_login = False
        self.db.commit()

        with self.assertRaises(ValueError) as ctx:
            change_first_login_password(
                db=self.db,
                user=self.user,
                new_password="AnotherNewPassword123",
            )
        self.assertIn("not required or already completed", str(ctx.exception))

    def test_dismiss_first_login(self):
        """Dismissing first login sets first_login to False without changing password."""
        initial_hash = self.user.password_hash
        updated_user = dismiss_first_login(
            db=self.db,
            user=self.user,
        )

        self.assertFalse(updated_user.first_login)
        # Password hash remains the same
        self.assertEqual(updated_user.password_hash, initial_hash)
        self.assertTrue(verify_password("InitialTemp123", updated_user.password_hash))


if __name__ == "__main__":
    unittest.main()
