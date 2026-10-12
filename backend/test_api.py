import os
import tempfile
import unittest
from datetime import date

TEST_DB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.name}"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-testing"

from fastapi.testclient import TestClient
from main import Base, SessionLocal, app, engine


class PocketSmartApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        Base.metadata.drop_all(engine)
        engine.dispose()
        TEST_DB.close()
        os.unlink(TEST_DB.name)

    def register(self, email):
        response = self.client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "strong-password"})
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def test_demo_account_is_available(self):
        response = self.client.post("/api/auth/login", json={"email": "demo@pocketsmart.ai", "password": "demo12345"})
        self.assertEqual(response.status_code, 200)
        token = {"Authorization": f"Bearer {response.json()['access_token']}"}
        self.assertGreater(len(self.client.get("/api/transactions", headers=token).json()), 5)

    def test_registration_login_and_private_transactions(self):
        alice = self.register("alice@example.com")
        bob = self.register("bob@example.com")
        response = self.client.post("/api/transactions", headers=alice, json={"type": "expense", "category": "Food", "amount": 28, "date": date.today().isoformat(), "description": "Lunch"})
        self.assertEqual(response.status_code, 201)
        transaction_id = response.json()["id"]
        self.assertEqual(self.client.get("/api/transactions", headers=bob).json(), [])
        self.assertEqual(self.client.delete(f"/api/transactions/{transaction_id}", headers=bob).status_code, 404)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "alice@example.com", "password": "strong-password"}).status_code, 200)

    def test_rejects_invalid_financial_inputs(self):
        token = self.register("validation@example.com")
        response = self.client.post("/api/transactions", headers=token, json={"type": "expense", "category": "Food", "amount": -2, "date": date.today().isoformat()})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/api/transactions", headers=token, json={"type": "expense", "category": "Unapproved", "amount": 10, "date": date.today().isoformat()})
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/api/transactions", headers={**token, "Content-Type": "application/json"}, content=f'{{"type":"expense","category":"Food","amount":NaN,"date":"{date.today().isoformat()}"}}')
        self.assertEqual(response.status_code, 422)
        response = self.client.put("/api/budget", headers={**token, "Content-Type": "application/json"}, content='{"monthly_limit":Infinity,"category_limits":{}}')
        self.assertEqual(response.status_code, 422)

    def test_analytics_includes_savings_trend(self):
        token = self.register("analytics@example.com")
        response = self.client.get("/api/analytics", headers=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["monthly"]), 6)
        self.assertTrue(all("savings" in month for month in response.json()["monthly"]))

    def test_unauthenticated_access_is_rejected(self):
        self.assertEqual(self.client.get("/api/dashboard").status_code, 401)
        self.assertEqual(self.client.get("/api/analytics").status_code, 401)


if __name__ == "__main__":
    unittest.main()
