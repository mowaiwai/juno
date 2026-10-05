from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.models.base import Base

# 导入全部模型，确保 metadata 完整
import app.models.user  # noqa: F401
import app.models.employee  # noqa: F401
import app.models.standard  # noqa: F401
import app.models.standard_snapshot  # noqa: F401
import app.models.application  # noqa: F401
import app.models.review  # noqa: F401
import app.models.ai  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.audit  # noqa: F401
# decisions 随 application 模型一起定义
import app.models.tenant_config  # noqa: F401
import app.models.level_framework  # noqa: F401
import app.models.profile  # noqa: F401
import app.models.inventory  # noqa: F401
import app.models.succession  # noqa: F401
import app.models.idp  # noqa: F401
import app.models.recruit  # noqa: F401
import app.models.gap  # noqa: F401
import app.models.org_diagnosis  # noqa: F401
import app.models.perf  # noqa: F401
import app.models.compensation  # noqa: F401
import app.models.exam  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
