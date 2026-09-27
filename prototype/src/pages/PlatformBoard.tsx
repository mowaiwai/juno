import { useMemo } from 'react';
import { Card, Col, Row, Tag } from 'antd';
import ReactECharts from 'echarts-for-react';
import { industryDist, mrrTrend, planDist, platformKpi, platformTenants } from '@/mock/saas';

export function PlatformBoard() {
  const mrrOption = useMemo(
    () => ({
      grid: { left: 50, right: 24, top: 30, bottom: 28 },
      tooltip: { trigger: 'axis' as const, valueFormatter: (v: number) => v + ' 万元' },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: mrrTrend.map((t) => t.month),
        axisLine: { lineStyle: { color: '#e7e3d9' } },
        axisLabel: { color: '#8a857a' },
      },
      yAxis: {
        type: 'value' as const,
        name: '万元',
        nameTextStyle: { color: '#8a857a' },
        splitLine: { lineStyle: { color: '#e7e3d9' } },
        axisLabel: { color: '#8a857a' },
      },
      series: [
        {
          name: 'MRR',
          type: 'line' as const,
          data: mrrTrend.map((t) => t.mrr),
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: '#d97757', width: 2.5 },
          itemStyle: { color: '#d97757' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(217,119,87,0.28)' },
                { offset: 1, color: 'rgba(217,119,87,0.02)' },
              ],
            },
          },
        },
      ],
    }),
    [],
  );

  const pieCommon = (data: { name: string; value: number }[], colors: string[]) => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#57534b' }, itemWidth: 10, itemHeight: 10 },
    color: colors,
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        data,
      },
    ],
  });

  const risky = [...platformTenants].sort((a, b) => a.health - b.health).slice(0, 4);

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">平台运营看板</h1>
          <div className="page-subtitle">平台方视角：收入、租户、席位与 AI 资源总览（不含员工明文）</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>数据截至 2026-09-27</Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: 'MRR（月经常性收入）', value: '¥68.2 万', sub: '环比 +6.1%' },
          { label: '付费 / 总租户', value: `${platformKpi.payingTenants} / ${platformKpi.totalTenants}`, sub: `试用 ${platformKpi.trialTenants} · 停用 ${platformKpi.suspended}` },
          { label: '付费席位', value: platformKpi.paidSeats.toLocaleString(), sub: '户均 86 席' },
          { label: '平台月 Token 消耗', value: '4.2B', sub: 'AI 资源池水位 62%' },
          { label: '本月新增租户', value: platformKpi.newTenantsThisMonth, sub: '目标 12，完成 92%' },
          { label: '试用→付费转化', value: platformKpi.trialConversion + '%', sub: '高于上月 3pct' },
        ].map((s, i) => (
          <Col span={4} key={i}>
            <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="MRR 增长趋势（近 6 个月）">
            <ReactECharts option={mrrOption} style={{ height: 290 }} />
          </Card>
        </Col>
        <Col span={7}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="租户行业分布">
            <ReactECharts
              option={pieCommon(industryDist, ['#d97757', '#7fa09b', '#c2a05a', '#7e9b78', '#b4afa4'])}
              style={{ height: 290 }}
            />
          </Card>
        </Col>
        <Col span={7}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="套餐结构分布">
            <ReactECharts
              option={pieCommon(planDist, ['#b4afa4', '#7fa09b', '#d97757', '#2b2825'])}
              style={{ height: 290 }}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="重点关注租户（健康度最低，CSM 跟进）">
        <Row gutter={16}>
          {risky.map((t) => {
            const color = t.health >= 80 ? 'var(--sage)' : t.health >= 60 ? 'var(--ochre)' : 'var(--danger)';
            return (
              <Col span={6} key={t.id}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>{t.name}</span>
                    <span className="num" style={{ color, fontWeight: 700 }}>{t.health}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', margin: '4px 0 8px' }}>
                    {t.industry} · {t.plan} · {t.seats} 席
                  </div>
                  <Tag
                    style={{ borderRadius: 4, margin: 0, background: t.status === 'active' ? 'var(--sage-soft)' : t.status === 'trial' ? 'var(--ochre-soft)' : 'var(--danger-soft)', color: t.status === 'active' ? 'var(--sage)' : t.status === 'trial' ? 'var(--ochre)' : 'var(--danger)', borderColor: 'transparent' }}
                  >
                    {t.status === 'active' ? '正式' : t.status === 'trial' ? '试用' : '已停用'}
                  </Tag>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>
    </div>
  );
}
