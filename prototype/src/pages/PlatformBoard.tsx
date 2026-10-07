import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Spin, Tag, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { platformApi, PlatformDashboard, TenantOut } from '@/api/platform';
import { CHART, MACARON } from '@/charts/palette';

export function PlatformBoard() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    platformApi.getDashboard()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) message.error(e.message ?? '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const mrrOption = useMemo(() => {
    const trend = data?.mrr_trend ?? [];
    return {
      grid: { left: 60, right: 24, top: 30, bottom: 28 },
      tooltip: { trigger: 'axis' as const, valueFormatter: (v: number) => '¥' + v.toLocaleString() },
      xAxis: {
        type: 'category' as const,
        boundaryGap: false,
        data: trend.map((t) => t.month),
        axisLine: { lineStyle: { color: CHART.line } },
        axisLabel: { color: CHART.ink3 },
      },
      yAxis: {
        type: 'value' as const,
        name: '元',
        nameTextStyle: { color: CHART.ink3 },
        splitLine: { lineStyle: { color: CHART.line } },
        axisLabel: { color: CHART.ink3 },
      },
      series: [
        {
          name: 'MRR',
          type: 'line' as const,
          data: trend.map((t) => t.mrr),
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: CHART.primary, width: 2.5 },
          itemStyle: { color: CHART.primary },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(217,106,142,0.28)' },
                { offset: 1, color: 'rgba(217,106,142,0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  const pieCommon = (values: { name: string; value: number }[], colors: string[]) => ({
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: CHART.ink2 }, itemWidth: 10, itemHeight: 10 },
    color: colors,
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        data: values,
      },
    ],
  });

  const kpis = data ? [
    { label: 'MRR（月经常性收入）', value: '¥' + (data.mrr / 10000).toFixed(1) + ' 万', sub: `付费席位 ${data.paid_seats.toLocaleString()}` },
    { label: '付费 / 总租户', value: `${data.paying_tenants} / ${data.total_tenants}`, sub: `试用 ${data.trial_tenants} · 停用 ${data.suspended}` },
    { label: '付费席位', value: data.paid_seats.toLocaleString(), sub: '仅统计正式租户' },
    { label: '平台月 Token 消耗', value: '—', sub: 'AI 资源池（跨租户汇总）' },
    { label: '本月新增租户', value: data.new_tenants_this_month, sub: '来自月度指标快照' },
    { label: '试用→付费转化', value: data.trial_conversion + '%', sub: '正式 / (正式 + 试用)' },
  ] : [];

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">平台运营看板</h1>
          <div className="page-subtitle">平台方视角：收入、租户、席位与 AI 资源总览（不含员工明文）</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>仅 platform_admin 可见</Tag>
      </div>

      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {kpis.map((s, i) => (
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
                option={pieCommon(data?.industry_dist ?? [], MACARON.slice(0, 5))}
                style={{ height: 290 }}
              />
            </Card>
          </Col>
          <Col span={7}>
            <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="套餐结构分布">
              <ReactECharts
                option={pieCommon(data?.plan_dist ?? [], [CHART.ink4, CHART.sky, CHART.primary, CHART.plum])}
                style={{ height: 290 }}
              />
            </Card>
          </Col>
        </Row>

        <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="重点关注租户（健康度最低，CSM 跟进）">
          <Row gutter={16}>
            {(data?.risky_tenants ?? []).map((t: TenantOut) => {
              const color = t.health >= 80 ? 'var(--sage)' : t.health >= 60 ? 'var(--ochre)' : 'var(--danger)';
              return (
                <Col span={6} key={t.id}>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700 }}>{t.name}</span>
                      <span className="num" style={{ color, fontWeight: 700 }}>{t.health}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', margin: '4px 0 8px' }}>
                      {t.industry ?? '未分类'} · {t.plan_name ?? '未开通'} · {t.seats} 席
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
      </Spin>
    </div>
  );
}
