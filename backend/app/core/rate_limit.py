"""轻量内存固定窗口限流（单实例 MVP）。

多 worker 部署时各进程独立计数，限流精度放宽但仍有保护；
如需精确全局限流，后续可替换为 Redis 实现（hit/reset 接口保持不变）。
"""
import threading
import time


class FixedWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: float = 60.0) -> bool:
        """计数一次；未超限返回 True，超限返回 False。"""
        now = time.monotonic()
        with self._lock:
            count, window_start = self._hits.get(key, (0, now))
            if now - window_start >= window_seconds:
                count, window_start = 0, now
            count += 1
            self._hits[key] = (count, window_start)
            return count <= limit

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


# 登录端点专用限流器（按账号 / 按客户端 IP 双维度）
login_limiter = FixedWindowRateLimiter()
