import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';
import { StyleGuide } from '@/pages/StyleGuide';
import { ComingSoon } from '@/pages/ComingSoon';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="style-guide" element={<StyleGuide />} />
          <Route path="page/:key" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
