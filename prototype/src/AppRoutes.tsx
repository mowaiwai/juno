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
          <Route path="page/:key" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
