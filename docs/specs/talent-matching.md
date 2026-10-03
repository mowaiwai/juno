# 人岗匹配（模块 C）Spec

> 版本：v1.0 ｜ 日期：2026-09-29 ｜ 状态：已与用户四轮拷问对齐
> 范围：C1 人才画像引擎 → C2 盘点批次与九宫格 → C3 核心岗位/继任/梯队池
> 前端联调不进本轮 spec，后端三票 TDD 完成后另开前端批次。

## 0. 核心原则

1. **绝不造分**：没有数据源的维度一律 `score=null, status=no_data`；不得用代理指标、伪随机或 AI 估算伪造精度。
2. **版本化、只追加**：画像按版本快照存储，每次生成追加新版本，永不覆盖。
3. **决策留痕**：潜力评定、格位校准、继任提名等人工判断逐人记录操作者、时间与理由。
4. **人工闸门**：潜力、调格、提名由人做；系统只承担确定性的汇聚与初排。
5. **纯增量接入**：不改造认证主链，仅在认证发布事件上挂画像回写；不为本模块建岗位/部门主数据表（见 §7 技术债）。

## 1. 数据现状（事实基线）

| 数据 | 是否存在 | 说明 |
|---|---|---|
| 员工档案 Employee | 是 | 职族/序列/职级/职级起算日/绩效字母等级（可空，新员工可能无绩效）/manager_id；**无学历、证书、入职日期** |
| 认证申请 Application | 是 | 含 SelfAssessment（met/partially_met/not_met）、Evidence、经理初审、终裁；状态 published 时回写员工职级 |
| 绩效数值分 | 否 | 仅 `perf_grade` 字母（S/A/B/C） |
| 业绩 / 团队贡献 / 测评成绩 | 否 | 无任何落库数据；考试成绩不存库 |
| 岗位主数据 / 部门表 | 否 | position、dept_id 均为字符串 |
| 离职风险数据 | 否 | |

## 2. C1 — 人才画像引擎

### 2.1 七维度定义

| key | 名称 | 本期数据源 | 可出分 |
|---|---|---|---|
| basic | 基本条件 | HR 补录的学历、证书 + 档案职级/司龄相关字段 | 补录后可实算 |
| duty | 职责履行 | 最新已发布认证的履职自评 | 是（确定性算法） |
| perf | 绩效 | perf_grade 字母等级 | 否（只存等级） |
| biz | 业绩 | 无 | no_data |
| contribution | 团队贡献 | 无 | no_data |
| knowledge | 知识技能 | 无 | no_data |
| ability | 能力素质 | 无 | no_data |

### 2.2 数据模型

**`profile_snapshots`（头表）**
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid, index | |
| employee_id | uuid FK→employees.id, index | |
| version_seq | int | 该员工画像版本序号，从 1 递增 |
| source | enum | `manual` / `cert_writeback` |
| overall | int? | 实测带分维度不足 3 个时为 null |
| generated_by | uuid? | 手动生成时的操作者 user_id；认证回写为 null |
| generated_at | timestamptz | |

**`profile_dimensions`（子表）**
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| profile_snapshot_id | uuid FK→profile_snapshots.id, index | |
| dimension_key | str(16) | basic/biz/contribution/duty/knowledge/ability/perf |
| status | enum | `measured` / `no_data` |
| score | int? | no_data 时为 null |
| grade_label | str(16)? | 等级文案（如达标/良；perf 维存 S/A/B/C） |
| note | text? | 该维度说明文案 |
| source_ref | uuid? | 来源引用（如认证申请 id） |

头表对子表 cascade all, delete-orphan。同一 snapshot 内 dimension_key 唯一。

**Employee 扩字段**
| 字段 | 类型 | 说明 |
|---|---|---|
| education | str(32)? | 学历，空值未补录 |
| certificates | JSON | 证书清单，默认 `[]` |
| basic_updated_by | uuid? | 补录操作人 |
| basic_updated_at | timestamptz? | |

### 2.3 维度计算规则

- **职责履行 duty**：取该员工**最新已发布（published）**认证申请；
  - 无 → `status=no_data`
  - 有 → 对其全部 SelfAssessment：`met=1 / partially_met=0.5 / not_met=0`，求算术均值 ×100，四舍五入为 score；note 注明认证目标职级与发布时间；source_ref=申请 id。
  - 进行中草稿、被拒/终止申请一律不采信。
