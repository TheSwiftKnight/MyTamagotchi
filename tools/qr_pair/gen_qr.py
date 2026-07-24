"""生成配对二维码。

用法：
  python gen_qr.py 1                 # 生成 agent 1 的 QR → test_assets/qr_agent_1.png
  python gen_qr.py 1 2 --compose     # 额外合成一张双码测试帧 test_assets/pair_frame.png
"""

import argparse

import qrcode
from PIL import Image

from config import BASE_DIR, QR_PREFIX

OUT_DIR = BASE_DIR / "test_assets"


def make_qr(agent_id: str, box_size: int = 12) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,                                     # 自动取最小版本（载荷短 → 版本1）
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=4,                                         # quiet zone 4 模块
    )
    qr.add_data(f"{QR_PREFIX}{agent_id}")
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


def compose_pair_frame(imgs: list[Image.Image],
                       size: tuple[int, int] = (1920, 1080)) -> Image.Image:
    """把多个 QR 摆到一张灰底帧上，模拟两块板同框的画面。"""
    frame = Image.new("RGB", size, (96, 96, 96))
    n = len(imgs)
    for i, img in enumerate(imgs):
        img = img.resize((360, 360), Image.NEAREST)
        x = (i + 1) * size[0] // (n + 1) - 180
        y = size[1] // 2 - 180
        frame.paste(img, (x, y))
    return frame


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("agent_ids", nargs="+")
    ap.add_argument("--compose", action="store_true", help="合成双码测试帧")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    imgs = []
    for aid in args.agent_ids:
        img = make_qr(aid)
        path = OUT_DIR / f"qr_agent_{aid}.png"
        img.save(path)
        imgs.append(img)
        print(f"生成 {path}（内容 {QR_PREFIX}{aid}）")

    if args.compose:
        frame = compose_pair_frame(imgs)
        path = OUT_DIR / "pair_frame.png"
        frame.save(path)
        print(f"合成测试帧 {path}")


if __name__ == "__main__":
    main()
