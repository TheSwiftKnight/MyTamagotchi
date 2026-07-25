"""拍照 → ForkWorld 风格角色 pipeline（对齐原 Node pet-pipeline 的 API 形状）。

流程：上传原图 → gemini 图生图（吉祥物风格 + 纯绿幕背景）→ PIL 色键去背 → 注册成 Agent。
Job 存内存 + 磁盘（uploads/pets/{job_id}/），注册资产列入 index.json。
"""

import asyncio
import base64
import io
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from sqlmodel import Session

from . import llm
from .db import engine
from .models import Agent, Memory

PETS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "pets"
INDEX_PATH = PETS_DIR / "index.json"

SUBJECT_STYLE_PROMPT = (
    "Transform the dominant subject of this photo into a cute ForkWorld mascot character: "
    "flat pastel colors, bold clean outlines, simple rounded shapes, subtle pixel-art flavor, "
    "full uncropped body centered with generous padding, front facing, friendly expression "
    "(add simple dot eyes and a tiny smile if the subject is an object). "
    "Keep the subject's original category and identity recognizable. "
    "The background MUST be a single flat opaque chroma green #00FF00 with nothing else on it. "
    "Exactly one subject, no text, no watermark."
)

LINE_ART_STYLE_PROMPT = (
    "Draw the subject as a cute hand-drawn LINE-ART character in ForkWorld style: "
    "clean bold dark ink outlines, minimal flat shading, mostly uncolored paper-white body, "
    "simple rounded shapes, front facing, friendly dot eyes and a tiny smile, "
    "full uncropped body centered with generous padding. "
    "Keep the subject's original category and identity recognizable. "
    "The background MUST be a single flat opaque chroma green #00FF00 with nothing else on it. "
    "Exactly one subject, no text, no watermark."
)

JOBS: dict[str, dict] = {}

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 12 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _job_dir(job_id: str) -> Path:
    d = PETS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _persist(job: dict) -> None:
    (_job_dir(job["id"]) / "job.json").write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")


def _load_index() -> list[dict]:
    if INDEX_PATH.exists():
        try:
            return json.loads(INDEX_PATH.read_text(encoding="utf-8")).get("assets", [])
        except Exception:
            return []
    return []


def _save_index(assets: list[dict]) -> None:
    PETS_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps({"assets": assets}, ensure_ascii=False), encoding="utf-8")


def load_jobs_from_disk() -> None:
    """启动时恢复 job（崩溃时残留的进行中 job 标记为 failed 以便 retry）。"""
    if not PETS_DIR.exists():
        return
    for jf in PETS_DIR.glob("pet-*/job.json"):
        try:
            job = json.loads(jf.read_text(encoding="utf-8"))
        except Exception:
            continue
        if job.get("status") in ("queued", "processing"):
            job["status"] = "failed"
            job["stage"] = "failed"
            job["error"] = "服务器重启中断了处理，请点击重试"
            _persist(job)
        JOBS[job["id"]] = job


def chroma_key_remove(png_bytes: bytes) -> bytes:
    """把纯绿背景变透明并去除边缘绿色溢出。"""
    img = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if g > 110 and g > r * 1.35 and g > b * 1.35:
                px[x, y] = (0, 0, 0, 0)
            elif g > max(r, b):  # 去绿色溢出
                px[x, y] = (r, max(r, b), b, a)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


async def generate_line_art(subject: str, source_data_url: str | None = None) -> str | None:
    """用 capture 管线（风格化 → 色键去背）生成线条风角色图。

    subject: 文字描述（如 "一只叫豆豆的狗"）；source_data_url 可选参考图。
    成功返回可访问的 /api/pets/{gen_id}/files/final URL，失败返回 None。
    """
    prompt = LINE_ART_STYLE_PROMPT if source_data_url else (
        f"{LINE_ART_STYLE_PROMPT}\nSubject to draw: {subject}."
    )
    raw = await llm.generate_image(prompt, source_data_url)
    if not raw or not raw.startswith("data:"):
        return None
    header, b64 = raw.split(",", 1)
    img_bytes = base64.b64decode(b64)
    if not header.startswith("data:image/png"):
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_bytes = buf.getvalue()
    final_bytes = await asyncio.to_thread(chroma_key_remove, img_bytes)
    gen_id = f"lineart-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
    (_job_dir(gen_id) / "final.png").write_bytes(final_bytes)
    return f"/api/pets/{gen_id}/files/final"