- **绩效 perf**：`status=measured`，score=null，grade_label=perf_grade，note 注明来自档案绩效结果。
- **基本条件 basic**：
  - education 为空 → no_data
  - 已补录 → measured；按层级框架基础条件模板比对学历是否满足当前职级要求，note 列出学历与证书清单；score 计算规则：学历匹配 70 分基线，每证书 +5，上限 100（仅在本期作为客观可复核的简单规则写入实现）。
- **其他四维**：恒为 no_data，score=null。
- **总分 overall**：仅统计 `status=measured 且 score 非空` 的维度；数量 < 3 → overall=null；否则取均值四舍五入。

### 2.4 生成与回写

- **手动生成**：以当下数据全新汇聚，追加一版（source=manual，version_seq=上一版+1）。
  - HR：可对单个员工，或对范围内全体员工批量生成（逐人出新版）。
  - 员工本人：可请求重新生成本人画像。
- **认证发布回写**：认证发布事件触发；以该员工最新画像为底，重算并重新汇聚全部维度，生成完整新版本（source=`cert_writeback`）；不做单维度补丁写入。

### 2.5 读取与授权

- 员工：仅本人画像（默认返回最新版；可按 version_seq 取历史版、列出版本列表）。
- 经理：沿 `manager_id` **递归**覆盖全部汇报链下级（含间接下级）。
- HR / 高管（EXECUTIVE 类角色）：本租户全部员工。
- 范围外员工 → 403；画像不存在 → 404 `profile_not_found`。
- 画像不含任何薪酬字段。

### 2.6 学历/证书补录

- 仅 HR 可操作；仅补录 Employee.education / certificates（客观、可核验）。
- 不开放业绩、团队贡献、能力素质等任何维度的手工评分。
- 补录记审计 `profile_basic_updated`（before→after），并回写 basic_updated_by/at。

## 3. C2 — 盘点批次与九宫格

### 3.1 数据模型

**`inventory_batches`（批次）**
| 字段 | 说明 |
|---|---|
| id uuid PK | |
| tenant_id uuid, index | |
| name str | |
| purpose enum | `annual / succession / salary / development` |
| status enum | `draft / calibrating / confirming / published` |
| owner_id uuid | 发起 HR |
| scope_employee_ids JSON? | 本期范围（可空表示全租户在册员工） |
| created_at / published_at | |

**`inventory_results`（逐人结果）**
| 字段 | 说明 |
|---|---|
| id uuid PK | |
| batch_id uuid FK, index | |
| employee_id uuid FK, index | |
| perf_label str | 初排时绩效等级 |
| ability_score int? | 取自最新画像 duty 维 score；无则 null |
| potential enum? | `high / mid / low`，初始 null，由校准人评定 |
| potential_by uuid? / potential_at | 评定人与时间 |
| grid_code str(4)? | 落格码，未定位为 null |
| located bool | 是否成功入格 |
| calibrate_note text? | 调格/评定理由 |
| 唯一约束 (batch_id, employee_id) | |

### 3.2 批次状态机

```
draft ──开始盘点(初排)──▶ calibrating ──提交校准──▶ confirming ──高管确认──▶ published
```

- 创建批次（draft）→ 触发初排进入 calibrating：为范围内每人生成 inventory_result：perf_label=当前绩效等级，ability_score=最新画像 duty 分，potential=null，located=false。
- **calibrating（业务校准）**：校准人逐人评定 potential（high/mid/low，必须显式选择，不预填）；可调整系统建议格位，但必须填 calibrate_note；可分批保存。
- **confirming**：HR 提交校准后进入，等待高管确认；高管可退回 calibrating 或确认发布。
- **published**：结果归档只读，记 published_at。已发布批次不可再编辑。

### 3.3 九宫格规则

- 自动初排仅展示业绩（perf_label）× 能力（ability_score）供参考。
- **最终落格按 业绩 × 潜力**：
  - 业绩列：S/A → `A`，B → `B`，C 及以下 → `C`
  - 潜力行：high → `1`，mid → `2`，low → `3`
  - 格码 `9{列}{行}`（如 9A1）。
