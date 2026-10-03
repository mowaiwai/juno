"""AI 出题/评审意见生成服务。

链路（MVP 防错链）：
  幂等检查 → 写 pending → 配额熔断检查 → 构造上下文 prompt
  → LLM 调用 → JSON 解析与质量门 → 成功落产出+计量；失败按预算重试 → failed
"""
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.models.ai import AISuggestion, AIUsage
from app.models.application import (
    Application,
    ApplicationStatus,
    Evidence,
)
from app.models.standard_snapshot import StandardSnapshot
from app.models.tenant_config import DEFAULT_TENANT_CONFIG, TenantConfig
from app.services.llm import get_client

FEATURE = "certification_questions"


# ---- 租户配置 ----

def _tenant_config(db: Session, tenant_id) -> dict:
    row = db.get(TenantConfig, tenant_id)
    config = dict(DEFAULT_TENANT_CONFIG)
    if row and row.values:
        config.update(row.values)
    return config


def _ai_settings(config: dict) -> dict:
    """模型连接与配额：租户配置覆盖全局环境变量。"""
    return {
        "base_url": config.get("ai_base_url") or settings.llm_base_url,
        "api_key": config.get("ai_api_key") or settings.llm_api_key,
        "model": config.get("ai_model") or settings.llm_model,
        # None / 缺省 = 不限配额
        "monthly_token_quota": config.get("ai_monthly_token_quota"),
    }


def _month_used(db: Session, tenant_id) -> int:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = db.scalar(
        select(func.coalesce(func.sum(AIUsage.total_tokens), 0)).where(
            AIUsage.tenant_id == tenant_id,
            AIUsage.created_at >= month_start,
        )
    )
    return int(total or 0)


# ---- Prompt 构造 ----

_SYSTEM_PROMPT = (
    "你是企业内部职级认证评审的 AI 助手。你的产出仅供评审组长参考，不构成结论。"
    "请严格只输出一个 JSON 对象，不要输出 JSON 以外的任何文字，格式：\n"
    '{"questions": ["面试题1","面试题2","面试题3"], "opinion": "一段评审意见"}\n'
    "要求：恰好 3 道面试题；题目必须结合认证标准项与员工举证材料，"
    "面向达标边界提出可在面试中验证的具体问题，避免空泛；opinion 给出材料充分性与"
    "需重点核查点。"
)


def _build_user_message(
    application: Application,
    snapshot: StandardSnapshot,
    evidences: list[Evidence],
) -> str:
    set_meta = snapshot.payload["set"]
    lines = [
        f"目标序列/职级：{set_meta['sequence']} / {set_meta['target_grade']}",
        "认证标准项：",
    ]
    for item in snapshot.payload["items"]:
        lines.append(
            f"- [{item['code']}] {item['name']}（权重 {item['weight']}）："
            f"{item['description']}；达标要求：{item['requirement']}"
        )

    lines.append("员工履职表自评：")
    for assessment in application.self_assessments:
        lines.append(
            f"- {assessment.standard_item_code}：{assessment.self_level.value}"
            + (f"；{assessment.self_comment}" if assessment.self_comment else "")
        )

    lines.append("员工举证材料：")
    if evidences:
        for e in evidences:
            lines.append(f"- 标准项 {e.standard_item_code}：{e.file_name}")
    else:
        lines.append("- （未上传）")

    return "\n".join(lines)


# ---- 解析与质量门 ----

def _parse_and_gate(content: str) -> dict:
    """结构质量门：恰好 3 道非空题 + 非空意见；不合规抛 ValueError。"""
    text = content.strip()
    # 容忍模型偶发的 ```json 包裹
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"输出不是合法 JSON：{exc}") from exc

    questions = data.get("questions")
    opinion = data.get("opinion")

    if not isinstance(questions, list):
        raise ValueError("questions 必须是数组")
    if len(questions) != 3:
        raise ValueError(f"面试题必须恰好 3 道，实际 {len(questions)} 道")
    if not all(isinstance(q, str) and q.strip() for q in questions):
        raise ValueError("面试题必须均为非空字符串")
    if not isinstance(opinion, str) or not opinion.strip():
        raise ValueError("opinion 必须为非空字符串")

    return {"questions": [q.strip() for q in questions],
            "opinion": opinion.strip()}


# ---- 主编排 ----

def generate_for_application(
    db: Session, application_id: uuid.UUID
) -> AISuggestion | None:
    application = db.scalar(
        select(Application)
        .where(Application.id == application_id)
        .options(selectinload(Application.self_assessments))
    )
    if application is None:
        return None
    if application.status != ApplicationStatus.IN_COMMITTEE_REVIEW:
        return None

    # 幂等：completed/failed/skipped 不重复生成；
    # pending 视为上一 worker 崩溃遗留，当前调用回收该行继续
    suggestion = db.scalar(
        select(AISuggestion).where(
            AISuggestion.application_id == application.id
        )
    )
    if suggestion is not None and suggestion.status != "pending":
        return suggestion
    if suggestion is None:
        suggestion = AISuggestion(
            application_id=application.id, status="pending"
        )
        db.add(suggestion)
    db.flush()

    config = _tenant_config(db, application.tenant_id)
    ai = _ai_settings(config)

    # 配额熔断
    quota = ai["monthly_token_quota"]
    if quota is not None and _month_used(db, application.tenant_id) >= int(quota):
        suggestion.status = "skipped"
        suggestion.error = "monthly_token_quota_exceeded"
        db.flush()
        return suggestion

    snapshot = db.scalar(
        select(StandardSnapshot).where(
            StandardSnapshot.application_id == application.id
        )
    )
    evidences = db.scalars(
        select(Evidence).where(Evidence.application_id == application.id)
    ).all()

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_message(
            application, snapshot, evidences
        )},
    ]

    client = get_client(
        base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"]
    )

    last_error = ""
    for _ in range(max(1, settings.ai_max_attempts)):
        try:
            result = client.chat(messages)
            gated = _parse_and_gate(result.content)
        except Exception as exc:  # 网络/HTTP/解析/质量门：统一重试
            last_error = f"{type(exc).__name__}: {exc}"
            continue

        suggestion.status = "completed"
        suggestion.questions = gated["questions"]
        suggestion.opinion = gated["opinion"]
        suggestion.model = ai["model"]
        suggestion.prompt_tokens = result.prompt_tokens
        suggestion.completion_tokens = result.completion_tokens
        suggestion.error = None

        total = result.prompt_tokens + result.completion_tokens
        db.add(
            AIUsage(
                tenant_id=application.tenant_id,
                application_id=application.id,
                feature=FEATURE,
                model=ai["model"],
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=total,
            )
        )
        db.flush()
        return suggestion

    suggestion.status = "failed"
    suggestion.error = last_error
    db.flush()
    return suggestion
