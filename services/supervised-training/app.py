from __future__ import annotations

import base64
from collections import Counter
from dataclasses import dataclass, field
import math
import os
import threading
import time
import uuid

import cv2
from flask import Flask, jsonify, request
import numpy as np
from rtmlib import RTMO


MODEL_FILENAME = "rtmo-s_8xb32-600e_body7-640x640-dac2bf74_20231211.onnx"
MODEL_PATH = os.getenv(
    "POSE_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "models", MODEL_FILENAME),
)
SESSION_TTL_SECONDS = 20 * 60
MAX_SESSIONS = 24
MAX_IMAGE_DATA_LENGTH = 1_500_000

EXERCISES = {
    "squats": "深蹲",
    "lunges": "弓步蹲",
    "pushups": "俯卧撑",
    "dumbbell_shoulder_press": "哑铃肩推",
    "dumbbell_rows": "哑铃划船",
    "bicep_curls": "二头弯举",
    "situps": "仰卧起坐",
    "tricep_extensions": "肱三头屈伸",
    "lateral_shoulder_raises": "侧平举",
    "jumping_jacks": "开合跳",
}

STEADY_CUES = {
    "squats": "膝盖跟随脚尖方向，保持稳定节奏。",
    "lunges": "上身保持挺直，前膝稳定对准脚尖。",
    "pushups": "肩、髋和脚踝尽量保持在一条线上。",
    "dumbbell_shoulder_press": "核心收紧，手臂沿身体中线向上推。",
    "dumbbell_rows": "躯干保持稳定，手肘贴近肋部向后拉。",
    "bicep_curls": "固定上臂和手肘，平稳完成弯举。",
    "situps": "起身和回落都放慢，保持均匀呼吸。",
    "tricep_extensions": "保持上臂稳定，只让前臂完成屈伸。",
    "lateral_shoulder_raises": "双肩放松，左右手以相近速度抬起。",
    "jumping_jacks": "轻柔落地，手脚保持同步节奏。",
}


@dataclass
class TrainingSession:
    session_id: str
    exercise: str
    started_at: float
    last_seen_at: float
    phase: str = "ready"
    rep_count: int = 0
    armed: bool = False
    last_spoken_at: float = 0.0
    error_totals: Counter = field(default_factory=Counter)
    last_feedback: dict | None = None


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024

sessions: dict[str, TrainingSession] = {}
sessions_lock = threading.Lock()
pose_lock = threading.Lock()
pose_estimator = None


def get_pose_estimator():
    global pose_estimator
    if pose_estimator is None:
        if not os.path.isfile(MODEL_PATH):
            raise RuntimeError(f"姿态模型不存在: {MODEL_PATH}")
        pose_estimator = RTMO(
            MODEL_PATH,
            model_input_size=(640, 640),
            to_openpose=False,
            backend="onnxruntime",
            device="cpu",
        )
    return pose_estimator


def cleanup_sessions(now: float) -> None:
    expired = [
        session_id
        for session_id, session in sessions.items()
        if now - session.last_seen_at > SESSION_TTL_SECONDS
    ]
    for session_id in expired:
        sessions.pop(session_id, None)


def decode_image(image_data: str) -> np.ndarray:
    if not isinstance(image_data, str) or len(image_data) > MAX_IMAGE_DATA_LENGTH:
        raise ValueError("图像帧过大或格式不正确")
    if "," not in image_data:
        raise ValueError("无效的图像数据")
    _, encoded = image_data.split(",", 1)
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except ValueError as exc:
        raise ValueError("图像解码失败") from exc
    frame = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("无法读取图像帧")
    return frame


def extract_pose(image_data: str) -> np.ndarray | None:
    frame = decode_image(image_data)
    with pose_lock:
        keypoints, _ = get_pose_estimator()(frame)
    if len(keypoints) == 0:
        return None
    points = np.asarray(keypoints[0], dtype=np.float32)
    return points if points.shape == (17, 2) else None


def joint_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba = a - b
    bc = c - b
    denominator = float(np.linalg.norm(ba) * np.linalg.norm(bc))
    if denominator < 1e-6:
        return 180.0
    cosine = float(np.clip(np.dot(ba, bc) / denominator, -1.0, 1.0))
    return math.degrees(math.acos(cosine))


def average(*values: float) -> float:
    return sum(values) / max(len(values), 1)


