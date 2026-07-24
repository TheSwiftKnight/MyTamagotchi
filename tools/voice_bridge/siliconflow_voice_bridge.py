#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SiliconFlow 语音桥接 —— T5-E1 圆屏(Dotti)的语音对话后端

【为什么有这个桥接】
板子固件用裸 TCP HTTP/1.1，只会「发一段 PCM、收一段 PCM」。SiliconFlow 的
key 不能烧进固件(泄露 + 改 key 要重烧)，所以放一个 Mac 侧桥接：
板子 PCM ──> 本桥接 ──(STT/对话/TTS 全走 SiliconFlow)──> PCM 回板子播放。

【设备侧协议 · 与固件写死的一致, 不要改, 否则要重烧固件】
  GET  /ping   -> "pong"
  POST /chat   body = 原始 PCM s16le 16kHz mono(设备麦克风一段话)
               resp = 原始 PCM s16le 16kHz mono(TTS 回答音频)

【流水线 · 全部 SiliconFlow, 无 StepFun】
  PCM(16k) ─包wav→ SenseVoice STT ─文字→ 后端 /api/agents/1/chat(豆豆人设+记忆)
           ─回复→ CosyVoice2 TTS(response_format=pcm, sample_rate=16000) ─PCM→ 板子

【关键点】
- TTS 必须强制 sample_rate=16000：CosyVoice 默认 24000Hz，裸喂 16k 喇叭会变调/像噪声。
- 直接请求 response_format=pcm：拿到的就是板子要的裸 s16le 16k mono，无需剥 wav 头/转码。
- 对话只走共享后端(与手机 app 同人设/同记忆/同心情)。后端不可用时用本地兜底短句 + 仍走
  SiliconFlow TTS 播出来，绝不再退回 StepFun。

用法:
  python3 siliconflow_voice_bridge.py --selftest   # Mac 上闭环自测(不用板子)
  python3 siliconflow_voice_bridge.py              # 起服务 0.0.0.0:8390
