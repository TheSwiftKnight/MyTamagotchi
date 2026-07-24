# 语音桥接 · siliconflow_voice_bridge.py

T5-E1 圆屏(Dotti)硬件的语音对话后端。板子用裸 TCP，只会「发一段 PCM、收一段 PCM」；
SiliconFlow 的 key 不能烧进固件，所以用这个 Mac 侧桥接中转。

## 链路（全 SiliconFlow，无 StepFun）

```
板子麦克风 PCM(16k s16le mono)
   │  POST /chat  (裸 TCP HTTP/1.1, Connection: close)
   ▼
[本桥接 :8390]
   ├─ SenseVoice STT ────────────► 文字
   ├─ 后端 /api/agents/1/chat ───► 豆豆人设+记忆回复（与手机 app 同一个大脑）
   └─ CosyVoice2 TTS(pcm@16000) ─► 回答 PCM
   │  resp body = PCM(16k s16le mono)
   ▼
板子喇叭播放
```

## 关键点

- **TTS 必须 `sample_rate=16000`**：CosyVoice 默认 24000Hz，裸喂 16k 喇叭会变调/像噪声。
- **直接请求 `response_format=pcm`**：拿到就是板子要的裸 s16le 16k mono，无需剥 wav 头/转码。
- **对话只走共享后端**：板子聊天写进后端记忆，手机 app 可见。后端不可用时用本地兜底短句
  （仍走 SiliconFlow TTS 播出来），**绝不退回 StepFun**。
- 配置与后端 `MyTamagotchi/backend/.env` 同源（`LLM_API_KEY` / `LLM_*_MODEL`），自动向上查找。
- **`X-Reply` 响应头带回真实回复文本**：body 仍是纯 PCM（播放不受影响），回复文字用 HTTP 头
  `X-Reply`（UTF-8 字节走 latin-1 通道原样上线）单独带回，板子解析后显示到屏幕气泡，
  这样屏幕不再是写死的占位文案，而是「你说什么、它答什么」。固件缓冲 512B，桥接裁到 500B。

## 设备侧协议（与固件写死一致，改动需重烧固件）

| 方法 | 路径 | body / resp |
|---|---|---|
| GET | `/ping` | → `pong` |
| POST | `/chat` | body=PCM s16le 16k mono；resp=PCM s16le 16k mono；resp 头 `X-Reply:` 带回答文本(UTF-8) |

固件里对应：`BRIDGE_IP:8390`，见
`TuyaOpen/examples/graphics/lvgl_label/src/example_lvgl_label.c`。

## 用法

```bash
# 自测（不用板子，闭环 STT→对话→TTS）
python3 siliconflow_voice_bridge.py --selftest

# 起服务（板子连它）
python3 siliconflow_voice_bridge.py         # 0.0.0.0:8390
```

前置：后端 `uvicorn app.main:app` 已在 `127.0.0.1:8000` 运行。
