# 认证主链 Spec

> 版本：v1.0 ｜ 日期：2026-09-28 ｜ 状态：已与用户对齐（18 项决策共识）
>
> 范围：标准管理 → 履职表 → 举证 → 经理初审 → 认证小组评审（含 AI 出题）→ 结果发布。
> 不包含：盘点、九宫格、调薪、招聘、计费（仅 `ai_usage` 计量）。

---

## 1. 术语

| 术语 | 定义 |
|---|---|
| 标准集 (StandardSet) | 某序列某职级的认证标准模板，含多个标准项。草稿→发布，发布后只读 |
| 标准项 (StandardItem) | 标准集中的一条能力要求，含编号/名称/描述/达标要求/权重 |
| 标准快照 (StandardSnapshot) | 申请提交时对标准集的整版拷贝，评审全程只读快照 |
| 申请单 (Application) | 员工的一次认证申请，六态状态机流转 |
| 履职表 | 申请单的一部分：逐标准项自评 + 举证挂接，无独立流程 |
| 评审任务 (ReviewTask) | 派给评委/组长的工作单元，悲观锁认领制 |
| 发布 (Publish) | HR 显式动作：更新职级 + 归档只读 + 发通知 |

## 2. 角色

| 角色 | 说明 |
|---|---|
| EMPLOYEE | 员工，发起申请 |
| MANAGER | 直属经理，初审 |
| REVIEWER | 认证小组评委 |
| LEAD_REVIEWER | 评审组长，终裁 |
| HR | 租户 HR，发布结果、配置标准与评审小组模板 |
| TENANT_ADMIN | 租户管理员（配置门槛阈值等） |
| PLATFORM_ADMIN | 平台管理员，仅见匿名统计，**不可见员工明文** |

## 3. 状态机

### 3.1 申请单状态

```
DRAFT ──提交──> SUBMITTED ──经理领取──> IN_MANAGER_REVIEW ──初审通过──> IN_COMMITTEE_REVIEW ──组长终裁──> APPROVED（待发布）
                   │                          │                              │
                   └──员工撤回──> DRAFT        └──驳回──> REJECTED            └──终裁驳回──> REJECTED
                                                                              
                 APPROVED ──HR发布──> PUBLISHED（终态，归档只读）
                 REJECTED（终态，归档只读）
```

六业务态：`DRAFT / SUBMITTED / IN_MANAGER_REVIEW / IN_COMMITTEE_REVIEW / APPROVED / REJECTED`，外加发布动作产生的 `PUBLISHED` 持久终态（实现上共 7 个枚举值，PUBLISHED 为 APPROVED 的后继终态）。

**规则：**
- `SUBMITTED → DRAFT`：员工可撤回，材料保留可再编辑；撤回同时清空 `submitted_at/manager_id/manager_deadline_at`，不计入提交窗口
- `IN_MANAGER_REVIEW` 起不可撤回
- 初审不设独立领取端点：经理提交初审时原子完成"领取（SUBMITTED→IN_MANAGER_REVIEW）+ 决策"（初审经理唯一，无竞争）；非该单经理 → 403
- 初审时限 7 个自然日（租户可配 `manager_review_deadline_days`），第 3、6 日站内催办；超期自动流转至 `IN_COMMITTEE_REVIEW`（视为无异议通过，不写初审记录）
- `REJECTED` 后员工可基于原单"再次提交"：产生**新的草稿单**（材料复制，原单保持驳回归档），新单关联当前最新发布标准并记 `previous_application_id`
- 提交窗口口径：同一员工 + 同一 `target_grade`（跨序列投同职级也计数），30 个自然日内最多提交 2 次，超限 → 422 `resubmit_limit_exceeded`
- 复评 = 全新申请，携带 `previous_application_id`

### 3.2 评审任务锁

- 评委点击"开始评审"→ 锁定该申请，`locked_by` + `locked_until = now + 30min`
- 锁内他人只读；超时自动释放（读操作时惰性判定 + 定时任务兜底）
- 组长终裁也需持锁

## 4. 数据模型（PostgreSQL）

所有业务表含 `tenant_id`（行级隔离）、`created_at`、`updated_at`。软删不用，归档即只读。

### 4.1 standard_sets（标准集模板）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | |
| sequence | varchar | 序列代码，如 SW/ENG |
| target_grade | varchar | 目标职级，如 P4 |
| version | int | 同序列+职级递增 |
| status | enum | `draft / published / archived`（发布后只读；新版发布时旧版自动转 archived） |
| published_at | timestamptz? | |

