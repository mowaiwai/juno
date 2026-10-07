import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Col, List, Row, Space, Spin, Tag } from 'antd';
import { AppstoreOutlined, DashboardOutlined, TeamOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { CHART } from '@/charts/palette';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import { platformApi, type PlatformDashboard } from '@/api/platform';
import { industryDist, mrrTrend, platformKpi, platformTenants } from '@/mock/saas';

const QUICK = [
  { to: '/app/platform-tenants', icon: <TeamOutlined />, label: '租户管理', desc: '开通 / 停用 · 套餐续费' },
  { to: '/app/platform-board', icon: <DashboardOutlined />, label: '运营看板', desc: '收入 · 席位 · 资源' },
  { to: '/app/template-market', icon: <AppstoreOutlined />, label: '模板运营', desc: '行业包上架与版本（平台侧）' },
];

const PLATFORM_TODOS = [
  { t: '试用租户临近转化窗口，安排 CSM 转化沟通', tag: '转化', color: CHART.butter },
  { t: '已停用租户关注数据保留期到期', tag: '留存', color: CHART.danger },
  { t: '行业试行包待审核上架材料', tag: '模板', color: CHART.sky },
  { t: '续费合同临近到期，提前跟进', tag: '续费', color: CHART.mint },
];

const mockSparkOption = {
  grid: { left: 8, right: 8, top: 8, bottom: 8 },
  xAxis: { type: 'category' as const, show: false, data: mrrTrend.map((t) => t.month), boundaryGap: false },
  yAxis: { type: 'value' as const, show: false },
  tooltip: { trigger: 'axis' as const },
  series: [
    {
      type: 'line' as const,
      data: mrrTrend.map((t) => t.mrr),
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART.primary, width: 2 },
      areaStyle: { color: 'rgba(217,106,142,0.18)' },
    },
  ],
};

function buildSpark(trend: { month: string; mrr: number }[]) {
  return {
    grid: { left: 8, right: 8, top: 8, bottom: 8 },
    xAxis: { type: 'category' as const, show: false, data: trend.map((t) => t.month), boundaryGap: false },
    yAxis: { type: 'value' as const, show: false },
    tooltip: { trigger: 'axis' as const },
    series: [
      {
        type: 'line' as const,
        data: trend.map((t) => t.mrr),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: CHART.primary, width: 2 },
        areaStyle: { color: 'rgba(217,106,142,0.18)' },
      },
    ],
  };
}

// ============ 真实数据分支 ============

function RealWsPlatform() {
  const [d, setD] = useState<PlatformDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformApi
      .getDashboard()
      .then(setD)
      .catch((e) => setError(e instanceof ApiError ? e.message : '平台看板加载失败'));
  }, []);

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <Alert type="error" showIcon message="平台看板加载失败" description={error} />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="page" style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const mrrWan = (d.mrr / 10000).toFixed(1);
  const avgSeats = d.paying_tenants > 0 ? Math.round(d.paid_seats / d.paying_tenants) : 0;
  const riskiest = d.risky_tenants.length > 0 ? [...d.risky_tenants].sort((a, b) => a.health - b.health)[0] : null;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">平台管理员工作台</h1>
          <div className="page-subtitle">Juno 平台 · 租户、收入与模板运营（不可见员工明文）</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>MRR</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>¥{mrrWan} 万</div>
            {d.mrr_trend.length > 0 && <ReactECharts option={buildSpark(d.mrr_trend)} style={{ height: 44 }} />}
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>租户（付费 / 试用）</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
              {d.paying_tenants} <span style={{ color: 'var(--ochre)', fontSize: 15 }}>/ {d.trial_tenants}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>本月新增 {d.new_tenants_this_month} · 停用 {d.suspended}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>付费席位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{d.paid_seats.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>户均 {avgSeats} 席</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>试用转化率</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{d.trial_conversion}%</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>付费 / (付费 + 试用)</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="快捷入口">
            <Row gutter={[16, 16]}>
              {QUICK.map((q) => (
                <Col span={8} key={q.to}>
                  <Link to={q.to}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, height: '100%' }}>
                      <div style={{ fontSize: 18, color: 'var(--clay)', marginBottom: 8 }}>{q.icon}</div>
                      <div style={{ fontWeight: 700 }}>{q.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{q.desc}</div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="租户行业结构（租户户数）">
            {d.industry_dist.length === 0 ? (
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>暂无租户</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {d.industry_dist.map((it) => (
                  <Tag key={it.name} style={{ borderRadius: 6, padding: '2px 10px', margin: 0 }}>
                    {it.name} <span className="num" style={{ fontWeight: 700 }}>{it.value} 户</span>
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="平台待办">
            <List
              size="small"
              dataSource={PLATFORM_TODOS}
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
          平台账号仅管理租户级聚合数据；当前重点关注健康度较低的
          {' '}{riskiest ? <b>{riskiest.name}（健康度 {riskiest.health}）</b> : '租户'}，
          详细跟进在租户管理页。
        </div>
      </Card>
    </div>
  );
}

// ============ Mock 分支（VITE_USE_MOCK=true 时保留原型） ============

function MockWsPlatform() {
  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">平台管理员工作台</h1>
          <div className="page-subtitle">Juno 平台 · 租户、收入与模板运营（不可见员工明文）</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>MRR</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>¥68.2 万</div>
            <ReactECharts option={mockSparkOption} style={{ height: 44 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>租户（付费 / 试用）</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
              {platformKpi.payingTenants} <span style={{ color: 'var(--ochre)', fontSize: 15 }}>/ {platformKpi.trialTenants}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>本月新增 {platformKpi.newTenantsThisMonth} · 停用 {platformKpi.suspended}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>付费席位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{platformKpi.paidSeats.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>户均 86 席</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>试用转化率</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{platformKpi.trialConversion}%</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>目标 35%，差距 1pct</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="快捷入口">
            <Row gutter={[16, 16]}>
              {QUICK.map((q) => (
                <Col span={8} key={q.to}>
                  <Link to={q.to}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, height: '100%' }}>
                      <div style={{ fontSize: 18, color: 'var(--clay)', marginBottom: 8 }}>{q.icon}</div>
                      <div style={{ fontWeight: 700 }}>{q.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{q.desc}</div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="租户行业结构">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {industryDist.map((it) => (
                <Tag key={it.name} style={{ borderRadius: 6, padding: '2px 10px', margin: 0 }}>
                  {it.name} <span className="num" style={{ fontWeight: 700 }}>{it.value}%</span>
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="平台待办">
            <List
              size="small"
              dataSource={[
                { t: '启明智造试用第 12 天，CSM 安排转化沟通', tag: '转化', color: CHART.butter },
                { t: '卓信电子已停用 38 天，数据保留期剩 52 天', tag: '留存', color: CHART.danger },
                { t: '医疗服务试行包 v0.9 待审核上架材料', tag: '模板', color: CHART.sky },
                { t: '中拓贸易续费合同 10 月到期，提前跟进', tag: '续费', color: CHART.mint },
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
          平台账号仅管理租户级聚合数据；当前重点关注健康度较低的 {[...platformTenants].sort((a, b) => a.health - b.health)[0].name}，
          详细跟进在租户管理页。
        </div>
      </Card>
    </div>
  );
}

export function WsPlatform() {
  return USE_MOCK ? <MockWsPlatform /> : <RealWsPlatform />;
}
