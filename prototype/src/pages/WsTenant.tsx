import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Col, Empty, List, Progress, Row, Space, Spin, Tag } from 'antd';
import {
  AppstoreOutlined,
  ControlOutlined,
  FileTextOutlined,
  FundOutlined,
} from '@ant-design/icons';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import {
  saasApi,
  type AiQuotaOut,
  type BillOut,
  type ConfigItemOut,
  type TemplatePackOut,
} from '@/api/saas';
import { aiQuota, bills, configItems, templatePacks } from '@/mock/saas';

const QUICK = [
  { to: '/app/config-center', icon: <ControlOutlined />, label: '配置中心', desc: '规则模板与租户覆盖' },
  { to: '/app/template-market', icon: <AppstoreOutlined />, label: '模板市场', desc: '行业包导入与升级' },
  { to: '/app/ai-usage', icon: <FundOutlined />, label: 'AI 用量', desc: '配额、流水与费用' },
  { to: '/app/billing', icon: <FileTextOutlined />, label: '套餐与账单', desc: '席位订阅与支付' },
];

interface TenantStats {
  configs: ConfigItemOut[];
  templates: TemplatePackOut[];
  quota: AiQuotaOut;
  bills: BillOut[];
}

// ============ 真实数据分支 ============

function RealWsTenant() {
  const [s, setS] = useState<TenantStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      saasApi.listConfig(),
      saasApi.listTemplates(),
      saasApi.getAiQuota(),
      saasApi.listBills(),
    ])
      .then(([configs, templates, quota, billList]) => setS({ configs, templates, quota, bills: billList }))
      .catch((e) => setError(e instanceof ApiError ? e.message : '工作台数据加载失败'));
  }, []);

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <Alert type="error" showIcon message="工作台数据加载失败" description={error} />
      </div>
    );
  }
  if (!s) {
    return (
      <div className="page" style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const draftCount = s.configs.filter((c) => c.status === 'draft').length;
  const installedCount = s.templates.filter((t) => t.installed).length;
  const usagePct = s.quota.usage_pct;
  const unpaid = s.bills.filter((b) => b.status !== 'paid');
  const nearestUnpaid = unpaid.slice().sort((a, b) => b.period.localeCompare(a.period))[0];
  const currentPlan = s.bills.slice().sort((a, b) => b.period.localeCompare(a.period))[0]?.plan_name ?? '—';

  const todos: { t: string; tag: string; color: string }[] = [];
  if (draftCount > 0) todos.push({ t: `有 ${draftCount} 条配置草稿待发布`, tag: '配置', color: 'var(--ochre)' });
  if (nearestUnpaid) {
    todos.push({ t: `支付 ${nearestUnpaid.period} 账期账单 ¥${nearestUnpaid.total.toLocaleString()}`, tag: '账单', color: 'var(--clay)' });
  }
  const activeTpl = s.templates.find((t) => t.installed && t.active);
  if (activeTpl) todos.push({ t: `${activeTpl.name} ${activeTpl.version} 生效中`, tag: '模板', color: 'var(--teal)' });

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">租户管理员工作台</h1>
          <div className="page-subtitle">本租户配置、模板、AI 用量与账单（数据逻辑隔离，变更走草稿 → 发布并留审计）</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>配置项 / 草稿</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
              {s.configs.length} <span style={{ color: 'var(--ochre)', fontSize: 15 }}>/ {draftCount}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{draftCount > 0 ? `${draftCount} 条草稿待发布` : '全部已发布'}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已装模板</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{installedCount}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{installedCount > 0 ? '已装行业包生效中' : '尚未安装模板'}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本月 AI 配额使用</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{usagePct}%</div>
            <Progress percent={usagePct} size="small" strokeColor={usagePct >= 90 ? 'var(--danger)' : 'var(--sage)'} trailColor="var(--line)" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待支付账单</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: unpaid.length ? 'var(--clay)' : 'var(--sage)' }}>
              {unpaid.length} 笔
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              {nearestUnpaid ? `${nearestUnpaid.period} 账期 ¥${nearestUnpaid.total.toLocaleString()}` : '无待支付账单'}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="快捷入口">
            <Row gutter={[16, 16]}>
              {QUICK.map((q) => (
                <Col span={12} key={q.to}>
                  <Link to={q.to}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 18, color: 'var(--clay)' }}>{q.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{q.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{q.desc}</div>
                      </div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="待办">
            {todos.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" />
            ) : (
              <List
                size="small"
                dataSource={todos}
                renderItem={(it) => (
                  <List.Item style={{ paddingLeft: 0 }}>
                    <Space align="start">
                      <Tag style={{ borderRadius: 4, margin: '4px 0 0', background: it.color + '22', color: it.color, borderColor: 'transparent' }}>{it.tag}</Tag>
                      <span style={{ fontSize: 13 }}>{it.t}</span>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          本租户数据逻辑隔离，配置变更走「草稿 → 发布」并留审计；当前套餐 <b>{currentPlan}</b>，AI 费用随席位账单按月结算。
        </div>
      </Card>
    </div>
  );
}

// ============ Mock 分支（VITE_USE_MOCK=true 时保留原型） ============

function MockWsTenant() {
  const unpaid = bills.filter((b) => b.status !== '已支付');
  const usagePct = Math.round((aiQuota.monthUsedTokens / aiQuota.monthlyTokenQuota) * 100);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">租户管理员工作台</h1>
          <div className="page-subtitle">华砺精工 · 本租户配置、模板、用量与账单</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>配置项 / 草稿</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
              {configItems.length} <span style={{ color: 'var(--ochre)', fontSize: 15 }}>/ {configItems.filter((c) => c.status === 'draft').length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>1 条草稿待发布</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已装模板</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{templatePacks.filter((t) => t.installed).length}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>制造包生效中 · 均为最新</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本月 AI 配额使用</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{usagePct}%</div>
            <Progress percent={usagePct} size="small" strokeColor="var(--sage)" trailColor="var(--line)" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待支付账单</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: unpaid.length ? 'var(--clay)' : 'var(--sage)' }}>
              {unpaid.length} 笔
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>9 月账期 ¥5,833.4</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="快捷入口">
            <Row gutter={[16, 16]}>
              {QUICK.map((q) => (
                <Col span={12} key={q.to}>
                  <Link to={q.to}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 18, color: 'var(--clay)' }}>{q.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{q.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{q.desc}</div>
                      </div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="待办">
            <List
              size="small"
              dataSource={[
                { t: '发布 AI 模型灰度草稿（出题场景 30% 走 GLM-4）', tag: '配置', color: 'var(--ochre)' },
                { t: '支付 2026-09 账期账单 ¥5,833.4', tag: '账单', color: 'var(--clay)' },
                { t: '制造行业包 v2.2 升级预告：10 月发布，届时 diff 合入', tag: '模板', color: 'var(--teal)' },
              ]}
              renderItem={(it) => (
                <List.Item style={{ paddingLeft: 0 }}>
                  <Space align="start">
                    <Tag style={{ borderRadius: 4, margin: '4px 0 0', background: it.color + '22', color: it.color, borderColor: 'transparent' }}>{it.tag}</Tag>
                    <span style={{ fontSize: 13 }}>{it.t}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          本租户数据逻辑隔离，配置变更走「草稿 → 发布」并留审计；当前套餐 <b>专业版</b>，AI 费用随席位账单按月结算。
        </div>
      </Card>
    </div>
  );
}

export function WsTenant() {
  return USE_MOCK ? <MockWsTenant /> : <RealWsTenant />;
}
