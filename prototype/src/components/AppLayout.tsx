import { useEffect, useMemo, useRef } from 'react';
import { Layout, Menu, Avatar, Button } from 'antd';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { visibleDonePages } from '@/app/registry';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { PrototypePanel } from '@/components/PrototypePanel';

const { Sider, Header, Content } = Layout;

const GROUP_ORDER = [
  '工作台',
  '数据中枢',
  '应用中心',
  'SaaS 运营',
  '原型开发',
];

export function AppLayout() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  // 路由切换时内容区滚动复位
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const menuItems = useMemo(() => {
    if (!activeRole) return [];
    const pages = visibleDonePages(activeRole);
    const groups = [...new Set(pages.map((p) => p.group))].sort(
      (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
    );
    return groups.map((group) => ({
      key: group,
      label: group,
      type: 'group' as const,
      children: pages
        .filter((p) => p.group === group)
        .map((p) => ({
          key: `/app/${p.key === 'home' ? 'home' : p.key}`,
          label: p.title,
        })),
    }));
  }, [activeRole]);

  if (!persona || !activeRole) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider
        width={232}
        style={{
          background: 'rgba(251, 248, 244, 0.72)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRight: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--charcoal)',
              color: 'var(--paper)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            J
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 750, fontSize: 16, letterSpacing: '-0.01em' }}>Juno</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              AI+HR 智能体
            </div>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={menuItems.map((m) => m.key)}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderInlineEnd: 'none',
            padding: '8px 8px',
          }}
        />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        <Header
          style={{
            background: 'rgba(251, 248, 244, 0.72)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            {persona.tenantName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RoleSwitcher />
            <div
              style={{
                width: 1,
                height: 20,
                background: 'var(--line)',
                margin: '0 4px',
              }}
            />
            <Avatar
              size={32}
              style={{
                background: 'var(--clay-soft)',
                color: 'var(--clay-hover)',
                fontWeight: 600,
              }}
            >
              {persona.name.slice(0, 1)}
            </Avatar>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {persona.name}
            </span>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            />
          </div>
        </Header>
        <Content ref={contentRef} style={{ overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
      <PrototypePanel />
    </Layout>
  );
}
