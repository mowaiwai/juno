# Juno — AI + HR 全栈 SaaS

一套面向中大型企业的人力资源数字化平台，覆盖组织、员工、认证、匹配、绩效、薪酬、盘点、招聘、培训、平台运营十大应用，内置 RBAC 权限体系、多租户隔离、AI 能力契约与可审计的全链路操作留痕。

> 命名纪念：Juno 取自家中已故的小狗「小玖」，系统登录页、侧边栏 Logo、浏览器标题均以此命名。

## ✨ 核心能力

- **五大系统 × 三支柱**：标准 / 选聘 / 评价 / 激励 / 发展 五大业务系统，支撑 COE · HRBP · SSC · 管理者 · 员工 · 高管 多角色视角，切换角色即重算导航、数据范围与字段脱敏。
- **RBAC 三支柱权限模型**：7 个预置角色 + 自定义角色（克隆模板）+ 单活跃角色机制（`X-Active-Role` 请求头）；31 个权限点（24 操作 + 4 字段），4 种数据范围（SELF / SUBTREE / ASSIGNED_DEPTS / GLOBAL）。
- **多租户隔离**：部门表等采用 `(id, tenant_id)` 复合主键，跨租户访问统一返回 404，杜绝越权。
- **敏感数据脱敏**：薪酬金额、画像细项分数/备注按角色权限动态掩码，操作权限与可见权限解耦。
- **AI 能力契约**：试卷自动生成、驾驶舱问答、调薪建议、人才培养计划等 AI 能力统一「触发/输入 → 输出 → 确定性/AI 分工 → 人工闸门」四行表，AI 结果不绕过人工审核。
- **全链路审计**：角色/权限/薪酬/绩效/盘点等敏感操作全留痕，含 before/after 快照。

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12 · FastAPI 0.141 · SQLAlchemy 2.1 · Alembic 1.20 · Pydantic 2 · Uvicorn |
| 前端 | React 18.3 · TypeScript 5.6 · Vite 6 · Ant Design 5.22 · ECharts 5.5 · Zustand 4.5 |
| 数据 | PostgreSQL 16 |
| 部署 | Docker Compose · Nginx（同源反代 `/api`，无需 CORS） |
| 鉴权 | JWT + RBAC（单活跃角色） |

## 📦 十大应用模块

| # | 模块 | 关键能力 |
|---|------|----------|
| 1 | 组织与岗位 | 部门树、岗位主数据、编制标准、结构诊断（厚度/断层率/流动率） |
| 2 | 员工主数据与画像 | 员工档案、七维画像、人才梯队、就绪度三档 |
| 3 | 任职资格认证 | 认证流程状态机、评委打分、校准会、证书颁发 |
| 4 | 人岗匹配 | 五要素匹配度引擎、双向推荐、项目组队、匹配配置 |
| 5 | 绩效管理 | 指标库（定量五分类 + 定性三段法）、绩效计划、校准、结果发布 |
| 6 | 薪酬激励 | 薪酬带宽、市场分位、调薪测算/审批、奖金包分配、发放清单导出 |
| 7 | 人才盘点与继任 | 盘点批次、九宫格、继任地图、缺口预测、AI 培养计划 |
| 8 | 招聘 | 需求、候选人、面试题库、面试评估、人岗匹配复用 |
| 9 | 培训发展 | 培训管理、学习地图、知识库、IDP 行动项 |
| 10 | SaaS 平台运营 | 租户配置中心、模板市场、AI 配额、账单、平台运营大盘 |

## 🚀 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 创建环境变量文件
cp backend/.env.example .env
# 编辑 .env，至少填写：
#   JUNO_SECRET_KEY=$(openssl rand -hex 32)
#   JUNO_INIT_TENANT_NAME=星野制造
#   JUNO_INIT_ADMIN_EMAIL=admin@juno.test
#   JUNO_INIT_ADMIN_PASSWORD=Juno12345

# 2. 一键构建并启动（db → migrate → api → web）
docker compose up -d --build

# 3. 浏览器打开
#    http://localhost
```

### 方式二：本地开发

```bash
# 后端
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
python -m app.services.bootstrap   # 创建首个租户与管理员
uvicorn app.main:app --reload