唯一约束：`(tenant_id, sequence, target_grade, version)`；同 `(tenant_id, sequence, target_grade)` 至多一个 `published`、至多一个 `draft`（创建草稿时校验，已有草稿返回 409 `draft_exists`）。

### 4.2 standard_items（标准项）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| standard_set_id | uuid FK | |
| code | varchar | 项编号，如 SW-P4-01 |
| name | varchar | |
| description | text | |
| requirement | text | 达标要求 |
| weight | numeric(5,2) | 权重，全集合计 100 |
| sort_order | int | |

### 4.3 employees（员工档案）

与登录账号 `users` 一对一（`user_id` 唯一）。认证、评审、发布均以此表为权威人员来源。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | |
| user_id | uuid FK→users 唯一 | |
| employee_no | varchar | 工号，如 E10086 |
| name | varchar | |
| dept_id | varchar | |
| position | varchar | |
| family | varchar | 职位族 P/M/T/O/S |
| sequence | varchar | 序列，如 SW |
| grade | varchar | 现职级，如 P3 |
| grade_since | date | 现职级起算日（门槛算任职年限） |
| perf_grade | varchar | S/A/B/C |
| manager_id | uuid? FK→employees | 直属经理（自引用） |
| is_active | bool | |

### 4.4 applications（申请单）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | |
| employee_id | uuid FK→employees | |
| target_sequence | varchar | |
| target_grade | varchar | |
| standard_set_id | uuid FK | 建草稿时关联的当前发布版（履职表与举证按此集渲染；提交时校验仍为 published，否则 409 `standard_superseded`） |
| status | enum | 见 3.1 |
| previous_application_id | uuid? FK | 复评关联 |
| submit_count | int | 30 天窗口内第几次提交 |
| manager_id | uuid FK→employees? | 初审经理（提交时快照员工直属经理） |
| manager_deadline_at | timestamptz? | 初审截止 |
| submitted_at / manager_reviewed_at / decided_at / published_at | timestamptz? | |
| review_locked_by | uuid FK→employees? | 评审锁持有者 |
| review_locked_until | timestamptz? | 评审锁截止（默认 30 分钟） |

### 4.5 standard_snapshots（标准快照）
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| application_id | uuid FK 唯一 |
| standard_set_id | uuid |
| payload | jsonb —— `{set: {...}, items: [...]}` 整版拷贝 |

### 4.6 self_assessments（履职表自评，随申请单）
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| application_id | uuid FK |
| standard_item_code | varchar | 快照内编号 |
| self_level | enum | `met / partially_met / not_met` |
| self_comment | text? |

唯一约束：`(application_id, standard_item_code)`。

### 4.7 evidences（举证附件）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK | |
| standard_item_code | varchar | |
| file_name | varchar | |
| mime_type | varchar | 仅 `image/jpeg image/png application/pdf` |
| size_bytes | int | ≤ 10MB |
| storage_path | varchar | MVP 本地磁盘，预留 OSS key |
| uploaded_by | uuid | |

约束：每 `(application_id, standard_item_code)` 至多 3 个（应用层 + 计数校验）。

### 4.8 manager_reviews（初审记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK 唯一 | |
| decision | enum | `approved / rejected` |
| reject_category | varchar? | 驳回时必填，预设类别：`evidence_insufficient / self_assessment_mismatch / ability_gap / tenure_not_ready / other` |
| comment | text? | 驳回时必填，通过时选填 |
| reviewer_id | uuid FK→employees | 实际处理经理 |

### 4.9 review_panel_templates（评审小组模板）
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| tenant_id / sequence | uuid / varchar |
| lead_reviewer_id | uuid FK→employees |
| reviewer_ids | jsonb UUID 数组（恰好 2 人；经 GUIDList 类型以字符串存、读出还原 UUID） |
| is_active | bool |

同租户+同序列至多一个 `is_active=true`（创建时校验，409 `active_template_exists`）。

### 4.10 review_tasks（评审任务）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK | |
| assignee_id | uuid FK→employees | |
| role | enum | `reviewer / lead` |
| opinion | text? | 评委意见（提交后不可改；组长意见随终裁存 decisions） |
| submitted_at | timestamptz? | |

唯一约束：`(application_id, assignee_id)`。

**派单时机（实现细化）：** 每单 3 条任务（2 reviewer + 1 lead）。初审通过/超期自动通过后立即尝试派单——已有 active 模板则生成；无模板则申请停在评审中等待。HR 新建/更新 active 模板时按同序列对在评审中、无任务的申请批量补派（backfill）。

