import { Link } from 'react-router-dom';
import { Card, Col, List, Row, Space, Tag } from 'antd';
import { AppstoreOutlined, DashboardOutlined, TeamOutlined } from '@ant-design/icons';
import { industryDist, mrrTrend, platformKpi, platformTenants } from '@/mock/saas';
import ReactECharts from 'echarts-for-react';
import { CHART } from '@/charts/palette';

const QUICK = [
  { to: '/app/platform-tenants', icon: <TeamOutlined />, label: '租户管理', desc: '开通 / 停用 · 套餐续费' },
  { to: '/app/platform-board', icon: <DashboardOutlined />, label: '运营看板', desc: '收入 · 席位 · 资源' },
  { to: '/app/template-market', icon: <AppstoreOutlined />, label: '模板运营', desc: '行业包上架与版本（平台侧）' },
];

const sparkOption = {
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

export function WsPlatform() {
  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">平台管理员工作台</h1>
          <div className="page-subtitle">华砺人才平台 · 租户、收入与模板运营（不可见员工明文）</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>MRR</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>¥68.2 万</div>
            <ReactECharts option={sparkOption} style={{ height: 44 }} />
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
              {industryDist.map((d) => (
                <Tag key={d.name} style={{ borderRadius: 6, padding: '2px 10px', margin: 0 }}>
                  {d.name} <span className="num" style={{ fontWeight: 700 }}>{d.value}%</span>
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
