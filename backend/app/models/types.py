import uuid
from datetime import timezone

from sqlalchemy import DateTime, JSON
from sqlalchemy.types import TypeDecorator


class GUIDList(TypeDecorator):
    """JSON 列中存 UUID 列表：写入转字符串，读出还原 UUID。

    SQLite 的 json 不支持 UUID；PostgreSQL 的 jsonb 同样需要显式文本化，
    因此两端统一用该类型。
    """

    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return [str(v) for v in value]

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return [uuid.UUID(v) for v in value]


class UTCDateTime(TypeDecorator):
    """跨后端统一的 UTC 时间类型。

    - 写入：aware → 转 UTC 后去掉 tzinfo 存储；naive 视为 UTC
    - 读出：统一补 tzinfo=UTC 返回 aware
    SQLite 原生不保留时区，PostgreSQL 侧也保证应用口径一致。
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
