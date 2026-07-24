"""qr_pair 配置：所有可调参数集中在这里。"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# ---------- 相机 ----------
CAMERA_NAME = "Insta360 Link 2"   # avfoundation 设备名（Link 2 Pro 也显示为这个名字）
FRAME_WIDTH = 1920
FRAME_HEIGHT = 1080
DECODE_FPS = 15                   # 解码帧率上限（采集 30fps，隔帧解码足够）

# ---------- QR 协议 ----------
QR_PREFIX = "FW1:"                # 载荷格式：FW1:<agent_id>，越短越好（低版本 QR 远距离可解）

# ---------- 配对状态机 ----------
STABLE_FRAMES = 3                 # 同一载荷在窗口内出现 ≥N 帧视为「稳定在场」
WINDOW_SEC = 2.0                  # 稳定性判定滑动窗口
PAIR_COOLDOWN_SEC = 60.0          # 同一对子触发后的冷却时间
SINGLE_WAIT_SEC = 1.5             # 单个稳定载荷持续超过该时长 → 提示「等待另一位」

# ---------- 后端 ----------
BACKEND_URL = "http://127.0.0.1:8000"
PAIR_ENDPOINT = "/api/pair"

# ---------- WeChatQRCode CNN 模型（可选，缺失时自动降级传统算法） ----------
MODELS_DIR = BASE_DIR / "models"
WECHAT_MODEL_FILES = [
    "detect.prototxt",
    "detect.caffemodel",
    "sr.prototxt",
    "sr.caffemodel",
]
