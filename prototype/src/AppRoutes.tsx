import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';
import { StyleGuide } from '@/pages/StyleGuide';
import { ComingSoon } from '@/pages/ComingSoon';
import { OrgTree } from '@/pages/OrgTree';
import { Positions } from '@/pages/Positions';
import { Channels } from '@/pages/Channels';
import { StandardsList } from '@/pages/StandardsList';
import { StandardDetail } from '@/pages/StandardDetail';
import { StandardVersions } from '@/pages/StandardVersions';
import { Roster } from '@/pages/Roster';
import { EmployeeDetail } from '@/pages/EmployeeDetail';
// 批次 3 · 认证与画像
import { WsEmployee } from '@/pages/WsEmployee';
import { WsManager } from '@/pages/WsManager';
import { WsHr } from '@/pages/WsHr';
import { WsExec } from '@/pages/WsExec';
import { MyChannel } from '@/pages/MyChannel';
import { MyProfile } from '@/pages/MyProfile';
import { MyGap } from '@/pages/MyGap';
import { CertApply } from '@/pages/CertApply';
import { MyCert } from '@/pages/MyCert';
import { CertReview } from '@/pages/CertReview';
import { CertVote } from '@/pages/CertVote';
import { TalentProfile } from '@/pages/TalentProfile';
import { ProfileCompare } from '@/pages/ProfileCompare';
import { Notifications } from '@/pages/Notifications';
// 批次 4 · 盘点 · 九宫格 · 驾驶舱
import { InvBatches } from '@/pages/InvBatches';
import { InvCreate } from '@/pages/InvCreate';
import { InvCalibrate } from '@/pages/InvCalibrate';
import { NineGrid } from '@/pages/NineGrid';
import { GridTrack } from '@/pages/GridTrack';
import { GridStrategy } from '@/pages/GridStrategy';
import { ThreeCharts } from '@/pages/ThreeCharts';
import { CockpitQA } from '@/pages/CockpitQA';
import { StructureViz } from '@/pages/StructureViz';
import { GapWarning } from '@/pages/GapWarning';
import { LiquidTeam } from '@/pages/LiquidTeam';
// 批次 5 · 差距 · 发展 · 绩效
import { GapBoard } from '@/pages/GapBoard';
import { GapAction } from '@/pages/GapAction';
import { InitialInventory } from '@/pages/InitialInventory';
import { LearnMap } from '@/pages/LearnMap';
import { ExamCenter } from '@/pages/ExamCenter';
import { ExamTake } from '@/pages/ExamTake';
import { ExamReview } from '@/pages/ExamReview';
import { Idp } from '@/pages/Idp';
import { PerfImport } from '@/pages/PerfImport';
import { ImprovementBoard } from '@/pages/ImprovementBoard';
import { Coaching } from '@/pages/Coaching';
// 批次 6 · 继任与梯队
import { CorePositions } from '@/pages/CorePositions';
import { SuccessionMatrix } from '@/pages/SuccessionMatrix';
import { RiskWarning } from '@/pages/RiskWarning';
import { Willingness } from '@/pages/Willingness';
import { TalentPool } from '@/pages/TalentPool';
import { AbRoles } from '@/pages/AbRoles';
import { PoolTraining } from '@/pages/PoolTraining';
// 批次 7 · 工资与调薪
import { SalaryTable } from '@/pages/SalaryTable';
import { MarketData } from '@/pages/MarketData';
import { SalaryPlan } from '@/pages/SalaryPlan';
import { SalaryApprove } from '@/pages/SalaryApprove';
import { SalaryReport } from '@/pages/SalaryReport';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="style-guide" element={<StyleGuide />} />
          {/* 批次 2 · 组织与标准底座 */}
          <Route path="org-tree" element={<OrgTree />} />
          <Route path="positions" element={<Positions />} />
          <Route path="channels" element={<Channels />} />
          <Route path="standards-list" element={<StandardsList />} />
          <Route path="standard-detail" element={<StandardDetail />} />
          <Route path="standard-versions" element={<StandardVersions />} />
          <Route path="roster" element={<Roster />} />
          <Route path="employee-detail" element={<EmployeeDetail />} />
          {/* 批次 3 · 认证与画像 */}
          <Route path="ws-employee" element={<WsEmployee />} />
          <Route path="ws-manager" element={<WsManager />} />
          <Route path="ws-hr" element={<WsHr />} />
          <Route path="ws-exec" element={<WsExec />} />
          <Route path="my-channel" element={<MyChannel />} />
          <Route path="my-profile" element={<MyProfile />} />
          <Route path="my-gap" element={<MyGap />} />
          <Route path="cert-apply" element={<CertApply />} />
          <Route path="my-cert" element={<MyCert />} />
          <Route path="cert-review" element={<CertReview />} />
          <Route path="cert-vote" element={<CertVote />} />
          <Route path="talent-profile" element={<TalentProfile />} />
          <Route path="profile-compare" element={<ProfileCompare />} />
          <Route path="notifications" element={<Notifications />} />
          {/* 批次 4 · 盘点 · 九宫格 · 驾驶舱 */}
          <Route path="inv-batches" element={<InvBatches />} />
          <Route path="inv-create" element={<InvCreate />} />
          <Route path="inv-calibrate" element={<InvCalibrate />} />
          <Route path="nine-grid" element={<NineGrid />} />
          <Route path="grid-track" element={<GridTrack />} />
          <Route path="grid-strategy" element={<GridStrategy />} />
          <Route path="three-charts" element={<ThreeCharts />} />
          <Route path="cockpit-qa" element={<CockpitQA />} />
          <Route path="structure-viz" element={<StructureViz />} />
          <Route path="gap-warning" element={<GapWarning />} />
          <Route path="liquid-team" element={<LiquidTeam />} />
          {/* 批次 5 · 差距 · 发展 · 绩效 */}
          <Route path="gap-board" element={<GapBoard />} />
          <Route path="gap-action" element={<GapAction />} />
          <Route path="initial-inventory" element={<InitialInventory />} />
          <Route path="learn-map" element={<LearnMap />} />
          <Route path="exam-center" element={<ExamCenter />} />
          <Route path="exam-take" element={<ExamTake />} />
          <Route path="exam-review" element={<ExamReview />} />
          <Route path="idp" element={<Idp />} />
          <Route path="perf-import" element={<PerfImport />} />
          <Route path="improvement-board" element={<ImprovementBoard />} />
          <Route path="coaching" element={<Coaching />} />
          {/* 批次 6 · 继任与梯队 */}
          <Route path="core-positions" element={<CorePositions />} />
          <Route path="succession-matrix" element={<SuccessionMatrix />} />
          <Route path="risk-warning" element={<RiskWarning />} />
          <Route path="willingness" element={<Willingness />} />
          <Route path="talent-pool" element={<TalentPool />} />
          <Route path="ab-roles" element={<AbRoles />} />
          <Route path="pool-training" element={<PoolTraining />} />
          {/* 批次 7 · 工资与调薪 */}
          <Route path="salary-table" element={<SalaryTable />} />
          <Route path="market-data" element={<MarketData />} />
          <Route path="salary-plan" element={<SalaryPlan />} />
          <Route path="salary-approve" element={<SalaryApprove />} />
          <Route path="salary-report" element={<SalaryReport />} />
          <Route path="page/:key" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
