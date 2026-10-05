"""金额精度工具（NFR-6）：最终金额四舍五入到分，缩放/折算系数保留 4 位小数。

DB 列虽为 Numeric，但 SQLAlchemy 经 SQLite 测试链路可能返回 float/int，
统一以 Decimal(str(v)) 入算，规避 float 二进制误差与银行家舍入。
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

_CENT = Decimal("0.01")
_RATIO = Decimal("0.0001")
_ONE = Decimal("1")


def money(value) -> float:
    """四舍五入到分，返回 float（JSON 序列化友好）。"""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(_CENT, rounding=ROUND_HALF_UP))


def yuan(value) -> int:
    """月薪按元取整（四舍五入）。"""
    return int(Decimal(str(value)).quantize(_ONE, rounding=ROUND_HALF_UP))


def ratio4(value) -> float:
    """缩放/折算系数保留 4 位小数（四舍五入）。"""
    return float(Decimal(str(value)).quantize(_RATIO, rounding=ROUND_HALF_UP))
