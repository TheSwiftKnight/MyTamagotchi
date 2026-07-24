# qr_pair · 二维码识别配对服务

两个人把宠物板（屏显自己 agent 的二维码）一起举到 Insta360 Link 2 Pro 镜头前，
相机在同一画面识别出两个不同的二维码 → 触发配对 → 后端生成相遇对话 + 灵魂契合度 + 技能交换。

```
[板A: QR FW1:<id>] ┐
                   ├→ [Link2 相机] → daemon.py（采集→解码→状态机）→ POST /api/pair → 后端
[板B: QR FW1:<id>] ┘                                                    ↓
                                                     相遇对话 / 契合度 / 技能互学 / 双方记忆
```

## 快速开始

```bash
cd tools/qr_pair
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python download_wechat_models.py     # 下载 CNN 检测模型（可选但强烈建议）

# 确保后端在跑（backend/ 下 uvicorn app.main:app --port 8000）

.venv/bin/python daemon.py                     # 实拍：自动找 Insta360 Link 2
```

⚠️ **相机权限（TCC）**：直跑需要终端有摄像头权限。用 iTerm2 / Terminal 手动跑一次，
在系统弹窗里允许摄像头访问即可。

## 联调（不用相机）

```bash
.venv/bin/python gen_qr.py 1 4 --compose                          # 生成两个 QR + 合成双码测试帧
.venv/bin/python daemon.py --source test_assets/pair_frame.png --once   # 图片回放，触发一次配对后退出
.venv/bin/python daemon.py --source xxx.mp4                        # 视频回放
.venv/bin/python daemon.py --dry-run                               # 只打印事件不上报
.venv/bin/python daemon.py --show                                  # 弹预览窗口（q 退出）
```

## QR 协议

载荷格式 `FW1:<agent_id>`（如 `FW1:3`）。**保持短**——短载荷 = 低版本 QR = 远距离可解。
板端用 LVGL `lv_qrcode` 渲染同样内容即可；纠错等级 M，quiet zone ≥4 模块，配对页停动画、亮度拉满。

## 配对状态机（config.py 可调）

- 滑动窗口 2s 内某载荷出现 ≥3 帧 → 稳定在场
- 两个不同稳定载荷同框 → 触发配对（取出现次数最多的两个，防路人乱入）
- 只有一个稳定载荷 >1.5s → 打印「等待另一位」提示
- 同一对子 60s 冷却（后端另有一层冷却缓存，双保险）

## 解码器三级降级

1. `wechat+cnn`：WeChatQRCode + CNN 模型（models/ 四文件齐全）——实测 480×270 的小码也能双码全解
2. `wechat`：无模型传统管线
3. `opencv`：cv2.QRCodeDetector 兜底

⚠️ 依赖锁 `opencv-contrib-python==4.11.0.86`：OpenCV 5.0 的 wechat_qrcode 模型加载 Python 绑定是坏的。

## 后端接口

`POST /api/pair` `{"payload_a": "FW1:1", "payload_b": "FW1:4", "source": "qr_camera"}`

返回 `{pair_id, agents, lines(相遇对话), resonance{score,reason,topic}, learned(技能互学), cached}`。
LLM 不可用时自动落兜底文案，永不硬失败。配 `backend/.env` 的 `OPENROUTER_API_KEY` 后为真实生成。

## P1 余量（未做，按优先级）

- **云台联动**：`insta360_sdk/sdk/` 里的 UVC PTZ 工具（pan/tilt via `CT_PANTILT_ABSOLUTE_CONTROL`），
  可做「识到单码自动变焦拉近」「一键回合影位」
- **远距离增强**：云端 GPU 训练 YOLOv8n 的 QR 区域检测器 → 导出 ONNX → Mac CPU 推理，
  裁剪放大后再解码，把配对距离推到 3–5 米（云端 GPU 只训练不推理）
- **板端被扫反馈**：后端配对成功后经 MQTT 推 `pairing_ack`，板上宠物挥手
