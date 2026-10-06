import type { RoleCode } from '@/types';
// HR 三支柱角色常量（定义在 rbac，registry 转出供各页面复用）
import { HR_COE, HR_ALL } from '@/auth/rbac';

export { HR_COE, HR_ALL };

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
  /** 已并入数据中枢/应用中心容器，不在侧边栏单独出现（旧路由保留） */
  hideInNav?: boolean;
  note?: string;
}

/** 参与盘点/人才管理类页面的三个 COE 角色：干部、绩效、组织人才发展 */
const TALENT_COE: RoleCode[] = ['hr_coe_cadre', 'hr_coe_perf', 'hr_coe_otd'];

const A: RoleCode[] = [
  'employee',
  'manager',
  'cert_panel',
  'committee',
  'exec',
  'tenant_admin',
  'platform_admin',
  ...HR_ALL,
];

export const pageRegistry: PageMeta[] = [
  // ============ 批次 1 · 地基 ============
  { key: 'home', title: '原型首页', group: '原型开发', batch: 1, roles: A, depth: '●', done: true, dev: true },
  { key: 'style-guide', title: '样式总览', group: '原型开发', batch: 1, roles: A, depth: '●', done: true, dev: true },

  // ============ 批次 2 · 组织与标准（已并入数据中枢） ============
  // 组织架构/岗位/通道/标准/版本发布：OTD；花名册只读加 ssc、hrbp
  { key: 'org-tree', title: '组织架构', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'exec', 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'positions', title: '岗位管理', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'channels', title: '职级通道', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'employee', 'manager', 'exec'], depth: '◐', done: true, hideInNav: true },
  { key: 'standards-list', title: '任职资格标准库', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'committee', 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'standard-detail', title: '标准详情', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'committee', 'manager', 'employee'], depth: '●', done: true, hideInNav: true, note: '基本/履职/知识/能力/贡献 五部分 Tab' },
  { key: 'standard-versions', title: '版本与发布', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'committee'], depth: '◐', done: true, hideInNav: true },
  { key: 'roster', title: '员工花名册', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'ssc', 'hrbp', 'manager', 'exec'], depth: '●', done: true, hideInNav: true, note: 'OTD 管理；SSC/HRBP 只读' },
  { key: 'employee-detail', title: '员工档案', group: '组织与标准', batch: 2, roles: ['hr_coe_otd', 'hr_coe_cadre', 'hr_coe_perf', 'hrbp', 'ssc', 'manager', 'exec', 'employee'], depth: '◐', done: true, hideInNav: true, note: 'SSC 只读；薪酬/绩效按角色字段掩码' },

  // ============ 批次 3 · 认证与画像（业务页已并入容器） ============
  { key: 'ws-employee', title: '员工工作台', group: '工作台', batch: 3, roles: ['employee'], depth: '●', done: true },
  { key: 'ws-manager', title: '管理者工作台', group: '工作台', batch: 3, roles: ['manager', 'cert_panel'], depth: '●', done: true },
  { key: 'ws-hr', title: 'HR 工作台', group: '工作台', batch: 3, roles: HR_ALL, depth: '●', done: true, note: 'COE/HRBP/SSC 七个角色共用，卡片随激活角色权限变化' },
  { key: 'ws-exec', title: '高管工作台', group: '工作台', batch: 3, roles: ['exec'], depth: '●', done: true },
  { key: 'my-channel', title: '我的通道', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: true, hideInNav: true },
  { key: 'my-profile', title: '我的画像', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: true, hideInNav: true },
  { key: 'my-gap', title: '我的差距', group: '认证与发展', batch: 3, roles: ['employee'], depth: '●', done: true, hideInNav: true },
  { key: 'cert-apply', title: '认证申请与举证', group: '认证管理', batch: 3, roles: ['employee'], depth: '●', done: true, hideInNav: true },
  { key: 'my-cert', title: '我的认证', group: '认证管理', batch: 3, roles: ['employee'], depth: '◐', done: true, hideInNav: true },
  // 认证类：保持 panel/committee/manager 归属；原 HR 发布动作改由 tenant_admin
  { key: 'cert-review', title: '认证审核台', group: '认证管理', batch: 3, roles: ['manager', 'cert_panel', 'committee', 'tenant_admin'], depth: '●', done: true, hideInNav: true, note: '发布动作限 panel.manage / tenant_admin' },
  { key: 'cert-vote', title: '路由评审 / 答辩表决', group: '认证管理', batch: 3, roles: ['manager', 'cert_panel', 'committee'], depth: '●', done: true, hideInNav: true },
  { key: 'talent-profile', title: '七维人才画像', group: '认证管理', batch: 3, roles: ['manager', 'exec', 'committee', 'cert_panel'], depth: '●', done: true, hideInNav: true },
  { key: 'profile-compare', title: '画像版本对比', group: '认证管理', batch: 3, roles: ['hr_coe_cadre', 'hr_coe_perf', 'hr_coe_otd', 'manager', 'exec'], depth: '◐', done: true, hideInNav: true },
  { key: 'notifications', title: '待办消息中心', group: '工作台', batch: 3, roles: A, depth: '◐', done: true },

  // ============ 批次 4 · 盘点 · 九宫格 · 驾驶舱（已并入容器） ============
  // 盘点/校准/九宫格/三张图/人才结构：cadre、perf、otd + exec + manager（管理类）
  { key: 'inv-batches', title: '盘点批次', group: '人才盘点', batch: 4, roles: [...TALENT_COE, 'exec', 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'inv-create', title: '发起盘点', group: '人才盘点', batch: 4, roles: ['hr_coe_otd'], depth: '●', done: true, hideInNav: true, note: 'inventory.manage 仅 OTD' },
  { key: 'inv-calibrate', title: '初排与校准', group: '人才盘点', batch: 4, roles: [...TALENT_COE, 'manager', 'exec', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'nine-grid', title: '九宫格看板', group: '人才盘点', batch: 4, roles: ['exec', ...TALENT_COE, 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true, note: '已对接真实 API' },
  { key: 'grid-track', title: '位置轨迹', group: '人才盘点', batch: 4, roles: ['exec', ...TALENT_COE, 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'grid-strategy', title: '差异化策略', group: '人才盘点', batch: 4, roles: ['exec', ...TALENT_COE, 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'three-charts', title: '三张图驾驶舱', group: '人才盘点', batch: 4, roles: ['exec', ...TALENT_COE], depth: '●', done: true, hideInNav: true, note: '深色大屏' },
  { key: 'cockpit-qa', title: '驾驶舱问答', group: '人才盘点', batch: 4, roles: ['exec', ...TALENT_COE], depth: '●', done: true, hideInNav: true, note: '已对接真实 AI 端点，需配置模型密钥' },
  { key: 'structure-viz', title: '人才结构可视化', group: '人才盘点', batch: 4, roles: [...TALENT_COE, 'exec'], depth: '●', done: true, hideInNav: true },
  { key: 'gap-warning', title: '断层预警', group: '人才盘点', batch: 4, roles: [...TALENT_COE, 'exec'], depth: '◐', done: true, hideInNav: true },
  // 液态组队按语义归干部管理
  { key: 'liquid-team', title: '液态组队', group: '人才盘点', batch: 4, roles: ['hr_coe_cadre', 'manager', 'exec'], depth: '◐', done: true, hideInNav: true },
  { key: 'gap-forecast', title: '缺口预测', group: '人才盘点', batch: 4, roles: [...TALENT_COE, 'exec', 'manager'], depth: '●', done: true, hideInNav: true, note: 'P3 已对接真实 API（结构优化容器 tab）' },
  { key: 'density-dashboard', title: '人才密度仪表盘', group: '人才盘点', batch: 10, roles: [...TALENT_COE, 'exec', 'manager'], depth: '●', done: true, hideInNav: true, note: 'P3 四分类 + 密度 + 冗余/缺口 + AI 建议' },

  // ============ 批次 5 · 差距 · 发展 · 绩效（已并入容器） ============
  // 差距分析/动作路由/IDP/辅导/改进计划：cadre、perf、otd、hrbp、manager
  { key: 'gap-board', title: '差距分析看板', group: '人岗匹配', batch: 5, roles: ['manager', ...TALENT_COE, 'hrbp'], depth: '●', done: true, hideInNav: true },
  { key: 'gap-action', title: '差距详情与动作路由', group: '人岗匹配', batch: 5, roles: ['manager', ...TALENT_COE, 'hrbp'], depth: '●', done: true, hideInNav: true },
  // 统一匹配引擎（P3）：热力图/推荐复用 gap.manage 角色面；员工可查本人推荐
  { key: 'match-heatmap', title: '差距热力图', group: '人岗匹配', batch: 10, roles: ['manager', ...TALENT_COE, 'hrbp', 'tenant_admin'], depth: '●', done: true, hideInNav: true, note: '已对接 /match/heatmap' },
  { key: 'match-recommend', title: '双向推荐', group: '人岗匹配', batch: 10, roles: ['employee', 'manager', ...TALENT_COE, 'hrbp', 'tenant_admin'], depth: '●', done: true, hideInNav: true, note: '一人多岗/一岗多人；员工仅查本人' },
  { key: 'match-config', title: '匹配配置', group: '人岗匹配', batch: 10, roles: [...TALENT_COE, 'hrbp', 'tenant_admin'], depth: '●', done: true, hideInNav: true, note: '租户权重/基准/阈值，已对接 /match/config' },
  { key: 'initial-inventory', title: '人才初盘', group: '人岗匹配', batch: 5, roles: [...TALENT_COE, 'hrbp'], depth: '◐', done: true, hideInNav: true },
  // 学习/培训类归 OTD
  { key: 'learn-map', title: '学习地图', group: '人才发展', batch: 5, roles: ['employee', 'hr_coe_otd'], depth: '◐', done: true, hideInNav: true },
  { key: 'exam-center', title: '考试中心', group: '人才发展', batch: 5, roles: ['employee', 'hr_coe_otd', 'hr_coe_recruit'], depth: '●', done: true, hideInNav: true, note: '考试全流程已对接真实 API（AI 组卷需模型密钥）' },
  { key: 'exam-take', title: '在线答题', group: '人才发展', batch: 5, roles: ['employee'], depth: '●', done: true, hideInNav: true, note: '四选一单选，交卷后自动判分' },
  { key: 'exam-review', title: 'AI 组卷审核', group: '人才发展', batch: 5, roles: ['hr_coe_otd', 'hr_coe_recruit'], depth: '●', done: true, hideInNav: true, note: '审核 AI 试卷，通过后发布' },
  { key: 'idp', title: 'IDP 个人发展计划', group: '人才发展', batch: 5, roles: ['employee', 'manager', ...TALENT_COE, 'hrbp'], depth: '●', done: true, hideInNav: true },
  // 绩效内生（P1）：方案/初评/校准 → PIP/辅导 → 我的绩效
  { key: 'perf-import', title: '考核方案', group: '绩效改进', batch: 5, roles: ['hr_coe_perf', 'hrbp', 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'improvement-board', title: 'PIP 改进看板', group: '绩效改进', batch: 5, roles: ['hr_coe_perf', 'hrbp', 'manager', 'tenant_admin'], depth: '●', done: true, hideInNav: true },
  { key: 'coaching', title: '辅导与回看', group: '绩效改进', batch: 5, roles: ['hr_coe_perf', 'hrbp', 'manager', 'tenant_admin', 'employee'], depth: '●', done: true, hideInNav: true },
  { key: 'my-perf', title: '我的绩效', group: '绩效改进', batch: 5, roles: ['employee', 'manager', 'hrbp', 'hr_coe_perf', 'tenant_admin'], depth: '●', done: true, hideInNav: true },

  // ============ 批次 6 · 继任与梯队（已并入容器，归干部管理） ============
  { key: 'core-positions', title: '核心岗位清单', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre', 'exec'], depth: '◐', done: true, hideInNav: true },
  { key: 'succession-matrix', title: '继任矩阵图谱', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre', 'exec'], depth: '●', done: true, hideInNav: true },
  { key: 'risk-warning', title: '离职风险预警', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre', 'exec'], depth: '●', done: true, hideInNav: true },
  // 意愿/AB 角加 manager、hrbp
  { key: 'willingness', title: '意愿确认', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre', 'manager', 'hrbp'], depth: '●', done: true, hideInNav: true },
  { key: 'talent-pool', title: '梯队池管理', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre'], depth: '◐', done: true, hideInNav: true },
  { key: 'ab-roles', title: 'AB 角配置', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre', 'manager', 'hrbp'], depth: '◐', done: true, hideInNav: true },
  { key: 'pool-training', title: '培养跟踪', group: '继任与梯队', batch: 6, roles: ['hr_coe_cadre'], depth: '○', done: true, hideInNav: true },

  // ============ 批次 7 · 工资与调薪（仅薪酬激励 COE；审批加 exec，金额对 exec 掩码） ============
  { key: 'salary-table', title: '等级工资表', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp'], depth: '●', done: true, hideInNav: true },
  { key: 'market-data', title: '市场分位数据', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp'], depth: '◐', done: true, hideInNav: true },
  { key: 'salary-plan', title: '调薪方案建议', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp'], depth: '●', done: true, hideInNav: true },
  { key: 'salary-approve', title: '调薪审批', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp', 'exec'], depth: '●', done: true, hideInNav: true, note: 'exec 参与审批，页面内薪资金额对 exec 掩码' },
  { key: 'salary-report', title: '套改汇报材料', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp'], depth: '◐', done: true, hideInNav: true },
  { key: 'bonus-plan', title: '绩效奖金方案', group: '薪酬管理', batch: 7, roles: ['hr_coe_comp', 'exec'], depth: '●', done: true, hideInNav: true },
  { key: 'my-salary', title: '我的薪酬', group: '薪酬管理', batch: 7, roles: ['employee', 'manager', 'hr_coe_comp', 'exec'], depth: '●', done: true, hideInNav: true },

  // ============ 批次 8 · 其余模块 + SaaS 运营 ============
  // 招聘工作台加 hrbp、manager
  { key: 'recruit-board', title: '招聘工作台', group: '招聘与培训', batch: 8, roles: ['hr_coe_recruit', 'hrbp', 'manager'], depth: '◐', done: true, hideInNav: true },
  { key: 'interview-bank', title: '面试题库', group: '招聘与培训', batch: 8, roles: ['hr_coe_recruit'], depth: '◐', done: true, hideInNav: true },
  { key: 'training-admin', title: '培训管理', group: '招聘与培训', batch: 8, roles: ['hr_coe_otd'], depth: '○', done: true, hideInNav: true },
  { key: 'knowledge-base', title: '经验萃取库', group: '招聘与培训', batch: 8, roles: ['hr_coe_otd'], depth: '○', done: true, hideInNav: true },
  { key: 'config-center', title: '配置中心', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin', 'hr_coe_otd'], depth: '●', done: true, note: '规则模板 OTD 可协同维护' },
  { key: 'template-market', title: '模板市场', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin', 'hr_coe_otd'], depth: '◐', done: true },
  { key: 'ai-usage', title: 'AI 用量报表', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin'], depth: '◐', done: true },
  { key: 'billing', title: '套餐与账单', group: 'SaaS 运营', batch: 8, roles: ['tenant_admin'], depth: '○', done: true },
  { key: 'platform-tenants', title: '租户管理', group: 'SaaS 运营', batch: 8, roles: ['platform_admin'], depth: '◐', done: true },
  { key: 'platform-board', title: '平台运营看板', group: 'SaaS 运营', batch: 8, roles: ['platform_admin'], depth: '◐', done: true },
  { key: 'ws-tenant', title: '租户管理员工作台', group: '工作台', batch: 8, roles: ['tenant_admin'], depth: '◐', done: true },
  { key: 'ws-platform', title: '平台管理员工作台', group: '工作台', batch: 8, roles: ['platform_admin'], depth: '◐', done: true },
  { key: 'role-admin', title: '角色与权限', group: '租户设置', batch: 8, roles: ['tenant_admin'], depth: '●', done: true, note: '内置模板浏览 / 自定义角色 / 用户授角与数据范围' },

  // ============ 批次 9 · 导航重构：数据中枢 + 应用中心 ============
  // 数据中枢（六库，roles 为所含 tab 页面 roles 的并集）
  { key: 'hub-standards', title: '任职资格标准库', group: '数据中枢', batch: 9, roles: ['hr_coe_otd', 'committee', 'manager', 'tenant_admin', 'employee'], depth: '●', done: true },
  { key: 'perf-standards', title: '绩效标准总览', group: '数据中枢', batch: 9, roles: ['hr_coe_perf', 'hr_coe_otd', 'exec', 'manager', 'committee'], depth: '○', done: true, hideInNav: true, note: 'mock，后端模型规划中' },
  { key: 'hub-perf-standards', title: '绩效管理标准库', group: '数据中枢', batch: 9, roles: ['hr_coe_perf', 'hr_coe_otd', 'exec', 'manager', 'committee'], depth: '○', done: true, note: 'mock' },
  { key: 'hub-profiles', title: '员工画像库', group: '数据中枢', batch: 9, roles: [...TALENT_COE, 'manager', 'exec', 'committee', 'cert_panel', 'employee'], depth: '●', done: true },
  { key: 'hub-headcount', title: '编制库', group: '数据中枢', batch: 9, roles: ['hr_coe_otd', 'tenant_admin'], depth: '●', done: true },
  { key: 'hub-org', title: '组织管理库', group: '数据中枢', batch: 9, roles: ['hr_coe_otd', 'hr_coe_cadre', 'hr_coe_perf', 'hrbp', 'ssc', 'exec', 'manager', 'tenant_admin', 'employee'], depth: '●', done: true },
  { key: 'hub-cockpit', title: '关键指标看板', group: '数据中枢', batch: 9, roles: ['exec', ...TALENT_COE], depth: '●', done: true, note: 'mock' },
  // 应用中心（十一个应用）
  { key: 'app-cert', title: '任职资格认证', group: '应用中心', batch: 9, roles: ['employee', 'manager', 'cert_panel', 'committee', 'tenant_admin'], depth: '●', done: true },
  { key: 'app-dev', title: '人才发展', group: '应用中心', batch: 9, roles: ['employee', 'manager', 'hrbp', ...TALENT_COE, 'hr_coe_recruit'], depth: '●', done: true, note: '含 mock 子页（考试/学习地图）' },
  { key: 'app-perf', title: '绩效管理改进', group: '应用中心', batch: 9, roles: ['hr_coe_perf', 'hr_coe_cadre', 'hr_coe_otd', 'hrbp', 'manager', 'tenant_admin', 'employee'], depth: '●', done: true, note: 'P1 已对接真实 API' },
  { key: 'app-recruit', title: '招聘面试', group: '应用中心', batch: 9, roles: ['hr_coe_recruit', 'hrbp', 'manager'], depth: '◐', done: true, note: 'mock' },
  { key: 'app-gap', title: '人岗匹配', group: '应用中心', batch: 9, roles: ['manager', ...TALENT_COE, 'hrbp', 'employee'], depth: '●', done: true },
  { key: 'app-structure-opt', title: '人才结构优化', group: '应用中心', batch: 9, roles: [...TALENT_COE, 'exec', 'manager'], depth: '◐', done: true, note: 'mock' },
  { key: 'app-succession', title: '继任者计划', group: '应用中心', batch: 9, roles: ['hr_coe_cadre', 'exec', 'manager', 'hrbp'], depth: '●', done: true },
  { key: 'app-pool', title: '人才梯队建设', group: '应用中心', batch: 9, roles: ['hr_coe_cadre'], depth: '◐', done: true, note: 'mock' },
  { key: 'app-salary', title: '薪酬福利管理', group: '应用中心', batch: 9, roles: ['hr_coe_comp', 'exec'], depth: '○', done: true, note: 'mock；exec 仅审批，薪资金额掩码' },
  { key: 'app-nine-grid', title: '人才九宫格动态管理', group: '应用中心', batch: 9, roles: [...TALENT_COE, 'exec', 'manager', 'tenant_admin'], depth: '●', done: true, note: '盘点全流程已对接真实 API' },
  { key: 'app-structure-map', title: '人才结构图', group: '应用中心', batch: 9, roles: [...TALENT_COE, 'exec'], depth: '●', done: true, note: 'mock' },
];

export function getPage(key: string): PageMeta | undefined {
  return pageRegistry.find((p) => p.key === key);
}

/** 当前角色可见、且已交付、未并入容器的页面（驱动侧边栏） */
export function visibleDonePages(role: string | null | undefined): PageMeta[] {
  if (!role) return [];
  return pageRegistry.filter(
    (p) => p.done && !p.hideInNav && p.roles.includes(role as RoleCode),
  );
}
