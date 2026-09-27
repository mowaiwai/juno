import type { RoleCode } from '@/types';

export type Depth = '●' | '◐' | '○';

export interface PageMeta {
  key: string;
  title: string;
  /** 侧边栏分组 */
  group: string;
  batch: number;
  roles: RoleCode[];
  depth: Depth;
  done: boolean;
  /** 仅开发可见（样式总览等） */
  dev?: boolean;
  note?: string;
}

const A: RoleCode[] = ['employee', 'manager', 'cert_panel', 'committee', 'hr', 'exec', 'tenant_admin'];

export const pageRegistry: PageMeta[] = [
  // ============ 批次 1 · 地基 ============
  { key: 'home', title: '原型首页', group: '原型开发', batch: 1, roles: A, depth: '●', done: true, dev: true },
  { key: 'style-guide', title: '样式总览', group: '原型开发', batch: 1, roles: A, depth: '●', done: true, dev: true },

  // ============ 批次 2 · 组织与标准 ============
  { key: 'org-tree', title: '组织架构', group: '组织与标准', batch: 2, roles: ['hr', 'exec', 'manager', 'tenant_admin'], depth: '●', done: false },
  { key: 'positions', title: '岗位管理', group: '组织与标准', batch: 2, roles: ['hr', 'tenant_admin'], depth: '●', done: false },
  { key: 'channels', title: '职级通道', group: '组织与标准', batch: 2, roles: ['hr', 'employee', 'manager', 'exec'], depth: '◐', done: false },
  { key: 'standards-list', title: '任职资格标准库', group: '组织与标准', batch: 2, roles: ['hr', 'committee', 'manager', 'tenant_admin'], depth: '●', done: false },
  { key: 'standard-detail', title: '标准详情', group: '组织与标准', batch: 2, roles: ['hr', 'committee', 'manager', 'employee'], depth: '●', done: false, note: '基本/履职/知识/能力/贡献 五部分 Tab' },
  { key: 'standard-versions', title: '版本与发布', group: '组织与标准', batch: 2, roles: ['hr', 'committee'], depth: '◐', done: false },
  { key: 'roster', title: '员工花名册', group: '组织与标准', batch: 2, roles: ['hr', 'manager', 'exec'], depth: '●', done: false },
  { key: 'employee-detail', title: '员工档案', group: '组织与标准', batch: 2, roles: ['hr', 'manager', 'exec', 'employee'], depth: '◐', done: false },

  // ============ 批次 3 · 认证与画像 ============
  { key: 'ws-employee', title: '员工工作台', group: '工作台', batch: 3, roles: ['employee'], depth: '●', done: false },
  { key: 'ws-manager', title: '管理者工作台', group: '工作台', batch: 3, roles: ['manager', 'cert_panel'], depth: '●', done: false },
  { key: 'ws-hr', title: 'HR 工作台', group: '工作台', batch: 3, roles: ['hr', 'committee'], depth: '●', done: false },
  { key: 'ws-exec', title: '高管工作台', group: '工作台', batch: 3, roles: ['exec'], depth: '●', done: false },
  { key: 'my-channel', title: '我的通道', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: false },
  { key: 'my-profile', title: '我的画像', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: false },
  { key: 'my-gap', title: '我的差距', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: false },
  { key: 'cert-apply', title: '认证申请与举证', group: '认证管理', batch: 3, roles: ['employee'], depth: '●', done: false },
  { key: 'my-cert', title: '我的认证', group: '认证管理', batch: 3, roles: ['employee'], depth: '◐', done: false },
  { key: 'cert-review', title: '认证审核台', group: '认证管理', batch: 3, roles: ['hr', 'manager'], depth: '●', done: false },
  { key: 'cert-vote', title: '路由评审 / 答辩表决', group: '认证管理', batch: 3, roles: ['manager', 'cert_panel', 'committee', 'hr'], depth: '●', done: false },
  { key: 'talent-profile', title: '七维人才画像', group: '认证管理', batch: 3, roles: ['hr', 'manager', 'exec', 'committee', 'cert_panel'], depth: '●', done: false },
  { key: 'profile-compare', title: '画像版本对比', group: '认证管理', batch: 3, roles: ['hr', 'manager', 'exec'], depth: '◐', done: false },
  { key: 'notifications', title: '待办消息中心', group: '认证管理', batch: 3, roles: A, depth: '◐', done: false },

  // ============ 批次 4 · 盘点 · 九宫格 · 驾驶舱 ============
  { key: 'inv-batches', title: '盘点批次', group: '人才盘点', batch: 4, roles: ['hr', 'exec', 'manager'], depth: '●', done: false },
  { key: 'inv-create', title: '发起盘点', group: '人才盘点', batch: 4, roles: ['hr'], depth: '●', done: false },
  { key: 'inv-calibrate', title: '初排与校准', group: '人才盘点', batch: 4, roles: ['hr', 'manager', 'exec'], depth: '●', done: false },
  { key: 'nine-grid', title: '九宫格看板', group: '人才盘点', batch: 4, roles: ['exec', 'hr', 'manager'], depth: '●', done: false, note: '演示高潮' },
  { key: 'grid-track', title: '位置轨迹', group: '人才盘点', batch: 4, roles: ['exec', 'hr', 'manager'], depth: '◐', done: false },
  { key: 'grid-strategy', title: '差异化策略', group: '人才盘点', batch: 4, roles: ['exec', 'hr', 'manager'], depth: '◐', done: false },
  { key: 'three-charts', title: '三张图驾驶舱', group: '人才盘点', batch: 4, roles: ['exec', 'hr'], depth: '●', done: false, note: '深色大屏' },
  { key: 'cockpit-qa', title: '驾驶舱问答', group: '人才盘点', batch: 4, roles: ['exec', 'hr'], depth: '◐', done: false },
  { key: 'structure-viz', title: '人才结构可视化', group: '人才盘点', batch: 4, roles: ['hr', 'exec'], depth: '●', done: false },
  { key: 'gap-warning', title: '断层预警', group: '人才盘点', batch: 4, roles: ['hr', 'exec'], depth: '◐', done: false },
  { key: 'liquid-team', title: '液态组队', group: '人才盘点', batch: 4, roles: ['hr', 'manager', 'exec'], depth: '◐', done: false },

  // ============ 批次 5 · 差距 · 发展 · 绩效 ============
  { key: 'gap-board', title: '差距分析看板', group: '人岗匹配', batch: 5, roles: ['manager', 'hr', 'exec'], depth: '●', done: false },
  { key: 'gap-action', title: '差距详情与动作路由', group: '人岗匹配', batch: 5, roles: ['manager', 'hr'], depth: '●', done: false },
  { key: 'initial-inventory', title: '人才初盘', group: '人岗匹配', batch: 5, roles: ['hr'], depth: '◐', done: false },
  { key: 'learn-map', title: '学习地图', group: '人才发展', batch: 5, roles: ['employee', 'hr'], depth: '◐', done: false },
  { key: 'exam-center', title: '考试中心', group: '人才发展', batch: 5, roles: ['employee', 'hr'], depth: '◐', done: false },
  { key: 'exam-take', title: '在线答题', group: '人才发展', batch: 5, roles: ['employee'], depth: '●', done: false },
  { key: 'exam-review', title: 'AI 组卷审核', group: '人才发展', batch: 5, roles: ['hr'], depth: '●', done: false },
  { key: 'idp', title: 'IDP 个人发展计划', group: '人才发展', batch: 5, roles: ['employee', 'manager', 'hr'], depth: '●', done: false },
  { key: 'perf-import', title: '绩效结果导入', group: '绩效改进', batch: 5, roles: ['hr'], depth: '●', done: false },
  { key: 'improvement-board', title: '改进计划看板', group: '绩效改进', batch: 5, roles: ['manager', 'hr'], depth: '◐', done: false },
  { key: 'coaching', title: '辅导与效果回看', group: '绩效改进', batch: 5, roles: ['manager', 'hr'], depth: '◐', done: false },

  // ============ 批次 6 · 继任与梯队 ============
  { key: 'core-positions', title: '核心岗位清单', group: '继任与梯队', batch: 6, roles: ['hr', 'exec'], depth: '◐', done: false },
  { key: 'succession-matrix', title: '继任矩阵图谱', group: '继任与梯队', batch: 6, roles: ['hr', 'exec'], depth: '●', done: false },
  { key: 'risk-warning', title: '离职风险预警', group: '继任与梯队', batch: 6, roles: ['hr', 'exec'], depth: '●', done: false },
  { key: 'willingness', title: '意愿确认', group: '继任与梯队', batch: 6, roles: ['hr', 'manager'], depth: '●', done: false },
  { key: 'talent-pool', title: '梯队池管理', group: '继任与梯队', batch: 6, roles: ['hr'], depth: '◐', done: false },
  { key: 'ab-roles', title: 'AB 角配置', group: '继任与梯队', batch: 6, roles: ['hr', 'manager'], depth: '◐', done: false },
  { key: 'pool-training', title: '培养跟踪', group: '继任与梯队', batch: 6, roles: ['hr'], depth: '○', done: false },

  // ============ 批次 7 · 工资与调薪 ============
  { key: 'salary-table', title: '等级工资表', group: '薪酬管理', batch: 7, roles: ['hr', 'committee'], depth: '●', done: false },
  { key: 'market-data', title: '市场分位数据', group: '薪酬管理', batch: 7, roles: ['hr'], depth: '◐', done: false },
  { key: 'salary-plan', title: '调薪方案建议', group: '薪酬管理', batch: 7, roles: ['hr', 'exec'], depth: '●', done: false },
  { key: 'salary-approve', title: '调薪审批', group: '薪酬管理', batch: 7, roles: ['exec', 'committee', 'hr'], depth: '●', done: false },
  { key: 'salary-report', title: '套改汇报材料', group: '薪酬管理', batch: 7, roles: ['hr', 'exec'], depth: '◐', done: false },

  // ============ 批次 8 · 其余模块 + SaaS 运营 ============
  { key: 'recruit-board', title: '招聘工作台', group: '招聘与培训', batch: 8, roles: ['hr', 'manager'], depth: '◐', done: false },
  { key: 'interview-bank', title: '面试题库', group: '招聘与培训', batch: 8, roles: ['hr'], depth: '◐', done: false },
  { key: 'training-admin', title: '培训管理', group: '招聘与培训', batch: 8, roles: ['hr'], depth: '○', done: false },
  { key: 'knowledge-base', title: '经验萃取库', group: '招聘与培训', batch: 8, roles: ['hr'], depth: '○', done: false },
  { key: 'config-center', title: '配置中心', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin', 'hr'], depth: '●', done: false },
  { key: 'template-market', title: '模板市场', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin', 'hr'], depth: '◐', done: false },
  { key: 'ai-usage', title: 'AI 用量报表', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin', 'hr'], depth: '◐', done: false },
  { key: 'billing', title: '套餐与账单', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin'], depth: '○', done: false },
  { key: 'platform-tenants', title: '租户管理', group: 'SaaS 运营', batch: 8, roles: ['platform_admin'], depth: '◐', done: false },
  { key: 'platform-board', title: '平台运营看板', group: 'SaaS 运营', batch: 8, roles: ['platform_admin'], depth: '◐', done: false },
  { key: 'ws-tenant', title: '租户管理员工作台', group: '工作台', batch: 8, roles: ['tenant_admin'], depth: '◐', done: false },
  { key: 'ws-platform', title: '平台管理员工作台', group: '工作台', batch: 8, roles: ['platform_admin'], depth: '◐', done: false },
];

export function getPage(key: string): PageMeta | undefined {
  return pageRegistry.find((p) => p.key === key);
}

/** 当前角色可见、且已交付的页面（驱动侧边栏） */
export function visibleDonePages(role: RoleCode): PageMeta[] {
  return pageRegistry.filter((p) => p.done && p.roles.includes(role));
}
