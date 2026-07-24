"""多二维码检测 + 解码。

三级降级：
1. WeChatQRCode + CNN 模型（models/ 下四个文件齐全时）——远距离/小码最强
2. WeChatQRCode 无模型（传统检测管线）——仍支持多码
3. cv2.QRCodeDetector.detectAndDecodeMulti ——最后兜底
"""

import cv2

from config import MODELS_DIR, QR_PREFIX, WECHAT_MODEL_FILES


class QRDecoder:
    def __init__(self):
        self.backend = "opencv"
        self._wechat = None
        try:
            model_paths = [str(MODELS_DIR / f) for f in WECHAT_MODEL_FILES]
            if all((MODELS_DIR / f).exists() for f in WECHAT_MODEL_FILES):
                self._wechat = cv2.wechat_qrcode_WeChatQRCode(*model_paths)
                self.backend = "wechat+cnn"
            else:
                self._wechat = cv2.wechat_qrcode_WeChatQRCode()
                self.backend = "wechat"
        except Exception:
            self._fallback = cv2.QRCodeDetector()

    def decode(self, frame) -> list[str]:
        """返回本帧解出的全部合法载荷（带 FW1: 前缀的原文），已去重。"""
        return [t for t, _ in self.decode_points(frame)]

    def decode_points(self, frame) -> list[tuple[str, "object"]]:
        """返回 [(载荷, 四角点数组)]，供大屏画识别框。只含合法 FW1: 载荷，已去重。"""
        pairs: list[tuple[str, object]] = []
        if self._wechat is not None:
            res, points = self._wechat.detectAndDecode(frame)
            pairs = list(zip(res, points if points is not None else [None] * len(res)))
        else:
            ok, res, points, _ = self._fallback.detectAndDecodeMulti(frame)
            if ok:
                pairs = [(t, p) for t, p in zip(res, points) if t]
        seen: set[str] = set()
        out = []
        for t, p in pairs:
            if t.startswith(QR_PREFIX) and t not in seen:
                seen.add(t)
                out.append((t, p))
        return out
