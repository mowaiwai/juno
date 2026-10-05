import { useParams, useLocation, Link } from 'react-router-dom';
import { Tag, Button, Empty, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getPage } from '@/app/registry';
import { resolveRoleMeta } from '@/auth/rbac';
import { useAuth } from '@/store/auth';

const depthLabel: Record<string, string> = {
  '●': '主路径可操作',
  '◐': '真实数据 + 部分交互',
  '○': '列表/详情壳',
};

export function ComingSoon() {
  const { key = '' } = useParams();
  const location = useLocation();
  const page = getPage(key);
  const activeRole = useAuth((s) => s.activeRole);
  const crossRole = (location.state as { crossRole?: boolean } | null)?.crossRole;

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <Link to="/app/home">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
          返回首页
        </Button>
      </Link>

      {!page ? (
        <Empty description="未找到该页面" />
      ) : (
        <div
          className="card-soft"
          style={{ padding: 32, background: 'var(--surface)' }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--ink)' }}>
                  {page.title}
                </div>
                <div style={{ color: 'var(--ink-3)', marginTop: 6 }}>
                  将在批次 {page.batch} 交付
                </div>
              </div>
            }
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: 24,
            }}
          >
            <div>
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>交互深度：</span>
              <Tag style={{ borderRadius: 6, marginLeft: 8 }}>
                {page.depth} {depthLabel[page.depth]}
              </Tag>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>所属分组：</span>
              <Tag style={{ borderRadius: 6, marginLeft: 8 }}>{page.group}</Tag>
            </div>
            <div>
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>访问角色：</span>
              <span style={{ marginLeft: 8 }}>
                {page.roles.map((r) => (
                  <Tag
                    key={r}
                    style={{
                      borderRadius: 6,
                      marginBottom: 4,
                      background:
                        r === activeRole ? 'var(--sage-soft)' : undefined,
                      color: r === activeRole ? 'var(--sage)' : undefined,
                    }}
                  >
                    {resolveRoleMeta(r).label}
                  </Tag>
                ))}
              </span>
            </div>
            {page.note && (
              <Alert
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--line)' }}
                message={page.note}
                type="info"
                showIcon
              />
            )}
            {crossRole && (
              <Alert
                style={{ background: 'var(--clay-soft)', borderColor: 'var(--clay-soft)' }}
                message="跨角色预览：当前激活角色无权访问此页面，仅原型面板可查看其规划信息。"
                type="warning"
                showIcon
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
