import base64
import os
import sys
import unittest

import cv2
import numpy as np

SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SERVICE_DIR)

import app as training_app


class SupervisedTrainingApiTest(unittest.TestCase):
    def setUp(self):
        training_app.sessions.clear()
        training_app.pose_estimator = lambda _frame: ([], [])
        self.client = training_app.app.test_client()

    def image_data(self):
        ok, encoded = cv2.imencode(".jpg", np.zeros((64, 64, 3), dtype=np.uint8))
        self.assertTrue(ok)
        return "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")

    def test_health_reports_runtime_ready(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["ok"])

    def test_session_contract_handles_frame_without_person(self):
        started = self.client.post("/api/session/start", json={"exercise": "squats"})
        self.assertEqual(started.status_code, 200)
        session_id = started.get_json()["session_id"]

        analyzed = self.client.post("/api/session/frame", json={
            "session_id": session_id,
            "image_data": self.image_data(),
        })
        self.assertEqual(analyzed.status_code, 200)
        self.assertEqual(analyzed.get_json()["status_color"], "warn")

        stopped = self.client.post("/api/session/stop", json={"session_id": session_id})
        self.assertEqual(stopped.status_code, 200)
        self.assertEqual(stopped.get_json()["summary"]["exercise"], "squats")

    def test_unknown_exercise_is_rejected(self):
        response = self.client.post("/api/session/start", json={"exercise": "burpee"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