**悲观锁落在申请级（实现细化）：** `applications.review_locked_by / review_locked_until`（原设想锁挂任务，但任务每人一条不存在互相覆盖；申请级锁才能表达"同一时刻只允许一位成员在评"，见 Q3）。认领走条件 UPDATE 原子加锁，锁长取租户配置 `review_lock_minutes`（默认 30）；评委提交意见后自动释放。

### 4.11 decisions（组长终裁）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK 唯一 | |
| decision | enum | `approved / rejected` |
| comment | text | 必填（strip 非空），仅评审侧可见，不对员工外泄 |
| interview_notes | text? | 面试结论（线下面试，系统只记录） |
| ai_suggestion_id | uuid? FK | 参考的 AI 产出（须属于本单） |
| reviewer_id | uuid FK→employees | 终裁组长 |

### 4.12 ai_suggestions（AI 出题与意见）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK 唯一 | |
| status | varchar | `pending / completed / failed / skipped` |
| questions | jsonb? | completed 时恰好 3 道非空字符串题（结构质量门） |
| opinion | text? | completed 时非空 |
| model | varchar? | 实际使用模型 |
| prompt_tokens / completion_tokens | int | 本次调用用量 |
| error | text? | failed 原因 / skipped 标记 |

### 4.13 ai_usage（AI 调用计量）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | 配额统计口径 |
| application_id | uuid FK? | |
| feature | varchar | `certification_questions` |
| model | varchar | |
| prompt_tokens / completion_tokens / total_tokens | int | 仅成功调用记录 |

**触发与失败语义（实现细化）：** 申请进入 `IN_COMMITTEE_REVIEW`（经理初审通过或超期自动通过）后，经 FastAPI BackgroundTasks 在独立会话中异步执行一次；任何失败/无 key/无配额都不阻塞人工评审。LLM 异常、JSON 解析失败、质量门不通过统一重试，上限取 `ai_max_attempts`（默认 3），耗尽 → `failed`。`pending` 行若为崩溃 worker 遗留（如进程被杀），后续触发回收该行继续，不做终态幂等。

**配额熔断：** 租户配置 `ai_monthly_token_quota`（token/自然月，缺省不限）；worker 启动先汇总本租户当月 `ai_usage.total_tokens`，已达配额 → 本次置 `skipped`，不调模型、不写计量。

### 4.14 audit_logs
| 字段 | 类型 |
|---|---|
| id | bigserial PK |
| tenant_id | uuid |
| actor_id | uuid |
| action | varchar —— `application.submit / application.withdraw / manager_review.submit / review.claim / review.release / review.opinion / decision.final / publish / evidence.upload / evidence.download / ai.generate` |
| entity_type / entity_id | varchar / uuid |
| before / after | jsonb? |

只增不删。

### 4.15 notifications（站内通知）
| 字段 | 类型 |
|---|---|
| id | uuid PK |
| tenant_id / recipient_id | uuid |
| type | varchar —— `task_assigned / manager_review_approved / manager_review_rejected / decision_approved / decision_rejected / decision_published / review_reminder` |
| title | varchar —— 模板化标题 |
| payload | jsonb —— 统一含 `application_id` 与行动指引 `action` |
| read_at | timestamptz? |

邮件通过同一事件外发（模板化文案，SMTP 配置在租户级，外发失败不阻塞业务）。

### 4.16 tenant_configs（租户配置）
每租户一行（`tenant_id` PK + `values` jsonb）；无记录时全部使用内置默认值：`manager_review_deadline_days`(7)、`resubmit_window_days`(30)、`resubmit_max_count`(2)、`min_years_in_grade`(1)、`min_perf_grade`(B)、`review_lock_minutes`(30)。AI 相关可选键：`ai_base_url / ai_api_key / ai_model`（租户覆盖，缺省回落全局环境变量）、`ai_monthly_token_quota`（缺省不限）。邮件可选键（缺省=仅站内通知）：`smtp_host / smtp_port / smtp_username / smtp_password / smtp_from / smtp_use_tls`。

## 5. API 契约（FastAPI，前缀 `/api/v1`）

统一：JWT Bearer 认证；`401/403/404/409/422` 标准错误体 `{code, message, details?}`；列表分页 `?page=&size=`；多租户由 JWT tenant claim 注入。

### 标准管理（HR）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/standard-sets` | 列表（按序列/职级/状态过滤） |
| POST | `/standard-sets` | 建草稿（含 items） |
| PUT | `/standard-sets/{id}` | 改草稿（published 拒绝 409） |
| POST | `/standard-sets/{id}/publish` | 发布（校验权重合计=100） |
| GET | `/standard-sets/{id}` | 详情含 items |

