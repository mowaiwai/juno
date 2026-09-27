import { useNavigate } from 'react-router-dom';
import { Tag, Divider } from 'antd';
import { personas } from '@/mock/people';
import { useAuth } from '@/store/auth';
import { ROLE_META } from '@/auth/rbac';

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const enter = (id: string) => {
    login(id);
    navigate('/app/home', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
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
              fontFamily: 'var(--font-serif)',
            }}
          >
            砺
          </div>
          <span style={{ fontWeight: 650 }}>华砺人才 · AI+HR 智能体系统</span>
        </div>
        <Tag style={{ borderRadius: 6, color: 'var(--ink-3)' }}>
          高保真可点击原型 · 66 页全部交付 · 数据均为虚拟
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
              onClick={() => enter(p.id)}
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
                    {ROLE_META[r].label}
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
      </main>
    </div>
  );
}
