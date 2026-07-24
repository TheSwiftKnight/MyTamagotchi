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
        texts: list[str] = []
        if self._wechat is not None:
            res, _points = self._wechat.detectAndDecode(frame)
            texts = list(res)
        else:
            ok, res, _points, _ = self._fallback.detectAndDecodeMulti(frame)
            if ok:
                texts = [t for t in res if t]
        valid = [t for t in texts if t.startswith(QR_PREFIX)]
        return list(dict.fromkeys(valid))
