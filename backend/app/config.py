from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Juno 后端配置。环境变量前缀 JUNO_，可放 .env。"""

    app_name: str = "Juno"
    secret_key: str = "dev-secret-change-me-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/juno"
    storage_dir: str = "storage"
    evidence_max_size: int = 10 * 1024 * 1024
    evidence_max_per_item: int = 3

    # 登录限流：同一邮箱每分钟最大尝试次数（按邮箱+客户端 IP 双维度计数）
    login_rate_limit_per_minute: int = 10

    # 内置定时调度：每日推进超期单与催办（多进程用 pg advisory lock 去重）
    scheduler_enabled: bool = True

    # 首个租户/租户管理员的幂等初始化（仅在四项均非空时执行）
    init_tenant_name: str = ""
    init_admin_name: str = ""
    init_admin_email: str = ""
    init_admin_password: str = ""

    # 国内合规模型直连（OpenAI 兼容协议；通义/DeepSeek 均支持）
    llm_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"
    llm_api_key: str = ""
    llm_timeout_seconds: float = 60.0
    ai_max_attempts: int = 3

    model_config = SettingsConfigDict(env_file=".env", env_prefix="JUNO_")

    # CORS 允许来源（逗号分隔）；本地联调默认放行 Vite
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
