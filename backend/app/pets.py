"""拍照 → ForkWorld 风格角色 pipeline。

服务器只保存带访问令牌的短期处理任务。浏览器下载三张结果图后会删除
任务；放弃的任务 30 分钟后自动清理，不注册进共享 Agent 数据库。
"""

import asyncio
import base64
import io
import json
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from . import llm

PETS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "pets"

SUBJECT_STYLE_PROMPT = (
    "Transform the dominant subject of this photo into a cute ForkWorld mascot character: "
    "flat pastel colors, bold clean outlines, simple rounded shapes, subtle pixel-art flavor, "
    "full uncropped body centered with generous padding, front facing, friendly expression "
    "(add simple dot eyes and a tiny smile if the subject is an object). "
    "Keep the subject's original category and identity recognizable. "
    "The background MUST be a single flat opaque chroma green #00FF00 with nothing else on it. "
    "Exactly one subject, no text, no watermark."
)

JOBS: dict[str, dict] = {}
EXPIRY_HANDLES: dict[str, asyncio.TimerHandle] = {}

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_BYTES = 12 * 1024 * 1024
JOB_TTL_SECONDS = 30 * 60


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _job_dir(job_id: str) -> Path:
    d = PETS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _persist(job: dict) -> None:
    (_job_dir(job["id"]) / "job.json").write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")


def load_jobs_from_disk() -> None:
    """服务重启时清除全部临时任务，不恢复成共享资产。"""
    JOBS.clear()
    for handle in EXPIRY_HANDLES.values():
        handle.cancel()
    EXPIRY_HANDLES.clear()
    shutil.rmtree(PETS_DIR, ignore_errors=True)
    PETS_DIR.mkdir(parents=True, exist_ok=True)


def public_job(job: dict) -> dict:
    keys = ("id", "accessToken", "name", "status", "stage", "progress",
            "createdAt", "updatedAt", "error", "asset")
    return {key: job[key] for key in keys if key in job and job[key] is not None}


def get_job(job_id: str, access_token: str) -> dict | None:
    job = JOBS.get(job_id)
    return public_job(job) if job and job.get("accessToken") == access_token else None


def release(job_id: str, access_token: str) -> bool:
    job = JOBS.get(job_id)
    if not job or job.get("accessToken") != access_token:
        return False
    handle = EXPIRY_HANDLES.pop(job_id, None)
    if handle:
        handle.cancel()
    JOBS.pop(job_id, None)
    shutil.rmtree(PETS_DIR / job_id, ignore_errors=True)
    return True


def _schedule_expiry(job: dict) -> None:
    previous = EXPIRY_HANDLES.pop(job["id"], None)
    if previous:
        previous.cancel()
    EXPIRY_HANDLES[job["id"]] = asyncio.get_event_loop().call_later(
        JOB_TTL_SECONDS, release, job["id"], job["accessToken"]
    )


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

        job.update(stage="localize", progress=92, updatedAt=_now_iso())
        _persist(job)
        token = job["accessToken"]
        job["asset"] = {
            "id": job_id,
            "name": job["name"],
            "role": "萌化陪伴 Agent",
            "world": "Memory Town",
            "color": "#E8634A",
            "sourceUrl": f"/api/pets/{job_id}/files/source?accessToken={token}",
            "cleanUrl": f"/api/pets/{job_id}/files/clean?accessToken={token}",
            "finalUrl": f"/api/pets/{job_id}/files/final?accessToken={token}",
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
    ext = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "image/heic": ".heic", "image/heif": ".heif",
    }[mime]
    d = _job_dir(job_id)
    (d / f"source{ext}").write_bytes(data)
    job = {
        "id": job_id,
        "accessToken": str(uuid.uuid4()),
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
    _schedule_expiry(job)
    asyncio.get_event_loop().create_task(process(job_id))
    return public_job(job)


def retry(job_id: str, access_token: str) -> dict:
    job = JOBS.get(job_id)
    if not job or job.get("accessToken") != access_token:
        raise KeyError("job not found")
    job.update(status="queued", stage="upload", progress=8, error=None, updatedAt=_now_iso())
    _persist(job)
    _schedule_expiry(job)
    asyncio.get_event_loop().create_task(process(job_id))
    return public_job(job)


def resolve_file(job_id: str, stage: str, access_token: str) -> Path | None:
    job = JOBS.get(job_id)
    if not job or job.get("accessToken") != access_token:
        return None
    d = PETS_DIR / job_id
    if stage == "source":
        matches = list(d.glob("source.*"))
        return matches[0] if matches else None
    path = d / f"{stage}.png"
    return path if stage in ("clean", "final") and path.exists() else None