async def process(job_id: str) -> None:
    job = JOBS[job_id]
    d = _job_dir(job_id)
    try:
        source_path = next(d.glob("source.*"))
        mime = job.get("mime", "image/png")
        data_url = f"data:{mime};base64,{base64.b64encode(source_path.read_bytes()).decode()}"

        job.update(status="processing", stage="stylize", progress=28, updatedAt=_now_iso())
        _persist(job)
        clean = await llm.generate_image(SUBJECT_STYLE_PROMPT, data_url)
        if not clean or not clean.startswith("data:"):
            raise RuntimeError("风格化生成失败（图像模型无返回），请重试")
        header, b64 = clean.split(",", 1)
        clean_bytes = base64.b64decode(b64)
        if not header.startswith("data:image/png"):
            clean_bytes_img = Image.open(io.BytesIO(clean_bytes)).convert("RGBA")
            buf = io.BytesIO()
            clean_bytes_img.save(buf, format="PNG")
            clean_bytes = buf.getvalue()
        (d / "clean.png").write_bytes(clean_bytes)

        job.update(stage="remove-background", progress=68, updatedAt=_now_iso())
        _persist(job)
        final_bytes = await asyncio.to_thread(chroma_key_remove, clean_bytes)
        (d / "final.png").write_bytes(final_bytes)

        job.update(stage="register", progress=92, updatedAt=_now_iso())
        _persist(job)
        job["asset"] = {
            "id": job_id,
            "name": job["name"],
            "role": "萌化陪伴 Agent",
            "world": "Memory Town",
            "color": "#E8634A",
            "sourceUrl": f"/api/pets/{job_id}/files/source",
            "cleanUrl": f"/api/pets/{job_id}/files/clean",
            "finalUrl": f"/api/pets/{job_id}/files/final",
            "stylizeProvider": f"openrouter:{llm.IMG_MODEL}",
            "removeBackgroundProvider": "local:chroma-key",
            "promptVersion": "forkworld-subject-v3",
            "backgroundColor": "#00FF00",
            "outputFormat": "image/png",
            "createdAt": job["createdAt"],
        }
        job.update(status="ready", stage="complete", progress=100, updatedAt=_now_iso())
        _persist(job)
    except Exception as e:
        job.update(status="failed", stage="failed", error=str(e), updatedAt=_now_iso())
        _persist(job)


def submit(data: bytes, mime: str, name: str, filename: str) -> dict:
    if not data:
        raise ValueError("空文件")
    if len(data) > MAX_BYTES:
        raise ValueError("图片太大（上限 12MB）")
    if mime not in ALLOWED_MIME:
        raise ValueError(f"不支持的图片格式：{mime}")
    job_id = f"pet-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime]
    d = _job_dir(job_id)
    (d / f"source{ext}").write_bytes(data)
    job = {
        "id": job_id,
        "name": name or "新伙伴",
        "filename": filename,
        "mime": mime,
        "status": "queued",
        "stage": "upload",
        "progress": 8,
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    JOBS[job_id] = job
    _persist(job)
    asyncio.get_event_loop().create_task(process(job_id))
    return job


def retry(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise KeyError("job not found")
    job.update(status="queued", stage="upload", progress=8, error=None, updatedAt=_now_iso())
    _persist(job)
    asyncio.get_event_loop().create_task(process(job_id))
    return job


async def register(job_id: str, owner_id: int = 1, location: str = "vitality-gym-town") -> dict:
    """注册：生成人设 → 建 Agent（进 inventory 日常精灵）→ 记入 index。"""
    job = JOBS.get(job_id)
    if not job or job.get("status") != "ready":
        raise ValueError("job 尚未就绪")
    assets = _load_index()
    existing = next((a for a in assets if a["id"] == job_id), None)
    if existing:
        return existing

    persona = await llm.chat_json([
        {"role": "system", "content": "你为像素宠物世界的新角色生成人设。只输出 JSON。"},
        {"role": "user", "content": (
            f"角色名字：{job['name']}。生成 JSON：{{\"trait\": \"20字以内性格\", "
            f"\"personality\": [\"三个\", \"性格\", \"关键词\"], \"temperament\": \"10字气质描述\", "
            f"\"greeting\": \"25字初次见面台词\"}}"
        )},
    ]) or {}
    asset = dict(job["asset"])
    asset["personality"] = persona.get("personality", ["温柔", "好奇", "陪伴"])
    asset["temperament"] = persona.get("temperament", "温暖粘人的小伙伴")
    asset["registeredAt"] = _now_iso()

    with Session(engine) as session:
        agent = Agent(
            owner_id=owner_id,
            name=job["name"],
            image=asset["finalUrl"],
            trait=persona.get("trait", "刚被拍进世界的新伙伴"),
            mood=90,
            location=location,
        )
        session.add(agent)
        session.commit()
        session.refresh(agent)
        session.add(Memory(agent_id=agent.id, kind="camera",
                           content=f"主人拍下了我，我变成了 ForkWorld 的一员！{persona.get('greeting', '')}"))
        session.commit()
        asset["agentId"] = agent.id

    assets.insert(0, asset)
    _save_index(assets)
    job["asset"] = asset
    _persist(job)
    return asset


def list_assets() -> list[dict]:
    return _load_index()
