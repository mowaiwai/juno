import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Divider, Form, Input, Tag } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { personas } from '@/mock/people';
import { useAuth } from '@/store/auth';
import { resolveRoleMeta } from '@/auth/rbac';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';

const TEST_ACCOUNTS: Array<[string, string]> = [
  ['employee@juno.test', '员工（许星遥，P3→P4 认证）'],
  ['manager@juno.test', '部门经理（初审）'],
  ['rev1@juno.test', '认证小组评委'],
  ['lead@juno.test', '评审组长（终裁）'],
  ['hr@juno.test', 'HRD（COE/HRBP/SSC 七角色）'],
];

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const enterMock = (id: string) => {
    void login(id);
    navigate('/app/home', { replace: true });
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await login(values.email.trim(), values.password);
      navigate('/app/home', { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? '邮箱或密码错误，请重试'
          : '登录失败，请检查后端服务是否启动',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '20px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--charcoal)',
              color: 'var(--paper)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            J
          </div>
          <span style={{ fontWeight: 700 }}>Juno · AI+HR 智能体系统</span>
        </div>
        <Tag style={{ borderRadius: 6, color: 'var(--ink-3)' }}>
          {USE_MOCK ? '高保真可点击原型 · 数据均为虚拟' : '联调环境 · 虚拟租户'}
        </Tag>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 40px 60px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {USE_MOCK ? (
          <>
            <h1
              className="font-serif"
              style={{
                fontSize: 40,
                lineHeight: 1.25,
                margin: '0 0 10px',
                letterSpacing: '-0.01em',
                maxWidth: 720,
              }}
            >
              以任职资格与绩效为双中心，
              <br />
              让每一次人才判断都有依据。
            </h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 15, marginBottom: 36 }}>
              选择一个角色身份进入系统；同一人持有多角色时，可在顶部随时切换视角。
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => enterMock(p.id)}
                  className="persona-card"
                  style={{
                    textAlign: 'left',
                    padding: 20,
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'all .18s ease',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 17,
                        fontWeight: 650,
                        background:
                          p.roles.length > 1
                            ? 'var(--clay-soft)'
                            : 'var(--paper-soft)',
                        color:
                          p.roles.length > 1
                            ? 'var(--clay-hover)'
                            : 'var(--ink-2)',
                      }}
                    >
                      {p.name.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 650, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {p.title}
                      </div>
                    </div>
                  </div>
                  <Divider style={{ margin: '14px 0' }} />
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      minHeight: 38,
                    }}
                  >
                    {p.blurb}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.roles.map((r) => (
                      <Tag
                        key={r}
                        style={{
                          margin: 0,
                          borderRadius: 6,
                          fontSize: 11,
                          background: 'var(--surface-sunken)',
                          borderColor: 'var(--line)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {resolveRoleMeta(r, p.roleRefs).label}
                      </Tag>
                    ))}
                    {p.roles.length > 1 && (
                      <Tag
                        style={{
                          margin: 0,
                          borderRadius: 6,
                          fontSize: 11,
                          background: 'var(--clay-soft)',
                          borderColor: 'var(--clay-soft)',
                          color: 'var(--clay-hover)',
                        }}
                      >
                        多角色可切换
                      </Tag>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ maxWidth: 420 }}>
            <h1
              className="font-serif"
              style={{ fontSize: 34, lineHeight: 1.25, margin: '0 0 8px' }}
            >
              登录 Juno
            </h1>
            <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 28 }}>
              请输入邮箱与密码进入虚拟租户「星野制造」。
            </p>

            {error && (
              <Alert
                type="error"
                message={error}
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />
            )}

            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="邮箱"
                  size="large"
                  autoComplete="username"
                />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                登录
              </Button>
            </Form>

            <Divider style={{ margin: '20px 0 14px' }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>测试账号（密码统一 Juno12345）</span>
            </Divider>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEST_ACCOUNTS.map(([email, desc]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => {
                    void onFinish({ email, password: 'Juno12345' });
                  }}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{email}</span>
                  <span style={{ color: 'var(--ink-3)' }}>{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