- perf_label 缺失 或 potential 未评定 → located=false，列入「未定位」名单，**不硬塞格子**。
- 各格策略文案沿用原型 GRID_CELLS（明星/核心骨干/…/淘汰区）。

### 3.4 分布统计

- 仅统计各格实际人数与占比、未定位人数。
- **不做 271/361 强制分布校验**（比例配置与卡控留后续迭代）。

## 4. C3 — 核心岗位 / 继任 / 梯队池

### 4.1 数据模型

**`core_positions`（核心岗位清单，HR 手工维护）**
| 字段 | 说明 |
|---|---|
| id uuid PK | tenant_id uuid |
| name str(128) | dept_id str(32)?（字符串，无部门表） |
| grade str(32) | headcount int（编制数，≥1） |
| incumbent_employee_id uuid? FK→employees.id | 在岗人，可空（空缺） |
| created_by uuid / created_at | |

**`succession_candidates`（继任候选）**
| 字段 | 说明 |
|---|---|
| id uuid PK | core_position_id uuid FK, index |
| employee_id uuid FK, index | origin enum：`auto`（系统初筛）/ `manual`（人工提名） |
| willingness enum | `unconfirmed / willing / unwilling`，默认 unconfirmed |
| willingness_confirmed_by uuid? / at? | note text? |
| 唯一约束 (core_position_id, employee_id) | |

匹配度**不造总分**：读取时实时组装该员工有数据的维度（绩效等级、duty 分），逐维展示。

**`talent_pools`（梯队池成员）**
| 字段 | 说明 |
|---|---|
| id uuid PK | tenant_id uuid |
| employee_id uuid FK, index | pool_level enum：`L1 / L2 / L3` |
| reason text（入池依据） | joined_by uuid / joined_at |
| status enum | `active / graduated / exited`，默认 active |
| 唯一约束 (tenant_id, employee_id, pool_level) | |

### 4.2 业务规则

- **核心岗位 CRUD**：仅 HR；可设置/变更在岗人。
- **自动初筛**：生成/刷新某岗位候选名单——同序列、绩效 B 以上（perf_grade ∈ S/A/B）、排除在岗人；origin=auto。已存在的人工提名保留。
- **人工提名/移除**：HR 可提名任意员工（origin=manual）或移除候选。
- **意愿确认**：记录 willing/unwilling 与确认人时间。
- **覆盖率**=候选人数 / headcount（上限按 100% 展示）。
- **风险等级（可算规则）**：
  - 在岗人空（空缺）→ HIGH「岗位空缺，需立即补位」
  - 无候选 → HIGH「无继任候选人，存在断档风险」
  - 覆盖率 < 100% → MID「继任候选不足」
  - 其余 → LOW
  - **在岗人流失风险因无数据不评**。
- **梯队池**：加入（含等级与依据）/调整等级/移出（exited）/标记毕业（graduated）。

## 5. API 契约（统一前缀 `/api/v1`，错误体 `{code, message, details?}`）