def phase_for(exercise: str, points: np.ndarray) -> tuple[str, bool, bool]:
    left_elbow = joint_angle(points[5], points[7], points[9])
    right_elbow = joint_angle(points[6], points[8], points[10])
    left_knee = joint_angle(points[11], points[13], points[15])
    right_knee = joint_angle(points[12], points[14], points[16])
    elbow = average(left_elbow, right_elbow)
    knee = min(left_knee, right_knee)

    if exercise in {"squats", "lunges"}:
        if knee < 105:
            return "bottom", True, False
        if knee > 150:
            return "ready", False, True
        return "lowering", False, False

    if exercise in {"pushups", "dumbbell_rows", "bicep_curls", "tricep_extensions"}:
        contracted_threshold = 85 if exercise != "pushups" else 100
        if elbow < contracted_threshold:
            return "contracted", True, False
        if elbow > 145:
            return "ready", False, True
        return "moving", False, False

    if exercise == "dumbbell_shoulder_press":
        wrists_above_shoulders = average(points[9][1], points[10][1]) < average(points[5][1], points[6][1])
        if wrists_above_shoulders and elbow > 145:
            return "top", True, False
        if elbow < 105:
            return "ready", False, True
        return "pressing", False, False

    if exercise == "lateral_shoulder_raises":
        shoulder_y = average(points[5][1], points[6][1])
        wrist_y = average(points[9][1], points[10][1])
        torso = max(abs(average(points[11][1], points[12][1]) - shoulder_y), 1.0)
        offset = (wrist_y - shoulder_y) / torso
        if offset < 0.2:
            return "top", True, False
        if offset > 0.75:
            return "ready", False, True
        return "raising", False, False

    if exercise == "jumping_jacks":
        body_width = max(float(np.ptp(points[:, 0])), 1.0)
        ankle_spread = abs(float(points[15][0] - points[16][0])) / body_width
        wrists_up = average(points[9][1], points[10][1]) < average(points[5][1], points[6][1])
        if wrists_up and ankle_spread > 0.55:
            return "open", True, False
        if not wrists_up and ankle_spread < 0.35:
            return "ready", False, True
        return "moving", False, False

    shoulder_y = average(points[5][1], points[6][1])
    hip_y = average(points[11][1], points[12][1])
    torso_height = abs(hip_y - shoulder_y)
    body_height = max(float(np.ptp(points[:, 1])), 1.0)
    ratio = torso_height / body_height
    if ratio < 0.24:
        return "contracted", True, False
    if ratio > 0.34:
        return "ready", False, True
    return "moving", False, False


def evaluate(session: TrainingSession, points: np.ndarray | None, now: float) -> dict:
    if points is None:
        cue = "请站到画面中央，让全身尽量完整入镜。"
        session.error_totals["no_person"] += 1
        feedback = {
            "phase": "ready",
            "rep_count": session.rep_count,
            "status_color": "warn",
            "primary_cue": cue,
            "secondary_cue": "",
            "speak_text": cue if now - session.last_spoken_at > 5 else "",
            "errors": [{"code": "no_person", "cue": cue, "severity": 1.0}],
        }
        if feedback["speak_text"]:
            session.last_spoken_at = now
        session.last_feedback = feedback
        return feedback

    phase, contracted, extended = phase_for(session.exercise, points)
    if contracted:
        session.armed = True
    elif extended and session.armed:
        session.rep_count += 1
        session.armed = False

    session.phase = phase
    cue = STEADY_CUES[session.exercise]
    feedback = {
        "phase": phase,
        "rep_count": session.rep_count,
        "status_color": "good",
        "primary_cue": cue,
        "secondary_cue": "",
        "speak_text": "",
        "errors": [],
    }
    session.last_feedback = feedback
    return feedback


@app.get("/")
def health():
    try:
        get_pose_estimator()
    except Exception as exc:
        return jsonify({"ok": False, "engine": "rtmpose-cpu", "error": str(exc)}), 503
    return jsonify({
        "ok": True,
        "engine": "rtmpose-cpu",
        "privacy": "frames-processed-in-memory-not-persisted",
    })


@app.post("/api/session/start")
def start_session():
    payload = request.get_json(silent=True) or {}
    exercise = str(payload.get("exercise", "")).strip()
    if exercise not in EXERCISES:
        return jsonify({
            "error": f"不支持的动作: {exercise}",
            "supported_exercises": list(EXERCISES),
        }), 400

    now = time.time()
    with sessions_lock:
        cleanup_sessions(now)
        if len(sessions) >= MAX_SESSIONS:
            return jsonify({"error": "训练服务繁忙，请稍后重试"}), 503
        session_id = uuid.uuid4().hex
        sessions[session_id] = TrainingSession(
            session_id=session_id,
            exercise=exercise,
            started_at=now,
            last_seen_at=now,
        )
    return jsonify({
        "session_id": session_id,
        "exercise": exercise,
        "exercise_label": EXERCISES[exercise],
        "mode": "manual",
    })


@app.post("/api/session/frame")
def analyze_frame():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    image_data = payload.get("image_data")
    if not session_id:
        return jsonify({"error": "缺少 session_id"}), 400
    if not image_data:
        return jsonify({"error": "缺少 image_data"}), 400

    now = time.time()
    with sessions_lock:
        cleanup_sessions(now)
        session = sessions.get(session_id)
        if session is None:
            return jsonify({"error": "会话不存在或已过期"}), 404
        session.last_seen_at = now

    try:
        points = extract_pose(image_data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(evaluate(session, points, now))


@app.post("/api/session/stop")
def stop_session():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id", "")).strip()
    if not session_id:
        return jsonify({"error": "缺少 session_id"}), 400

    with sessions_lock:
        session = sessions.pop(session_id, None)
    if session is None:
        return jsonify({"error": "会话不存在或已过期"}), 404

    mistakes = [
        {"code": code, "label": "没有检测到完整人体", "count": count}
        for code, count in session.error_totals.most_common(3)
    ]
    return jsonify({"summary": {
        "exercise": session.exercise,
        "rep_count": session.rep_count,
        "duration_seconds": round(max(0.0, time.time() - session.started_at), 1),
        "top_mistakes": mistakes,
        "next_focus": mistakes[0]["label"] if mistakes else STEADY_CUES[session.exercise],
    }})


@app.errorhandler(413)
def frame_too_large(_error):
    return jsonify({"error": "图像帧超过服务限制"}), 413
