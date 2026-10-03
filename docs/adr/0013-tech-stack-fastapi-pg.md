# 技术栈修订：FastAPI + PostgreSQL 取代 NestJS + MySQL

Supersedes ADR-0007。

后端实际落地为 **FastAPI（Python 3.12）+ PostgreSQL 16 + Alembic + JWT/RBAC**，LLM 层直连国内合规模型 API（通义等）。变更理由：

- 单人 + AI agent 开发效率：Python 生态对 LLM 调用、数据处理更直接，FastAPI 自动生成 OpenAPI 文档减少接口对齐成本。
- PostgreSQL 的 JSONB、数组、CTE 等特性比 MySQL 更适合人才画像、盘点结果的灵活结构。
- 团队 TS 栈（RELATIONS）一致性让位于交付速度；前端仍保持 React + TypeScript，不受影响。

ADR-0007 中「LLM 直连国内模型 API、不引入 LangChain」的决策保持不变。