### 申请（员工）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/applications` | 建草稿 `{target_sequence, target_grade}`；先校验硬门槛（不满足 422 `eligibility_failed`，details 含具体规则与实际值），再校验该键存在已发布标准集（422 `standard_not_published`） |
| GET | `/applications/mine` | 我的申请列表 |
| GET | `/applications/{id}` | 详情（按角色裁剪字段，见 §6） |
| PUT | `/applications/{id}/self-assessment` | 草稿态批量写自评 |
| POST | `/applications/{id}/evidences` | 上传附件（multipart，校验类型/大小/数量） |
| DELETE | `/evidences/{id}` | 草稿态删除 |
| POST | `/applications/{id}/submit` | 提交：校验自评齐全（422 `assessment_incomplete`）、30 天窗口（422 `resubmit_limit_exceeded`）、标准集仍为 published（409 `standard_superseded`），通过后生成整版快照、快照经理与截止时间 |
| POST | `/applications/{id}/withdraw` | 仅 SUBMITTED → DRAFT（其他状态 409 `not_submitted`），清空提交痕迹 |
| POST | `/applications/{id}/resubmit` | 仅 REJECTED：创建**新草稿单**，关联当前最新发布标准（422 `standard_not_published`），复制自评与举证（含物理文件），记 previous_application_id；非本人 404 |

### 初审（经理）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/manager/applications?status=submitted` | 我名下处于指定状态（默认待初审）的申请 |
| POST | `/applications/{id}/manager-review` | 仅该单经理；原子完成领取+决策；`{decision, reject_category?, comment?}`；驳回缺类别/说明 → 422 `reject_reason_required`，非法类别 → 422 `invalid_reject_category`；通过 → IN_COMMITTEE_REVIEW，驳回 → REJECTED |

### 员工目录与评审模板（HR）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/employees` | 本租户员工目录（id/工号/姓名/岗位/序列/职级/在职），供配置评审小组按人选取 |
| POST | `/review-panel-templates` | 建模板 `{sequence, lead_reviewer_id, reviewer_ids[2], is_active}`；校验：恰好 2 名互异评委、组长不兼任、成员均为本租户在职员工（422 `invalid_panel` / `member_not_found`）；同序列已有 active → 409 `active_template_exists`；创建后自动 backfill 同序列在途单 |
| GET | `/review-panel-templates?sequence=` | 模板列表 |
| PUT | `/review-panel-templates/{id}` | 改模板（跨租户 404），改后 backfill |

### 评审（评委/组长）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/review/tasks` | 我的评审任务（仅评审中申请），每条带申请级锁状态 locked_by/locked_until |
| POST | `/review/tasks/{id}/claim` | 认领：仅任务受派人；原子加申请级锁，锁被他人持有 → 409 `review_locked`；非本人任务 404；申请不在评审中 409 `not_in_review` |
| POST | `/review/tasks/{id}/release` | 持锁人主动释放 → 204；未持锁 → 409 `not_lock_holder` |
| POST | `/review/tasks/{id}/opinion` | 提交意见 `{opinion}`：需持锁（409 `not_lock_holder`），已提交过 → 409 `already_submitted`；成功后自动释放锁 |
| POST | `/applications/{id}/decision` | 仅被派单的 lead：`{decision, comment, interview_notes?, ai_suggestion_id?}`；非评审中 409 `not_in_review`，未持锁 409 `not_lock_holder`，空白 comment 422 `comment_required`，AI 引用不属本单 422 `ai_suggestion_not_found`；成功 → APPROVED/REJECTED + decided_at，锁清空。评委意见不强制齐（缺席不阻塞） |
| GET | `/applications/{id}/ai-suggestion` | 仅组长：completed/skipped/failed → 200 `{status, questions?, opinion?}`；pending → 202；无记录 → 404。评委/员工/HR 一律 403 |

### 发布与通知（HR）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/applications?status=approved` | 全租户申请列表（HR 视角），按状态过滤；其他角色 403 |
| POST | `/applications/{id}/publish` | 仅 HR：仅 APPROVED 可发布（否则 409 `not_approved`）；事务内更新员工 grade=target_grade、grade_since=当天，置 PUBLISHED + published_at；此后申请归档只读 |

### 通知中心（所有登录用户）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/notifications` | 我的站内通知（按时间倒序） |
| GET | `/notifications/unread-count` | 未读数 |
| POST | `/notifications/{id}/read` | 仅收件人可标记（他人 404）；幂等 |

**通知触发联动：** 提交→经理 `task_assigned`；初审通过/驳回→员工 `manager_review_approved/rejected`（驳回含结构化原因）；终裁→员工 `decision_approved/rejected`；发布→员工 `decision_published`（含 new_grade）。

