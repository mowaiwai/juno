# 04 AI 出题链路与在线考试

Status: done
Blocked by: 02

## 任务

实现「知识四档 → 题型映射」的 AI 出题、人工审核、在线考试与补考闸口。

## 范围

1. `POST /api/hr/exam/generate`：按 standard_ids + 职级取知识点，按掌握层级映射题型（了解→选择、掌握→填空、熟练掌握→问答、精通→答辩），LLM 生成试卷草稿，status=AI_GENERATED_PENDING_REVIEW
2. HR 审核发布：管理端试卷审核页（编辑/作废/发布），source 字段流转（1 AI 待审核 → 2 AI 已审核）
3. 在线考试：`POST /api/hr/exam/submit`，客观题自动判分，问答/答辩题人工评阅；合格线走 tenant_config
4. 补考逻辑：不通过 → 补考 1 次（可配）→ 仍不过则终止认证并产出「知识」类 gap
5. AI 治理：每次调用写 ai_usage（场景=出题）；出题输入仅含标准库内容，不涉人员数据，免脱敏

## 验收

- 对目标序列某职级生成试卷：四档知识点各有对应题型，带「AI 生成·待审核」标记
- 未审核试卷不可发布；审核记录留痕
- 考试全流程走通，补考次数受 tenant_config 控制

## 参考

- PRD「AI 场景清单-按知识四档出题」「接口 JSON Schema 示例 1」
- CONTEXT.md「知识四档」；ADR-0007（LLM 直连）、ADR-0009（ai_usage）