"""

import io
import os
import re
import sys
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import requests

# SenseVoice 会输出情绪/事件 emoji(😊😌🎵…), 大模型也爱加 markdown 星号。
# 这些混进对话/ TTS 会造成怪停顿或被读出来, 统一清掉(只留语音该有的字)。
_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF\U00002190-\U000021FF︀-️]"
)


def clean_text(s: str) -> str:
    s = _EMOJI.sub("", s)
    s = s.replace("*", "").replace("#", "").replace("`", "")
    return re.sub(r"\s+", " ", s).strip()

# ────────────────────────── 配置(与后端 .env 同源, 保证全栈同一套 SiliconFlow) ──────────────────────────
def _find_env() -> Path:
    """位置无关地找后端 .env：优先环境变量 MT_BACKEND_ENV，否则从脚本处向上
    逐级找 MyTamagotchi/backend/.env（脚本挪目录也不会断）。"""
    override = os.getenv("MT_BACKEND_ENV")
    if override and Path(override).is_file():
        return Path(override)
    here = Path(__file__).resolve()
    for base in [here.parent, *here.parents]:
        for cand in (base / "MyTamagotchi" / "backend" / ".env",
                     base / "backend" / ".env",
                     base / ".env"):
            if cand.is_file():
                return cand
    return here.parent.parent / "MyTamagotchi" / "backend" / ".env"   # 兜底(可能不存在)


ENV_PATH = _find_env()


def _load_env(path: Path) -> dict:
    env = {}
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"[warn] 读 .env 失败({e}); 用内置默认")
    return env


_E = _load_env(ENV_PATH)

API_KEY = _E.get("LLM_API_KEY") or _E.get("OPENROUTER_API_KEY", "")
BASE_URL = _E.get("LLM_BASE_URL", "https://api.siliconflow.cn/v1/chat/completions")
AUDIO_BASE = BASE_URL.rsplit("/chat/completions", 1)[0]          # -> https://api.siliconflow.cn/v1
STT_MODEL = _E.get("LLM_STT_MODEL", "FunAudioLLM/SenseVoiceSmall")
TTS_MODEL = _E.get("LLM_TTS_MODEL", "FunAudioLLM/CosyVoice2-0.5B")
TTS_VOICE = _E.get("LLM_TTS_VOICE", "FunAudioLLM/CosyVoice2-0.5B:anna")
HDR = {"Authorization": f"Bearer {API_KEY}"}

# 共享后端(MyTamagotchi FastAPI)：agent 1 = 豆豆/Dotti。板子聊的天写进后端记忆, 手机可见。
BACKEND_CHAT = "http://127.0.0.1:8000/api/agents/1/chat"

SPK_RATE = 16000                    # 板子喇叭采样率(固件 cfg.spk_sample_rate = 16K)
FALLBACK_LINE = "我在呢，不过脑子有点转不过来，等下再聊好吗？汪。"   # 后端不可用时的本地兜底


# ────────────────────────── 音频工具 ──────────────────────────
def pcm_to_wav(pcm: bytes, rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def silence(ms: int) -> bytes:
    return b"\x00" * int(SPK_RATE * 2 * ms / 1000)


# ────────────────────────── SiliconFlow STT ──────────────────────────
def asr(pcm: bytes) -> str:
    t0 = time.time()
    r = requests.post(
        f"{AUDIO_BASE}/audio/transcriptions",
        headers=HDR,
        files={"file": ("audio.wav", pcm_to_wav(pcm), "audio/wav")},
        data={"model": STT_MODEL},
        timeout=30,
    )
    r.raise_for_status()
    text = clean_text(r.json().get("text") or "")
    print(f"  [stt {time.time()-t0:.1f}s · SenseVoice] {text!r}")
    return text


# ────────────────────────── 对话(只走后端, 无 StepFun) ──────────────────────────
def chat(text: str) -> str:
    t0 = time.time()
    try:
        r = requests.post(BACKEND_CHAT, json={"text": text}, timeout=40)
        r.raise_for_status()
        reply = (r.json().get("reply") or "").strip()
        if reply:
            print(f"  [chat {time.time()-t0:.1f}s · 后端豆豆] {reply!r}")
            return reply
        print("  [chat] 后端回复为空 -> 用本地兜底短句")
    except Exception as e:
        print(f"  [chat] 后端不可用({type(e).__name__}: {str(e)[:80]}) -> 本地兜底短句(不退StepFun)")
    return FALLBACK_LINE


# ────────────────────────── SiliconFlow TTS(强制 16k 裸 PCM) ──────────────────────────
def tts(text: str) -> bytes:
    t0 = time.time()
    r = requests.post(
        f"{AUDIO_BASE}/audio/speech",
        headers=HDR,
        json={
            "model": TTS_MODEL,
            "input": text,
            "voice": TTS_VOICE,
            "response_format": "pcm",      # 裸 s16le, 无头
            "sample_rate": SPK_RATE,       # ★ 必须 16k, 否则板子播放变调/噪声
        },
        timeout=40,
    )
    r.raise_for_status()
    ct = r.headers.get("Content-Type", "")
    data = r.content
    # 兜底：万一某天 pcm 不被支持而退回 wav, 剥掉 RIFF 头取 data 段
    if data[:4] == b"RIFF":
        idx = data.find(b"data")
        data = data[idx + 8:] if idx != -1 else data[44:]
    print(f"  [tts {time.time()-t0:.1f}s · CosyVoice2 {ct}] {len(data)//32}ms 音频@16k")
    return data


# ────────────────────────── 流水线 ──────────────────────────
def pipeline(pcm_in: bytes) -> bytes:
    dur_ms = len(pcm_in) // 32
    # 太短(板子开机探活 "x" / 误触)：快速回一小段静音, 不浪费 STT/TTS
    if dur_ms < 300:
        print(f"[chat] {dur_ms}ms 过短(探活/误触) -> 回静音")
        return silence(120)
    print(f"[chat] 收到 {dur_ms}ms 音频")
    text = asr(pcm_in)
    if not text:
        return tts("我没听清，再说一遍好吗？汪。")
    reply = chat(text)
    return tts(clean_text(reply))


# ────────────────────────── HTTP 服务(协议与固件写死一致) ──────────────────────────
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/ping":
            body = b"pong"
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/chat":
            self.send_response(404)
            self.end_headers()
            return
        n = int(self.headers.get("Content-Length", 0))
        pcm_in = self.rfile.read(n)
        try:
            pcm_out = pipeline(pcm_in)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(pcm_out)))
            self.end_headers()
            self.wfile.write(pcm_out)
        except Exception as e:
            print("[err]", type(e).__name__, str(e)[:200])
            self.send_response(500)
            self.end_headers()


def selftest():
    print("=== SiliconFlow 语音链路自测(无板子) ===")
    print(f"  key={'有' if API_KEY else '缺!'}  audio_base={AUDIO_BASE}")
    print(f"  stt={STT_MODEL}  tts={TTS_MODEL}  voice={TTS_VOICE}")
    t0 = time.time()
    print("1) 先用 TTS 造一句『你好呀，我今天上班有点累，想跟你聊聊天』当作用户语音…")
    user_pcm = tts("你好呀，我今天上班有点累，想跟你聊聊天，你能安慰安慰我吗？")
    print(f"   造出 {len(user_pcm)//32}ms 音频")
    print("2) 全流水线: STT → 后端豆豆对话 → TTS")
    out = pipeline(user_pcm)
    print(f"✅ 闭环 OK, 总耗时 {time.time()-t0:.1f}s, 回答音频 {len(out)//32}ms @16k")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        if not API_KEY:
            print("[FATAL] 没读到 SiliconFlow key(LLM_API_KEY), 检查", ENV_PATH)
            sys.exit(1)
        print(f"SiliconFlow bridge on 0.0.0.0:8390")
        print(f"  stt={STT_MODEL}  chat=后端 agent1(豆豆)  tts={TTS_MODEL}@16k pcm")
        ThreadingHTTPServer(("0.0.0.0", 8390), H).serve_forever()
