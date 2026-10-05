"""驾驶舱问答服务：租户数据事实组装 + LLM 可溯源问答。

链路：配额熔断 → 聚合租户事实（员工/盘点/继任）→ 构造受限上下文
→ LLM 调用 → JSON 质量门 → 计量；无 LLM 配置时由端点返回 503。
"""
import json
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ai import AIUsage
from app.models.employee import Employee
from app.models.inventory import Potential
from app.models.org import Department
from app.services.ai import _ai_settings, _month_used, _tenant_config
from app.services.inventory import distribution, list_batches, list_results
from app.services.llm import get_client
from app.services.succession import list_positions, position_view

FEATURE = "cockpit_qa"

# 稳定的来源标签（LLM 在 sources 中只能引用这些）
SRC_EMPLOYEES = "员工名册"
SRC_INVENTORY = "最新盘点"
SRC_SUCCESSION = "继任概览"


# ---------------------------------------------------------------------------
# 事实组装
# ---------------------------------------------------------------------------

def _facts_employees(db: Session, tenant_id) -> list[str]:
    emps = db.scalars(
        select(Employee).where(
            Employee.tenant_id == tenant_id, Employee.is_active.is_(True)
        )
    ).all()
    dept_rows = db.scalars(
        select(Department).where(Department.tenant_id == tenant_id)
    ).all()
    dept_name = {d.id: d.name for d in dept_rows}
    by_dept = Counter(e.dept_id for e in emps)
    dept_text = "、".join(
        f"{dept_name.get(d, d)} {n}人" for d, n in by_dept.most_common()
    )
    return [
        f"- 在职员工共 {len(emps)} 人",
        f"- 部门分布：{dept_text or '（无）'}",
    ]


def _facts_inventory(db: Session, tenant_id) -> tuple[list[str], bool]:
    """返回（事实行，是否找到已发布批次）。"""
    published = [
        b for b in list_batches(db, tenant_id) if b.status == "published"
    ]
    if not published:
        return ["- 暂无已发布的盘点批次"], False

    batch = max(published, key=lambda b: b.published_at or b.created_at)
    dist = distribution(db, batch.id)
    results = list_results(db, batch.id)
    high = sum(1 for r in results if r.potential == Potential.HIGH)
    mid = sum(1 for r in results if r.potential == Potential.MID)
    low = sum(1 for r in results if r.potential == Potential.LOW)

    grids = "、".join(
        f"{code} {n}人" for code, n in sorted(dist["grids"].items()) if n
    )
    date = (batch.published_at or batch.created_at).date().isoformat()
    return [
        f"- 最新已发布盘点：{batch.name}（发布于 {date}，覆盖 {dist['total']} 人）",
        f"- 九宫格分布：{grids or '（无定位）'}",
        f"- 潜力评定：高潜 {high} 人、中潜 {mid} 人、低潜 {low} 人",
    ], True


def _facts_succession(db: Session, tenant_id) -> list[str]:
    positions = list_positions(db, tenant_id)
    if not positions:
        return ["- 尚未配置核心岗位"]

    lines = [f"- 核心岗位共 {len(positions)} 个："]
    high_risk = 0
    for p in positions:
        view = position_view(db, p)
        if view["risk"] == "HIGH":
            high_risk += 1
        incumbent = "空缺" if view["incumbent_employee_id"] is None else "有在岗"
        cand = len(view["candidates"])
        lines.append(
            f"  - {p.name}（编制 {p.headcount}，{incumbent}，"
            f"继任候选 {cand} 人，风险 {view['risk']}：{view['risk_reason']}）"
        )
    lines.append(f"- 其中高风险岗位 {high_risk} 个")
    return lines


def build_context(db: Session, tenant_id) -> str:
    blocks = [
        ("员工与组织", SRC_EMPLOYEES, _facts_employees(db, tenant_id)),
        ("最新盘点", SRC_INVENTORY, _facts_inventory(db, tenant_id)[0]),
        ("核心岗位与继任", SRC_SUCCESSION, _facts_succession(db, tenant_id)),
    ]
    sections = []
    for title, source, facts in blocks:
        sections.append(
            f"【{title}】（来源标签：{source}）\n" + "\n".join(facts)
        )
    return "\n\n".join(sections)


# ---------------------------------------------------------------------------
# Prompt / 质量门
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "你是企业人才管理驾驶舱的数据分析助手。提供的【事实数据】是你唯一可依据的信息。\n"
    "要求：1) 只根据事实回答，事实不足时明确说明缺什么数据，绝不编造数字或人名；"
    "2) 先给结论再列依据，管理建议须与事实区分；3) 严格只输出一个 JSON 对象，"
    "不要输出 JSON 以外的文字，格式：\n"
    '{"answer": "回答正文", "sources": ["来源标签"]}\n'
    "4) sources 只能使用各事实块括号内给出的来源标签，按实际引用列出。"
)


def _parse_and_gate(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):  # 容忍模型偶发的 ```json 包裹
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"输出不是合法 JSON：{exc}") from exc

    answer = data.get("answer")
    sources = data.get("sources")
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("answer 必须为非空字符串")
    if not isinstance(sources, list) or not all(isinstance(s, str) for s in sources):
        raise ValueError("sources 必须为字符串数组")

    allowed = {SRC_EMPLOYEES, SRC_INVENTORY, SRC_SUCCESSION}
    return {
        "answer": answer.strip(),
        "sources": [s for s in sources if s in allowed],
    }


# ---------------------------------------------------------------------------
# 主编排
# ---------------------------------------------------------------------------

def answer_question(db: Session, tenant_id, question: str) -> dict:
    config = _tenant_config(db, tenant_id)
    ai = _ai_settings(config)
    if not ai["api_key"]:
        raise ValueError("ai_not_configured")

    quota = ai["monthly_token_quota"]
    if quota is not None and _month_used(db, tenant_id) >= int(quota):
        raise RuntimeError("monthly_token_quota_exceeded")

    context = build_context(db, tenant_id)
    user_message = f"事实数据：\n{context}\n\n用户问题：{question.strip()}"
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    client = get_client(
        base_url=ai["base_url"], api_key=ai["api_key"], model=ai["model"]
    )

    last_error = ""
    for _ in range(max(1, settings.ai_max_attempts)):
        try:
            result = client.chat(messages)
            gated = _parse_and_gate(result.content)
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            continue

        db.add(
            AIUsage(
                tenant_id=tenant_id,
                feature=FEATURE,
                model=ai["model"],
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.prompt_tokens + result.completion_tokens,
            )
        )
        return {**gated, "model": ai["model"]}

    raise RuntimeError(last_error or "ai_request_failed")
