"""下载 WeChatQRCode 的 CNN 检测/超分模型（可选增强，缺失时 decoder 自动降级）。"""

import sys

import httpx

from config import MODELS_DIR, WECHAT_MODEL_FILES

BASE = "https://raw.githubusercontent.com/WeChatCV/opencv_3rdparty/wechat_qrcode/"


def main():
    MODELS_DIR.mkdir(exist_ok=True)
    for name in WECHAT_MODEL_FILES:
        dst = MODELS_DIR / name
        if dst.exists():
            print(f"已存在 {name}")
            continue
        try:
            resp = httpx.get(BASE + name, timeout=60, follow_redirects=True)
            resp.raise_for_status()
            dst.write_bytes(resp.content)
            print(f"下载完成 {name}（{len(resp.content) // 1024} KB）")
        except Exception as e:
            print(f"下载 {name} 失败: {e}（不影响使用，decoder 会降级传统算法）",
                  file=sys.stderr)


if __name__ == "__main__":
    main()
