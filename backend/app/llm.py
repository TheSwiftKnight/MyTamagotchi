"""OpenRouter chat helper. Falls back to canned replies when the API is
unavailable so the demo never hard-fails."""

import json
import os
import random
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# 供应商无关：默认 OpenRouter；用 LLM_* 环境变量可切到 SiliconFlow / OpenAI 等任意 OpenAI 兼容接口
API_KEY = os.getenv("LLM_API_KEY") or os.getenv("OPENROUTER_API_KEY", "")
MODEL = os.getenv("LLM_MODEL") or os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1/chat/completions")
_fb = os.getenv("LLM_FALLBACK_MODELS")
FALLBACK_MODELS = (
    [m.strip() for m in _fb.split(",") if m.strip()] if _fb is not None else [
        "nvidia/nemotron-3-nano-30b-a3b:free",
        "google/gemma-4-26b-a4b-it:free",
        "openai/gpt-oss-20b:free",
    ]
)

FALLBACK_LINES = [
    "（伸了个懒腰）你回来啦！",
    "唔……我刚刚打了个盹，你说什么？",
    "今天也要加油哦！",
    "我把这件事记在心里了。",
]


VL_MODEL = os.getenv("OPENROUTER_VL_MODEL", "nvidia/nemotron-nano-12b-v2-vl:free")
IMG_MODEL = os.getenv("OPENROUTER_IMG_MODEL", "google/gemini-3.1-flash-lite-image")

# 语音（STT/TTS）——OpenAI 兼容音频接口（如 SiliconFlow）。audio base 从 chat base 推导。
AUDIO_BASE = BASE_URL.rsplit("/chat/completions", 1)[0]
STT_MODEL = os.getenv("LLM_STT_MODEL", "FunAudioLLM/SenseVoiceSmall")
TTS_MODEL = os.getenv("LLM_TTS_MODEL", "FunAudioLLM/CosyVoice2-0.5B")
TTS_VOICE = os.getenv("LLM_TTS_VOICE", "FunAudioLLM/CosyVoice2-0.5B:anna")


async def transcribe(data: bytes, filename: str = "audio.webm") -> str:
    """语音转文字（STT）。缺 key / 失败时返回空串。"""
    if not API_KEY or not data:
        return ""
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{AUDIO_BASE}/audio/transcriptions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                files={"file": (filename, data)},
                data={"model": STT_MODEL},
            )
            resp.raise_for_status()
            return (resp.json().get("text") or "").strip()
    except Exception:
        return ""


async def synthesize(text: str) -> bytes | None:
    """文字转语音（TTS），返回 mp3 字节。缺 key / 失败时返回 None。"""
    if not API_KEY or not text:
        return None
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{AUDIO_BASE}/audio/speech",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={"model": TTS_MODEL, "input": text, "voice": TTS_VOICE,
                      "response_format": "mp3"},
            )
            resp.raise_for_status()
            return resp.content
    except Exception:
        return None


async def generate_image(prompt: str, image_data_url: str | None = None) -> str | None:
    """生成图片，返回 data:image/...;base64,... 或 None。可传参考图做 image-to-image。"""
    if not API_KEY:
        return None
    content: list[dict] = [{"type": "text", "text": prompt}]
    if image_data_url:
        content.append({"type": "image_url", "image_url": {"url": image_data_url}})
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                BASE_URL,
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": IMG_MODEL,
                    "modalities": ["image", "text"],
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": 4000,
                },
            )
            resp.raise_for_status()
            msg = resp.json()["choices"][0]["message"]
            images = msg.get("images") or []
            if images:
                return images[0]["image_url"]["url"]
    except Exception:
        pass
    return None


async def chat(messages: list[dict], max_tokens: int = 400, temperature: float = 0.9,
               model: str | None = None) -> str:
    if not API_KEY:
        return random.choice(FALLBACK_LINES)
    models = [model] if model else [MODEL, *FALLBACK_MODELS]
    async with httpx.AsyncClient(timeout=120) as client:
        for model in models:
            try:
                resp = await client.post(
                    BASE_URL,
                    headers={
                        "Authorization": f"Bearer {API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"].strip()
                if text:
                    return text
            except Exception:
                continue
    return random.choice(FALLBACK_LINES)


# 免费模型长 JSON 输出偶尔崩坏，最后兜底用便宜的付费文字模型保证可解析
JSON_RESCUE_MODEL = os.getenv("LLM_JSON_RESCUE_MODEL") or os.getenv("OPENROUTER_JSON_RESCUE_MODEL", MODEL)


def _parse_json(raw: str) -> dict | list | None:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    start = min([i for i in (text.find("{"), text.find("[")) if i != -1], default=-1)
    if start == -1:
        return None
    end = max(text.rfind("}"), text.rfind("]"))
    try:
        return json.loads(text[start : end + 1])
    except Exception:
        return None


async def chat_json(messages: list[dict], max_tokens: int = 600) -> dict | list | None:
    """Ask for JSON output and parse it; retries down the model chain until it parses."""
    for model in [MODEL, *FALLBACK_MODELS, JSON_RESCUE_MODEL]:
        raw = await chat(messages, max_tokens=max_tokens, temperature=0.7, model=model)
        parsed = _parse_json(raw)
        if parsed is not None:
            return parsed
    return None
