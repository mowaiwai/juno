import { useMemo, type ComponentType } from 'react';
import { Empty, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { getPage } from '@/app/registry';
import type { RoleCode } from '@/types';

// 数据中枢页面
import { StandardsList } from '@/pages/StandardsList';
import { StandardDetail } from '@/pages/StandardDetail';
import { StandardVersions } from '@/pages/StandardVersions';
import { PerfStandards } from '@/pages/PerfStandards';
import { TalentProfile } from '@/pages/TalentProfile';
import { ProfileCompare } from '@/pages/ProfileCompare';
import { MyProfile } from '@/pages/MyProfile';
import { Positions } from '@/pages/Positions';
import { OrgTree } from '@/pages/OrgTree';
import { Roster } from '@/pages/Roster';
import { Channels } from '@/pages/Channels';
import { EmployeeDetail } from '@/pages/EmployeeDetail';
import { ThreeCharts } from '@/pages/ThreeCharts';
import { CockpitQA } from '@/pages/CockpitQA';
// 应用中心页面
import { CertApply } from '@/pages/CertApply';
import { MyCert } from '@/pages/MyCert';
import { MyChannel } from '@/pages/MyChannel';
import { CertReview } from '@/pages/CertReview';
import { CertVote } from '@/pages/CertVote';
import { Idp } from '@/pages/Idp';
import { LearnMap } from '@/pages/LearnMap';
import { ExamCenter } from '@/pages/ExamCenter';
import { ExamTake } from '@/pages/ExamTake';
import { ExamReview } from '@/pages/ExamReview';
import { TrainingAdmin } from '@/pages/TrainingAdmin';
import { KnowledgeBase } from '@/pages/KnowledgeBase';
import { PerfImport } from '@/pages/PerfImport';
import { ImprovementBoard } from '@/pages/ImprovementBoard';
import { Coaching } from '@/pages/Coaching';
import { MyPerf } from '@/pages/MyPerf';
import { RecruitBoard } from '@/pages/RecruitBoard';
import { InterviewBank } from '@/pages/InterviewBank';
import { GapBoard } from '@/pages/GapBoard';
import { GapAction } from '@/pages/GapAction';
import { MatchHeatmap } from '@/pages/MatchHeatmap';
import { MatchRecommend } from '@/pages/MatchRecommend';
import { MatchConfig } from '@/pages/MatchConfig';
import { InitialInventory } from '@/pages/InitialInventory';
import { MyGap } from '@/pages/MyGap';
import { GapWarning } from '@/pages/GapWarning';
import { LiquidTeam } from '@/pages/LiquidTeam';
import { GapForecast } from '@/pages/GapForecast';
import { DensityDashboard } from '@/pages/DensityDashboard';
import { CorePositions } from '@/pages/CorePositions';
import { SuccessionMatrix } from '@/pages/SuccessionMatrix';
import { RiskWarning } from '@/pages/RiskWarning';
import { Willingness } from '@/pages/Willingness';
import { AbRoles } from '@/pages/AbRoles';
import { TalentPool } from '@/pages/TalentPool';
import { TalentPipeline } from '@/pages/TalentPipeline';
import { PoolTraining } from '@/pages/PoolTraining';
import { SalaryTable } from '@/pages/SalaryTable';
import { MarketData } from '@/pages/MarketData';
import { SalaryPlan } from '@/pages/SalaryPlan';
import { SalaryApprove } from '@/pages/SalaryApprove';
import { SalaryReport } from '@/pages/SalaryReport';
import { InvBatches } from '@/pages/InvBatches';
import { InvCreate } from '@/pages/InvCreate';
import { InvCalibrate } from '@/pages/InvCalibrate';
import { NineGrid } from '@/pages/NineGrid';
import { GridTrack } from '@/pages/GridTrack';
import { GridStrategy } from '@/pages/GridStrategy';
import { StructureViz } from '@/pages/StructureViz';
import { ExecutiveDashboard } from '@/pages/ExecutiveDashboard';

export interface AppTabDef {
  /** tab key，同时作为 ?tab= 直达参数 */
  key: string;
  label: string;
  /** registry 中的页面 key（用于角色过滤与旧路由映射） */
  pageKey: string;
  component: ComponentType;
}

export interface AppDef {
  key: string;
  title: string;
  /** 数据飞轮文案：消费哪些库 → 反哺哪些库 */
  wheel: string;
  tabs: AppTabDef[];
}

// ==================== 数据中枢 ====================

export const HUB_STANDARDS: AppDef = {
  key: 'hub-standards',
  title: '任职资格标准库',
  wheel: '被消费：任职资格认证 · 人岗匹配 · 人才发展 ｜ 反哺：认证结果持续校验标准有效性',
  tabs: [
    { key: 'list', label: '标准列表', pageKey: 'standards-list', component: StandardsList },
    { key: 'detail', label: '标准详情', pageKey: 'standard-detail', component: StandardDetail },
    { key: 'versions', label: '版本与发布', pageKey: 'standard-versions', component: StandardVersions },
  ],
};

export const HUB_PERF_STANDARDS: AppDef = {
  key: 'hub-perf-standards',
  title: '绩效管理标准库',
  wheel: '被消费：绩效管理改进 · 人才九宫格 ｜ 反哺：校准结果回写等级分布',
  tabs: [
    { key: 'overview', label: '标准总览', pageKey: 'perf-standards', component: PerfStandards },
  ],
};

export const HUB_PROFILES: AppDef = {
  key: 'hub-profiles',
  title: '员工画像库',
  wheel: '被消费：全部应用 ｜ 反哺：认证、绩效、盘点、发展数据持续写入画像',
  tabs: [
    { key: 'profile', label: '七维画像', pageKey: 'talent-profile', component: TalentProfile },
    { key: 'compare', label: '版本对比', pageKey: 'profile-compare', component: ProfileCompare },
    { key: 'mine', label: '我的画像', pageKey: 'my-profile', component: MyProfile },
  ],
};

export const HUB_HEADCOUNT: AppDef = {
  key: 'hub-headcount',
  title: '编制库',
  wheel: '被消费：人才结构优化 · 招聘面试 ｜ 反哺：编制使用率回写结构看板',
  tabs: [
    { key: 'positions', label: '岗位编制', pageKey: 'positions', component: Positions },
  ],
};

export const HUB_ORG: AppDef = {
  key: 'hub-org',
  title: '组织管理库',
  wheel: '被消费：全部应用 ｜ 反哺：组织调整同步刷新画像与结构图',
  tabs: [
    { key: 'tree', label: '组织架构', pageKey: 'org-tree', component: OrgTree },
    { key: 'roster', label: '花名册', pageKey: 'roster', component: Roster },
    { key: 'channels', label: '职级通道', pageKey: 'channels', component: Channels },
    { key: 'employee', label: '员工档案', pageKey: 'employee-detail', component: EmployeeDetail },
  ],
};

export const HUB_COCKPIT: AppDef = {
  key: 'hub-cockpit',
  title: '关键指标看板',
  wheel: '消费：六个库的全量指标 ｜ 反哺：洞察结论回写各应用动作建议',
  tabs: [
    { key: 'charts', label: '三张图驾驶舱', pageKey: 'three-charts', component: ThreeCharts },
    { key: 'qa', label: 'AI 问答', pageKey: 'cockpit-qa', component: CockpitQA },
  ],
};

// ==================== 应用中心 ====================

export const APP_CERT: AppDef = {
  key: 'app-cert',
  title: '任职资格认证',
  wheel: '消费：任职资格标准库 · 员工画像库 → 反哺：员工画像库',
  tabs: [
    { key: 'apply', label: '认证申请', pageKey: 'cert-apply', component: CertApply },
    { key: 'my-cert', label: '我的认证', pageKey: 'my-cert', component: MyCert },
    { key: 'my-channel', label: '我的通道', pageKey: 'my-channel', component: MyChannel },
    { key: 'review', label: '审核台', pageKey: 'cert-review', component: CertReview },
    { key: 'vote', label: '评审表决', pageKey: 'cert-vote', component: CertVote },
  ],
};

export const APP_DEV: AppDef = {
  key: 'app-dev',
  title: '人才发展',
  wheel: '消费：任职资格标准库 · 员工画像库 → 反哺：员工画像库',
  tabs: [
    { key: 'idp', label: 'IDP 发展计划', pageKey: 'idp', component: Idp },
    { key: 'learn-map', label: '学习地图', pageKey: 'learn-map', component: LearnMap },
    { key: 'exam-center', label: '考试中心', pageKey: 'exam-center', component: ExamCenter },
    { key: 'exam-take', label: '在线答题', pageKey: 'exam-take', component: ExamTake },
    { key: 'exam-review', label: 'AI 组卷审核', pageKey: 'exam-review', component: ExamReview },
    { key: 'training', label: '培训管理', pageKey: 'training-admin', component: TrainingAdmin },
    { key: 'knowledge', label: '经验萃取库', pageKey: 'knowledge-base', component: KnowledgeBase },
  ],
};

export const APP_PERF: AppDef = {
  key: 'app-perf',
  title: '绩效管理改进',
  wheel: '消费：绩效管理标准库 · 员工画像库 → 反哺：员工画像库 · 关键指标看板',
  tabs: [
    { key: 'import', label: '考核方案', pageKey: 'perf-import', component: PerfImport },
    { key: 'board', label: '改进看板', pageKey: 'improvement-board', component: ImprovementBoard },
    { key: 'coaching', label: '辅导回看', pageKey: 'coaching', component: Coaching },
    { key: 'my-perf', label: '我的绩效', pageKey: 'my-perf', component: MyPerf },
  ],
};

export const APP_RECRUIT: AppDef = {
  key: 'app-recruit',
  title: '招聘面试',
  wheel: '消费：编制库 · 任职资格标准库 → 反哺：员工画像库',
  tabs: [
    { key: 'board', label: '招聘工作台', pageKey: 'recruit-board', component: RecruitBoard },
    { key: 'bank', label: '面试题库', pageKey: 'interview-bank', component: InterviewBank },
  ],
};

export const APP_GAP: AppDef = {
  key: 'app-gap',
  title: '人岗匹配',
  wheel: '消费：任职资格标准库 · 员工画像库 → 反哺：员工画像库 · 人才发展',
  tabs: [
    { key: 'board', label: '差距看板', pageKey: 'gap-board', component: GapBoard },
    { key: 'heatmap', label: '差距热力图', pageKey: 'match-heatmap', component: MatchHeatmap },
    { key: 'recommend', label: '双向推荐', pageKey: 'match-recommend', component: MatchRecommend },
    { key: 'config', label: '匹配配置', pageKey: 'match-config', component: MatchConfig },
    { key: 'action', label: '差距动作', pageKey: 'gap-action', component: GapAction },
    { key: 'inventory', label: '人才初盘', pageKey: 'initial-inventory', component: InitialInventory },
    { key: 'my-gap', label: '我的差距', pageKey: 'my-gap', component: MyGap },
  ],
};

export const APP_STRUCTURE_OPT: AppDef = {
  key: 'app-structure-opt',
  title: '人才结构优化',
  wheel: '消费：组织管理库 · 编制库 · 员工画像库 → 反哺：关键指标看板',
  tabs: [
    { key: 'warning', label: '断层预警', pageKey: 'gap-warning', component: GapWarning },
    { key: 'liquid', label: '液态组队', pageKey: 'liquid-team', component: LiquidTeam },
    { key: 'forecast', label: '缺口预测', pageKey: 'gap-forecast', component: GapForecast },
    { key: 'density', label: '人才密度', pageKey: 'density-dashboard', component: DensityDashboard },
  ],
};

export const APP_SUCCESSION: AppDef = {
  key: 'app-succession',
  title: '继任者计划',
  wheel: '消费：员工画像库 · 组织管理库 → 反哺：人才梯队建设',
  tabs: [
    { key: 'positions', label: '核心岗位', pageKey: 'core-positions', component: CorePositions },
    { key: 'matrix', label: '继任矩阵', pageKey: 'succession-matrix', component: SuccessionMatrix },
    { key: 'risk', label: '离职风险', pageKey: 'risk-warning', component: RiskWarning },
    { key: 'willingness', label: '意愿确认', pageKey: 'willingness', component: Willingness },
    { key: 'ab', label: 'AB角配置', pageKey: 'ab-roles', component: AbRoles },
  ],
};

export const APP_POOL: AppDef = {
  key: 'app-pool',
  title: '人才梯队建设',
  wheel: '消费：继任者计划 · 员工画像库 → 反哺：员工画像库 · 人才发展',
  tabs: [
    { key: 'pipeline', label: '梯队建设', pageKey: 'talent-pipeline', component: TalentPipeline },
    { key: 'pool', label: '梯队池', pageKey: 'talent-pool', component: TalentPool },
    { key: 'training', label: '培养跟踪', pageKey: 'pool-training', component: PoolTraining },
  ],
};

export const APP_SALARY: AppDef = {
  key: 'app-salary',
  title: '薪酬福利管理',
  wheel: '消费：任职资格认证 · 九宫格结果 → 反哺：员工画像库',
  tabs: [
    { key: 'table', label: '等级工资表', pageKey: 'salary-table', component: SalaryTable },
    { key: 'market', label: '市场分位', pageKey: 'market-data', component: MarketData },
    { key: 'plan', label: '调薪方案', pageKey: 'salary-plan', component: SalaryPlan },
    { key: 'approve', label: '调薪审批', pageKey: 'salary-approve', component: SalaryApprove },
    { key: 'report', label: '套改汇报', pageKey: 'salary-report', component: SalaryReport },
  ],
};

export const APP_NINE_GRID: AppDef = {
  key: 'app-nine-grid',
  title: '人才九宫格动态管理',
  wheel: '消费：绩效管理标准库 · 员工画像库 → 反哺：员工画像库 · 继任者计划 · 薪酬福利',
  tabs: [
    { key: 'batches', label: '盘点批次', pageKey: 'inv-batches', component: InvBatches },
    { key: 'create', label: '发起盘点', pageKey: 'inv-create', component: InvCreate },
    { key: 'calibrate', label: '初排校准', pageKey: 'inv-calibrate', component: InvCalibrate },
    { key: 'grid', label: '九宫格', pageKey: 'nine-grid', component: NineGrid },
    { key: 'track', label: '位置轨迹', pageKey: 'grid-track', component: GridTrack },
    { key: 'strategy', label: '差异化策略', pageKey: 'grid-strategy', component: GridStrategy },
  ],
};

export const APP_STRUCTURE_MAP: AppDef = {
  key: 'app-structure-map',
  title: '人才结构图',
  wheel: '消费：组织管理库 · 员工画像库 → 反哺：关键指标看板',
  tabs: [
    { key: 'viz', label: '结构可视化', pageKey: 'structure-viz', component: StructureViz },
    { key: 'executive', label: '决策大屏', pageKey: 'executive-dashboard', component: ExecutiveDashboard },
  ],
};

// ==================== 容器组件 ====================

export function AppContainer({ def }: { def: AppDef }) {
  const activeRole = useAuth((s) => s.activeRole);
  const [searchParams, setSearchParams] = useSearchParams();

  // 按当前角色过滤可见 tab（pageKey 在 registry 中的 roles 为准）
  const tabs = useMemo(
    () =>
      def.tabs.filter((t) => {
        const meta = getPage(t.pageKey);
        return !!meta && !!activeRole && meta.roles.includes(activeRole as RoleCode);
      }),
    [def, activeRole],
  );

  const tabParam = searchParams.get('tab');
  const activeKey = tabs.some((t) => t.key === tabParam) ? tabParam! : tabs[0]?.key;

  if (tabs.length === 0) {
    return (
      <div className="page">
        <Empty description="当前角色在此模块下暂无可用页面" />
      </div>
    );
  }

  return (
    <div className="page app-container">
      <div className="app-wheel">
        <span className="app-wheel-tag">数据飞轮</span>
        <span className="app-wheel-title">{def.title}</span>
        {def.wheel}
      </div>
      <Tabs
        activeKey={activeKey}
        onChange={(k) => {
          // 保留 id 等既有查询参数（盘点各 tab 共享同一批次上下文）
          const next = new URLSearchParams(searchParams);
          next.set('tab', k);
          setSearchParams(next, { replace: true });
        }}
        items={tabs.map(({ key, label, component: Comp }) => ({
          key,
          label,
          children: <Comp />,
        }))}
      />
    </div>
  );
}
