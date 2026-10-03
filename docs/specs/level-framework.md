# 任职资格层级框架 Spec

> 版本：v1.0 ｜ 日期：2026-09-28 ｜ 状态：已与用户对齐（16 项决策共识）
>
> 范围：平台级六层能力阶梯 + L1–L3 行为锚点 + 基础条件模板/加分项目录 + 租户层级映射。
> 定位：全产品「统一标尺」，以**纯增量模块**接入，不改造认证主链、不写外键到 standard_sets。
> 不包含：人岗匹配引擎、IDP、招聘、组织诊断（均为后续应用，消费本框架）。

---

## 1. 术语

| 术语 | 定义 |
|---|---|
| 职级 (Grade) | 分序列职级代码（P3、T4、M2…），认证与员工档案的既有粒度 |
| 层级 (Level) | 跨序列六层能力阶梯；**层级包含多个职级**；每层四要素：角色定义/履职水平/关键行为词/影响力 |
| L 级行为锚点 | 跨六层通用的关键行为三级刻度：L1 参与执行 / L2 独立推进 / L3 主导引领 |
| 框架版本 | 平台资产版本（草稿→发布），含六层定义、L 锚点、条件模板、加项目录 |
| 租户映射 | 租户对「职级→层级」的差异覆盖，绑定框架版本；未覆盖回落平台默认 |

## 2. 六层正式文案（v1 初始版）

| # | 层级 | 角色定义 | 履职水平 | 关键行为词 | 影响力范围 | 达标锚点 |
|---|---|---|---|---|---|---|
| 1 | 基础层 | 初阶工作者。对所从事专业知识有一定了解，能按已有规范、流程和操作规则处理专业工作，完成部分一般性专业工作 | 理解并执行基础工作任务，在指导下完成部分工作，配合团队完成任务，提供必要支持 | 参与、支持、配合、记录 | 主要影响个人任务完成，对团队整体工作起基础性支撑作用 | L1 |
| 2 | 经验层 | 能独立承担工作，熟练掌握本专业某一领域业务，了解相关业务知识，独立处理和解决日常性问题 | 独立执行工作任务，识别并解决常规问题，确保任务顺利推进；跟进进展、及时反馈 | 执行、推进、落实、解决 | 影响个人与小团队工作效率，对部门日常工作有直接推动作用 | L2 |
| 3 | 骨干层 | 业务骨干。精通本专业 1–2 个领域，熟悉相关领域知识；能制定本专业优化方案与制度标准；承担主要角色或牵头专业项目；指导低职级专员 | 主导部分重要工作，制定方案与计划，识别解决复杂问题；推动进展，统筹资源、协调成员完成任务 | 主导、组织、推动、方案制定、统筹规划 | 影响团队与整体工作效果，对部门业务发展和效率提升有重要影响 | L3 |
| 4 | 精英层 | 经营人员。能制定本专业领域整体解决方案，牵头公司重大项目，提供改善与发展建议 | 主导大部分工作，制定战略规划与创新方案；关注行业前沿、引入先进理念技术；建立长效机制，持续优化流程与管理体系 | 创新、引领、建立长效机制 | 影响部门整体战略发展，对业务发展与效率提升有重要影响 | L3 |
| 5 | 事业单位经营层 | 公司内专家。从业时间长，对市场实践与前沿理论有深入理解；为本专业发展提供前瞻性策略，为高管层提供前瞻建议 | 专业领域具权威性，提供专业指导；负责知识管理与传承，推动团队专业能力提升；参与战略规划，支持高层决策 | 指导、传承、赋能 | 影响团队整体专业能力与知识水平，对企业战略规划有重要影响 | L3 |
| 6 | 集团经营层 | 行业内专家，能对本专业整体发展趋势产生影响 | 行业内具广泛影响力，引领行业发展；代表企业参与行业标准制定与学术交流，提升行业地位；提供前瞻性战略建议 | 引领、贡献、代表 | 对行业发展有贡献，对企业行业地位与战略发展有重大贡献 | L3 |

## 3. L1–L3 行为锚点（v1 正式文案）