# 前端（另开终端）
cd prototype
npm install
npm run dev   # http://localhost:5173
```

### 演示账号

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 租户管理员 | `admin@juno.test` | `Juno12345` | 全部权限 + 角色管理 |
| 综合 HR | `hr@juno.test` | `Juno12345` | 七大 HR 模板权限 + GLOBAL 范围 |

## 🏗 架构

```
┌─────────────────────────────────────────────────┐
│  Nginx (web)  —  静态资源 + /api 反向代理         │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  FastAPI (api, 2 workers)    │
        │  ├─ JWT 鉴权 + 单活跃角色     │
        │  ├─ RBAC 权限点 + 数据范围     │
        │  ├─ 字段脱敏中间件             │
        │  └─ 审计日志                  │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  PostgreSQL 16               │
        │  ├─ 24 条 Alembic 迁移        │
        │  ├─ 复合主键多租户隔离         │
        │  └─ advisory lock 调度去重     │
        └──────────────────────────────┘
```

- **迁移服务** `migrate`：one-shot 容器，执行 `alembic upgrade head` + `bootstrap`（幂等创建首个租户与管理员）。
- **前端**：多阶段构建，nginx 托管静态文件并同源反代 `/api/v1`，构建参数 `VITE_API_BASE_URL=/api/v1`，无需 CORS。
- **调度器**：main.py lifespan 启动，PostgreSQL advisory lock（key `0x4A554E4F`）实现多实例去重，启动后 30 秒执行首次每日任务，之后每 24 小时。

## 📁 项目结构

```
.
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/endpoints/   # 40+ 路由模块
│   │   ├── core/               # 鉴权/权限/限流/安全
│   │   ├── models/             # SQLAlchemy 模型（30+ 实体）
│   │   ├── schemas/            # Pydantic 请求/响应
│   │   └── services/           # 业务逻辑
│   ├── alembic/versions/       # 24 条数据库迁移
│   ├── tests/                  # pytest（564 通过）
│   └── seed_data.py            # 演示数据（仅开发环境）
├── prototype/              # React 前端
│   ├── src/
│   │   ├── api/                # 后端 API 客户端
│   │   ├── pages/              # 104 个业务页面
│   │   ├── app/registry.ts     # 路由 + 导航注册表
│   │   └── AppRoutes.tsx
│   └── nginx.conf
├── docs/                   # 设计文档
│   ├── adr/                # 16 条架构决策记录
│   ├── specs/              # 模块规格
│   └── prd.md              # 产品需求文档
├── docker-compose.yml      # 单机部署编排
├── CONTEXT.md              # 术语与业务背景
└── SPEC.md                 # 总体规格
```

## 🧪 测试

```bash
cd backend
pytest          # 564 passed
```

覆盖：RBAC 角色/权限/范围、多租户隔离、认证状态机、匹配引擎、绩效安全矩阵、薪酬规则、盘点继任、招聘 P3、SaaS 平台运营、离职风险等。

## 🔐 安全设计要点

- **JUNO_SECRET_KEY 必填**：docker-compose 启动时若未设置则直接失败，杜绝弱密钥部署。
- **生产环境不跑 seed_data.py**：初始账号走 `bootstrap` 服务，统一密码 `Juno12345`，上线后强制修改。
- **敏感字段脱敏**：薪酬仅 COE·薪酬激励与 TENANT_ADMIN 可见明文；画像细项按角色授权。
- **审计留痕**：角色变更、权限调整、薪酬/绩效操作均写入 `audit_logs`，含 before/after。
- **跨租户 404**：越权访问统一返回 404 而非 403，避免资源探测。

## 📄 设计文档

- [PRD（产品需求文档）](docs/prd.md) — 十大模块功能清单、核心流程、AI 能力契约
- [ADR 目录](docs/adr/) — 16 条架构决策（RBAC 三支柱、五大系统蓝图、技术栈选型等）
- [CONTEXT.md](CONTEXT.md) — 业务术语与上下文
- [SPEC.md](SPEC.md) — 总体规格

## 📝 License

本项目为面试作品集，未经授权不得用于商业用途。
