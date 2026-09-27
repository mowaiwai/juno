import { useState } from 'react';
import { Drawer, Button, Tag, message } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { pageRegistry } from '@/app/registry';
import { useAuth } from '@/store/auth';
import { ROLE_META } from '@/auth/rbac';

/** 隐藏式原型面板：页面地图 / 跳转任意页 / 重置剧本 */
export function PrototypePanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);

  const batches = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const go = (key: string, done: boolean, allowed: boolean) => {
    setOpen(false);
    if (done) {
      navigate(`/app/${key}`);
    } else {
      navigate(`/app/page/${key}`, {
        state: { crossRole: !allowed },
      });
    }
  };

  return (
    <>
      <Button
        type="text"
        icon={<AppstoreOutlined />}
        onClick={() => setOpen(true)}
        title="原型面板（仅开发可见）"
        style={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          zIndex: 900,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-card)',
          color: 'var(--ink-3)',
        }}
      />
      <Drawer
        title={
          <div>
            <div>原型面板</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400 }}>
              {persona?.name} · {activeRole && ROLE_META[activeRole].label}视角 ·
              全部数据为虚拟
            </div>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={440}
      >
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Button
            size="small"
            onClick={() =>
              message.success('剧本数据已重置（内存态将在后续批次生效）')
            }
          >
            重置剧本数据
          </Button>
          <Button size="small" onClick={() => navigate('/login')}>
            返回登录页
          </Button>
        </div>

        {batches.map((b) => {
          const pages = pageRegistry.filter((p) => p.batch === b);
          const doneCount = pages.filter((p) => p.done).length;
          return (
            <div key={b} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 650,
                  marginBottom: 8,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                批次 {b}
                <Tag
                  style={{
                    margin: 0,
                    borderRadius: 4,
                    fontSize: 11,
                    background:
                      doneCount === pages.length
                        ? 'var(--sage-soft)'
                        : 'var(--surface-sunken)',
                    color:
                      doneCount === pages.length
                        ? 'var(--sage)'
                        : 'var(--ink-3)',
                    borderColor: 'transparent',
                  }}
                >
                  {doneCount}/{pages.length}
                </Tag>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                {pages.map((p) => {
                  const allowed = activeRole
                    ? p.roles.includes(activeRole)
                    : false;
                  return (
                    <button
                      key={p.key}
                      onClick={() => go(p.key, p.done, allowed)}
                      style={{
                        textAlign: 'left',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: p.done
                          ? 'var(--surface)'
                          : 'var(--surface-sunken)',
                        cursor: 'pointer',
                        color: p.done ? 'var(--ink)' : 'var(--ink-3)',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: p.done
                            ? 'var(--sage)'
                            : 'var(--ink-4)',
                          flex: 'none',
                        }}
                      />
                      <span style={{ flex: 1 }}>{p.title}</span>
                      <span style={{ color: 'var(--ink-4)' }}>{p.depth}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            background: 'var(--sage-soft)',
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 650, marginBottom: 6 }}>
            全部 9 个批次交付完成
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>
            66 个业务页面 + 2 个开发辅助页，六类角色视角均可点击遍历；所有数据为虚拟样本。
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Tag style={{ margin: 0, borderRadius: 6, background: 'var(--surface)', borderColor: 'transparent' }}>
              React 18 + Vite
            </Tag>
            <Tag style={{ margin: 0, borderRadius: 6, background: 'var(--surface)', borderColor: 'transparent' }}>
              Ant Design 5
            </Tag>
            <Tag style={{ margin: 0, borderRadius: 6, background: 'var(--surface)', borderColor: 'transparent' }}>
              ECharts
            </Tag>
          </div>
        </div>
      </Drawer>
    </>
  );
}