| 锚点 | 定义 |
|---|---|
| **L1 参与执行** | 在指导下理解并执行既定规范与流程；参与、支持、配合团队任务；如实记录过程与问题，及时反馈 |
| **L2 独立推进** | 独立承担工作任务；熟练处理本领域常规问题，确保任务落实推进；识别异常并协调解决，对结果负责 |
| **L3 主导引领** | 主导复杂任务与项目，制定方案、统筹资源、组织协调；推动流程优化与机制建立；解决跨领域复杂问题，指导他人，产出可复用的方法或标准 |

骨干层/精英层/两个经营层在 L3 之上按第 2 节四要素区分角色高度，行为刻度不再增加。

## 4. 平台默认映射表

| 层级 | 默认归入职级 |
|---|---|
| 基础层 | P2、T2 |
| 经验层 | P3、T3、S3、O3 |
| 骨干层 | P4、T4、M2 |
| 精英层 | M3 |
| 事业单位经营层 | M4 |
| 集团经营层 | M5 |

- 默认表之外的职级代码（如 P5）：租户必须显式映射后才能参与消费，系统不猜测；平台版本更新可扩充默认表
- 映射按**职级代码全局**生效：SW/P4 与 ENG/P4 必属同层；不支持按 (序列,职级) 分别映射
- 六层平台锁死：租户不可新增/删除/改名，只能调整职级归属

## 5. 基础条件模板与加分项目录

### 5.1 基础条件模板（挂层级，平台模板 + 租户可覆盖）
| 项 | 结构 |
|---|---|
| 学历下限 | 枚举：不限/大专/本科/硕士/博士，每层一个默认下限 |
| 工龄下限 | 数值（年），空=不限 |
| 司龄下限 | 数值（年），空=不限 |
| 资质证书 | 证书代码清单（证书库先做简单枚举，不建复杂证书体系） |

序列特有的强制资质仍留在各 (序列,职级) 标准集。MVP 阶段基础条件**只记录展示，不做自动校验拦截**（认证门槛仍为任职年限+绩效两条硬规则）。

### 5.2 加分项目录
类型目录：授课培训时长 / 知识管理贡献（体系/制度/流程/标准/规范）/ 经验萃取与课件开发 / 人才带教 / 专业成果（专利/论文等）。
计量口径（课时、人次、件数）由平台定义；**分值与是否启用由租户定**。

## 6. 数据模型（PostgreSQL）

平台表不带 tenant_id（全局资产）；租户映射表带 tenant_id。所有表含 `created_at / updated_at`。

### 6.1 level_framework_versions（框架版本头）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| version | int | 递增 |
| status | enum | `draft / published / archived`（同时至多一个 draft、一个 published；发布时旧 published 转 `archived` 只读保留） |
| published_at | timestamptz? | |

### 6.2 level_definitions（六层定义，挂版本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| framework_version_id | uuid FK | |
| level_order | smallint | 1–6 |
| code | varchar | basic / experienced / backbone / elite / business_unit / group |
| name | varchar | 层级名 |
| role_definition | text | 角色定义 |
| performance_level | text | 履职水平 |
| key_behaviors | json | 关键行为词数组 |
| influence_scope | text | 影响力范围 |
| target_anchor | varchar | L1/L2/L3 |

唯一约束：`(framework_version_id, level_order)`。

### 6.3 behavior_anchors（L 锚点，挂版本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| framework_version_id | uuid FK | |
| code | varchar | L1/L2/L3 |
| name | varchar | 参与执行/独立推进/主导引领 |
| description | text | 锚点文案 |

### 6.4 base_condition_templates（基础条件模板，挂版本+层级）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| framework_version_id | uuid FK | |
| level_order | smallint | 1–6 |
| education_min | varchar | 学历下限枚举 |
| min_work_years | int? | 工龄 |
| min_company_years | int? | 司龄 |
| certificates | json | 证书代码数组 |

### 6.5 bonus_item_catalog（加分项目录，挂版本）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| framework_version_id | uuid FK | |
| code | varchar | 类型代码 |
| name | varchar | 加分项名 |
| measure_unit | varchar | 计量口径（课时/人次/件数） |
| sort_order | int | |

