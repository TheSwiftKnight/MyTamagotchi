"""配对状态机：把逐帧解码结果变成可靠的配对事件。

规则（现场体验的核心都在这里）：
- 滑动窗口 WINDOW_SEC 内某载荷出现 ≥ STABLE_FRAMES 次 → 「稳定在场」
- 同时有 ≥2 个稳定载荷 → 取出现次数最多的两个 → 触发 pair
- 只有 1 个稳定载荷持续超过 SINGLE_WAIT_SEC → 触发一次 waiting（提示等另一位）
- 同一对子触发后进入 PAIR_COOLDOWN_SEC 冷却，期间不重复触发
- 载荷相同（自己配自己）不触发
"""

import time
from collections import deque
from dataclasses import dataclass, field

from config import PAIR_COOLDOWN_SEC, SINGLE_WAIT_SEC, STABLE_FRAMES, WINDOW_SEC


@dataclass
class PairEvent:
    kind: str                     # "pair" | "waiting"
    payloads: tuple[str, ...]     # pair: (a, b)；waiting: (a,)
    ts: float = field(default_factory=time.time)


class PairFSM:
    def __init__(self,
                 stable_frames: int = STABLE_FRAMES,
                 window_sec: float = WINDOW_SEC,
                 cooldown_sec: float = PAIR_COOLDOWN_SEC,
                 single_wait_sec: float = SINGLE_WAIT_SEC):
        self.stable_frames = stable_frames
        self.window_sec = window_sec
        self.cooldown_sec = cooldown_sec
        self.single_wait_sec = single_wait_sec
        self._sightings: dict[str, deque[float]] = {}
        self._pair_cooldown: dict[frozenset, float] = {}
        self._single_since: float | None = None   # 「只有一个稳定载荷」状态的开始时间
        self._single_notified: str | None = None  # 已提示过 waiting 的载荷

    def feed(self, payloads: list[str], ts: float | None = None) -> list[PairEvent]:
        ts = ts if ts is not None else time.time()
        events: list[PairEvent] = []

        for p in payloads:
            self._sightings.setdefault(p, deque()).append(ts)

        # 清理窗口外的记录
        cutoff = ts - self.window_sec
        for p in list(self._sightings):
            dq = self._sightings[p]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if not dq:
                del self._sightings[p]

        stable = {p: len(dq) for p, dq in self._sightings.items()
                  if len(dq) >= self.stable_frames}

        if len(stable) >= 2:
            self._single_since = None
            self._single_notified = None
            a, b = sorted(stable, key=stable.get, reverse=True)[:2]
            key = frozenset((a, b))
            last = self._pair_cooldown.get(key, 0.0)
            if ts - last >= self.cooldown_sec:
                self._pair_cooldown[key] = ts
                events.append(PairEvent("pair", (a, b), ts))
        elif len(stable) == 1:
            (p,) = stable
            if self._single_since is None:
                self._single_since = ts
            if (ts - self._single_since >= self.single_wait_sec
                    and self._single_notified != p):
                self._single_notified = p
                events.append(PairEvent("waiting", (p,), ts))
        else:
            self._single_since = None
            self._single_notified = None

        return events