### 审计查询（HR / TENANT_ADMIN）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/audit-logs?entity_id=&action=` | 本租户审计日志，可按申请实体/动作过滤；其他角色 403 |

### 配置（TENANT_ADMIN/HR）
| 方法 | 路径 |
|---|---|
| GET/PUT | `/tenant-config` |

### 内部运维端点（前缀 `/api`，非 `/api/v1`）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/internal/manager-review-timeouts` | HR 触发：本租户 SUBMITTED 且过 `manager_deadline_at` 的单批量推进至 IN_COMMITTEE_REVIEW（同时触发 AI 异步生成），返回 `{advanced: n}`；定时调度在上线前由外部 cron 接入 |
| POST | `/internal/manager-review-reminders` | HR 触发：SUBMITTED 单提交满 3 / 6 个自然日时各向经理发一次 `review_reminder`（按已发 day 去重），返回 `{reminders_sent: n}`；manager_id 为空的单跳过 |

## 6. 字段级可见性矩阵

| 字段 | 员工本人 | 经理 | 评委 | 组长 | HR | 平台管理员 |
|---|---|---|---|---|---|---|
| 申请状态/结论 | ✅ | ✅（本部门） | ✅（派单） | ✅ | ✅ | ❌（仅匿名计数） |
| 自评+举证 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 初审意见（含驳回原因） | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 评委个人意见 | ❌ | ❌ | 仅本人 | ✅ | 发布前 ❌ | ❌ |
| 组长终裁意见 comment | ❌（仅见 final_decision 结果） | ❌ | ❌ | ✅ | 发布前 ❌ | ❌ |
| AI 面试题/意见 | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 面试结论 | 结论性结果 ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

发布后：申请单全量只读（所有写接口对已归档单返回 409）。

## 7. 通知事件

| 事件 | 接收人 | 渠道 |
|---|---|---|
| 提交成功 | 经理 | 站内+邮件 |
| 初审驳回 | 员工 | 站内+邮件（含原因） |
| 初审通过/超期自动通过 | 评委+组长 | 站内 |
| 催办（第3/6日） | 经理 | 站内 |
| 终裁完成 | HR | 站内 |
| 发布 | 员工、经理 | 站内+邮件 |

## 8. 非功能要求

- 并发：评审认领用 `SELECT ... FOR UPDATE` 或条件更新（`locked_until < now OR locked_by = me`）保证原子
- AI 调用：国内合规模型（通义/DeepSeek），异步任务（MVP 用 FastAPI BackgroundTasks + 重试），用量写 `ai_usage` 计量表；租户配额超限→熔断跳过 AI 生成不阻塞流程
- 审计：§4.12 列出的全部 action 必记；审计写入与业务操作同事务
- 员工敏感字段（姓名等）对平台管理员脱敏；个保法授权记录复用全局方案（本 spec 不展开）
- 文件存储：`storage/evidences/{tenant}/{application}/{uuid}.{ext}`，下载走鉴权接口而非静态暴露

## 9. 验收标准（MVP 完成定义）

虚拟租户数据下，以下链路可端到端走通：

1. HR 创建 SW 序列 P4 标准集（≥3 标准项，权重合计 100）并发布
2. 员工许星遥（P3，满 1 年，绩效 B）发起 P4 认证：填自评、传 2 个附件、提交
3. 不满足门槛的员工（入职不满 1 年）发起时收到 422 结构化原因
4. 经理陆行舟收到通知，初审驳回（填类别+原因）→ 员工收到含原因的通知
5. 员工修改后重新提交 → 经理初审通过
6. 评审任务自动派给模板配置的 2 评委 + 1 组长；评委 B 尝试认领评委 A 已锁的任务收到 409；31 分钟后可认领
7. AI 异步生成 3 道面试题+意见，组长可见，员工不可见
8. 组长录入面试结论并终裁通过 → HR 收到待发布通知
9. HR 发布：员工职级 P3→P4，申请单归档只读（任何写操作 409），员工+经理收到通知
10. 全程 audit_logs 记录完整（§4.12 的 action 全覆盖）
11. 超期场景：经理 7 日未处理，申请自动进入评审中（用可配短时限演示）
12. 30 天内第 3 次提交同职级申请被 422 拒绝

## 10. 明确不做

- 盘点/九宫格/调薪/招聘
- 企业微信/钉钉 IM 集成（预留渠道接口）
- 复评特殊流程（复评=普通新申请）
- 面试在线化（线下面试，系统仅记录）
- OSS 对象存储（接口预留，MVP 本地磁盘）