### 5.1 画像（C1）
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/profiles/generate` | HR | body `{employee_id}` 或 `{scope: "all"}`；生成一版/批量多版 |
| POST | `/profiles/me/regenerate` | 登录用户 | 重生成本人画像 |
| GET | `/profiles/{employee_id}/latest` | 按 §2.5 数据范围 | 最新画像 |
| GET | `/profiles/{employee_id}/versions` | 同上 | 版本列表 |
| GET | `/profiles/{employee_id}/versions/{version_seq}` | 同上 | 指定历史版 |
| PUT | `/employees/{employee_id}/basic` | HR | 补录 `{education, certificates}` |

错误码：`profile_not_found`(404)、403 范围外；补录校验学历取平台 EDUCATION_OPTIONS。

### 5.2 盘点（C2）
| 方法 | 路径 | 权限 |
|---|---|---|
| POST | `/inventory-batches` | HR |
| GET | `/inventory-batches` / `/{id}` | HR/高管/经理（经理限汇报链范围内可读） |
| POST | `/inventory-batches/{id}/start` | HR（draft→初排） |
| GET | `/inventory-batches/{id}/results` | 同上读权限 |
| PUT | `/inventory-batches/{id}/results/{employee_id}` | HR/校准参与人（保存 potential、调格、note） |
| POST | `/inventory-batches/{id}/submit-calibration` | HR |
| POST | `/inventory-batches/{id}/confirm` | TENANT_ADMIN |
| POST | `/inventory-batches/{id}/reject` | TENANT_ADMIN（退回校准） |

> RBAC 说明：当前角色集中无独立「高管」角色，盘点的高管确认/退回由 **TENANT_ADMIN** 承担，与画像全租户可见口径一致。
> 审计 actor 约定：`audit_logs.actor_id` 外键指向 **employees.id**；统一经 `audit_as(db, user, ...)` 将操作人解析为其 Employee.id，无员工档案（如纯 HR 账号）则为 None。

非法状态迁移 → 409，错误码含 `invalid_inventory_transition`；potential 取值非法/落格缺数据 → 422。

### 5.3 核心岗位/继任/梯队（C3）
| 方法 | 路径 | 权限 |
|---|---|---|
| GET/POST | `/core-positions` | HR（HR 写，高管/经理可读） |
| PUT/DELETE | `/core-positions/{id}` | HR |
| POST | `/core-positions/{id}/auto-screen` | HR（自动初筛） |
| GET | `/core-positions/{id}/candidates` | 读权限 |
| POST/DELETE | `/core-positions/{id}/candidates` | HR（提名/移除） |
| PUT | `/core-positions/{id}/candidates/{employee_id}/willingness` | HR |
| GET/POST | `/talent-pools` | HR 写；HR/TENANT_ADMIN 读 |
| PUT | `/talent-pools/{id}` | HR（等级/状态） |

错误语义：核心岗位不存在 → 404 `core_position_not_found`；岗位存在但跨租户访问 → 403 `forbidden`。候选重复 409 `candidate_exists`、梯队重复 409 `pool_member_exists`、提名在岗人 422 `nominate_incumbent`。经理读列表不展开候选人明细，读详情/候选仅限汇报链。

## 6. 审计事件

- `profile_generated`（单人/批量，批量 details 含 employee_ids）
- `profile_basic_updated`（学历证书 before→after）
- `inventory_created` / `potential_rated`（逐人）/ `calibrated`（逐人调格理由）/ `executive_confirmed` / `inventory_published`
- `core_position_created / updated / deleted`
- `succession_nominated / succession_removed / willingness_confirmed`
- `pool_joined / pool_updated / pool_left`
- 认证发布自动回写不另记审计（认证发布本身已记）；纯读取不记。

## 7. 明确不做（本期边界）与技术债

**不做**：离职风险评分、AB 角、培养跟踪、271/361 强制分布卡控、业绩/能力等维度手工评分、候选人（外部招聘）画像。

**技术债（登记，后续单独立项）**：
1. 岗位主数据表 + 部门组织树表（替代 position/dept_id 字符串，支撑组织子树授权、编制管理）。
2. 员工入职日期字段（支撑真实司龄）。
3. 业绩中心、考试/测评成绩落库（喂活 biz/knowledge/ability/contribution 四维）。
4. 盘点分布比例配置与强制卡控。

## 8. 验收标准

1. 无认证、无补录的员工：生成画像后 duty/basic 为 no_data、perf 仅字母等级、biz/contribution/knowledge/ability 全 no_data，**overall=null**。
2. 有已发布认证的员工：duty 为按 met 占比算出的确定分数，note 含目标职级与发布时间；其历史被拒/进行中申请不影响该分。
3. 认证发布后自动产生 `cert_writeback` 新版本，版本序号 +1，历史版本仍可读、不被覆盖。
4. HR 补录学历证书后 basic=measured；非 HR 补录 → 403；试图对其他维度手工评分无入口。
5. 数据范围：员工仅见本人；经理可见全部递归下级、范围外 403；HR/高管见全租户。
6. 盘点批次完整走 draft→calibrating→confirming→published；未评 potential 的人位于「未定位」，不强入格；非法状态迁移 409。
7. 校准调格必须带理由，potential_rated/calibrated 逐人有审计。
8. 核心岗位空缺=HIGH、无候选=HIGH、覆盖率<100%=MID；自动初筛满足同序列+绩效B以上；提名与意愿有审计。
9. 梯队池加入/调整/移出正常，含等级与依据。
10. 认证主链全部既有测试在本模块接入后保持全绿（回归零影响）；迁移可 downgrade/upgrade 往返。