### 6.6 tenant_level_mappings（租户映射覆盖）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | |
| framework_version_id | uuid FK | 绑定版本 |
| grade_code | varchar | 职级代码 |
| level_order | smallint | 覆盖目标层 |

唯一约束：`(tenant_id, framework_version_id, grade_code)`。仅存差异行；读取时与平台默认合并。

### 6.7 初始化
首个框架版本 v1 由种子数据写入（六层四要素、L 锚点、默认映射、条件模板与加项目录），状态 `published`。

## 7. API 契约

统一前缀 `/api/v1`，错误体 `{code, message}`。

### 7.1 框架管理（PLATFORM_ADMIN）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/level-framework/drafts` | 基于最新已发布版复制创建草稿（已有草稿 → 409 `draft_exists`） |
| GET | `/level-framework/drafts/current` | 读草稿 |
| PUT | `/level-framework/drafts/current` | 改草稿（六层定义/锚点/条件模板/加项目录整单更新） |
| POST | `/level-framework/drafts/current/publish` | 发布：版本号+1，旧 published 转归档语义（历史版本保留只读） |

草稿校验：六层齐全且 level_order 1–6 不重复；L1–L3 齐全；各层 target_anchor 合法；文案非空。不满足 → 422 `invalid_framework`（details 返回逐项原因）。草稿不存在时 GET/PUT/publish current → 404 `draft_not_found`。

### 7.2 框架读取（所有登录用户）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/level-framework/latest` | 最新已发布版完整框架 |
| GET | `/level-framework/resolve?grade=P4` | 职级解析：经租户映射回落后的层级 + 四要素 + 要求 L 级；未映射且非默认职级 → 404 `grade_not_mapped` |

### 7.3 租户映射（HR / TENANT_ADMIN）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tenant-level-mapping` | 合并视图：每行 `{grade, level_order, level_name, source: default\|override}`；绑定框架版本号 |
| PUT | `/tenant-level-mapping` | 整表提交 `{framework_version_id, items:[{grade_code, level_order}]}`；服务端 diff 平台默认，仅写差异行 |

**PUT 校验：**
1. framework_version_id 必须为当前已发布版（过期 → 409 `framework_version_stale`）
2. 覆盖范围 = 本租户在用职级（员工档案出现的职级 ∪ 平台默认表职级），必须全覆盖（缺 → 422 `mapping_incomplete`，details 列出缺失职级）
3. 严格单调：职级按平台层级序（P2<P3<P4… M2<M3<M4<M5），映射层级不得倒挂（→ 422 `mapping_not_monotonic`）
4. 多提交的表外职级（如 P5）允许包含，一并存覆盖

### 7.4 审计
映射修改记审计日志：`tenant_level_mapping_update`，before→after。

## 8. 验收标准

1. 种子执行后，`GET /level-framework/latest` 返回 v1 完整框架：六层四要素文案与第 2 节一致、L1–L3 与第 3 节一致、条件模板与加项目录齐全
2. 未配置映射的租户：`resolve?grade=P4` 返回骨干层 + L3；`resolve?grade=P5` 返回 404
3. HR 改映射（P4→精英层）：`resolve?grade=P4` 返回精英层，视图标注 `override`；其他租户不受影响
4. 提交倒挂映射（P4→基础层，P3→骨干层）→ 422 `mapping_not_monotonic`，原映射不变
5. 提交缺少在用职级 → 422 `mapping_incomplete`，details 列出缺失项
6. 绑定过期框架版本提交 → 409
7. 非 PLATFORM_ADMIN 调框架管理端点 → 403；非 HR/租户管理员改映射 → 403
8. PLATFORM_ADMIN 创建草稿→修改→发布：新版本号 +1，`latest` 切到新版，历史版本只读可查
9. 框架表与 standard_sets / applications 无外键依赖；认证主链全部既有测试在模块接入后保持全绿（回归零影响）
10. 映射修改产生审计记录
