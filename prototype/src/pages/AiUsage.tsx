import { useMemo } from 'react';
import { Card, Col, Progress, Row, Table, Tag } from 'antd';
import ReactECharts from 'echarts-for-react';
import { aiQuota, aiUsageRows, aiUsageTrend } from '@/mock/saas';

const fmtTokens = (v: number) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'k');

const SCENE_COLOR: Record<string, string> = {
  出题: '#d97757',
  归因: '#c2a05a',
  问答: '#7fa09b',
  预审: '#7e9b78',
  画像: '#2b2825',
  IDP: '#b5524a',
};

export function AiUsage() {
  const usagePct = Math.round((aiQuota.monthUsedTokens / aiQuota.monthlyTokenQuota) * 100);

  const option = useMemo(
    () => ({
      grid: { left: 44, right: 44, top: 36, bottom: 28 },
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['Token 用量（百万）', '费用（元）'], top: 0, textStyle: { color: '#57534b' }, itemWidth: 12 },
      xAxis: {
        type: 'category' as const,
        data: aiUsageTrend.map((t) => t.month),
        axisLine: { lineStyle: { color: '#e7e3d9' } },
        axisLabel: { color: '#8a857a' },
      },
      yAxis: [
        { type: 'value' as const, name: '百万 tokens', nameTextStyle: { color: '#8a857a' }, splitLine: { lineStyle: { color: '#e7e3d9' } }, axisLabel: { color: '#8a857a' } },
        { type: 'value' as const, name: '元', nameTextStyle: { color: '#8a857a' }, splitLine: { show: false }, axisLabel: { color: '#8a857a' } },
      ],
      series: [
        {
          name: 'Token 用量（百万）',
          type: 'bar' as const,
          data: aiUsageTrend.map((t) => t.tokens),
          barWidth: 22,
          itemStyle: { color: '#d97757', borderRadius: [5, 5, 0, 0] },
        },
        {
          name: '费用（元）',
          type: 'line' as const,
          yAxisIndex: 1,
          data: aiUsageTrend.map((t) => t.cost),
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: '#2b2825', width: 2 },
          itemStyle: { color: '#2b2825' },
        },
      ],
    }),
    [],
  );

  const sceneAgg = useMemo(() => {
    const map = new Map<string, { calls: number; tokens: number; cost: number }>();
    for (const r of aiUsageRows) {
      const cur = map.get(r.scene) ?? { calls: 0, tokens: 0, cost: 0 };
      cur.calls += 1;
      cur.tokens += r.inputTokens + r.outputTokens;
      cur.cost += r.cost;
      map.set(r.scene, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].tokens - a[1].tokens);
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">AI 用量报表</h1>
          <div className="page-subtitle">每次 AI 调用写 ai_usage 流水（场景/模型/token/费用）· 租户配额限流 · 计费与审计依据</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>2026 年 9 月</Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本月 Token 用量 / 配额</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
              {fmtTokens(aiQuota.monthUsedTokens)} <span style={{ color: 'var(--ink-4)', fontSize: 14 }}>/ {fmtTokens(aiQuota.monthlyTokenQuota)}</span>
            </div>
            <Progress percent={usagePct} size="small" strokeColor={usagePct > 85 ? 'var(--danger)' : 'var(--sage)'} trailColor="var(--line)" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>调用次数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{aiQuota.monthCalls.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>日均 614 次</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本月 AI 费用</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>¥{aiQuota.monthCost}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>预计月底 ¥340（随席位账单结算）</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>超限策略</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, lineHeight: 1.6 }}>{aiQuota.overStrategy}</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={15}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="近 6 个月用量与费用趋势">
            <ReactECharts option={option} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col span={9}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="场景用量（近 3 日流水口径）">
            {sceneAgg.map(([scene, v]) => (
              <div key={scene} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SCENE_COLOR[scene], marginRight: 6 }} />
                    {scene}
                  </span>
                  <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v.calls} 次 · ¥{v.cost.toFixed(3)}</span>
                </div>
                <Progress percent={Math.round((v.tokens / sceneAgg[0][1].tokens) * 100)} showInfo={false} size="small" strokeColor={SCENE_COLOR[scene]} trailColor="var(--line)" />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="用量流水（实时）">
        <Table
          rowKey="id"
          dataSource={aiUsageRows}
          pagination={false}
          size="middle"
          columns={[
            { title: '时间', width: 140, dataIndex: 'time' },
            {
              title: '场景',
              width: 90,
              render: (_: unknown, r) => (
                <Tag style={{ borderRadius: 6, background: SCENE_COLOR[r.scene] + '22', color: SCENE_COLOR[r.scene], borderColor: 'transparent', margin: 0 }}>
                  {r.scene}
                </Tag>
              ),
            },
            { title: '模型', width: 120, dataIndex: 'model' },
            { title: '输入 tokens', width: 120, render: (_: unknown, r) => <span className="num">{r.inputTokens.toLocaleString()}</span> },
            { title: '输出 tokens', width: 120, render: (_: unknown, r) => <span className="num">{r.outputTokens.toLocaleString()}</span> },
            { title: '费用', render: (_: unknown, r) => <span className="num" style={{ color: 'var(--clay)' }}>¥{r.cost.toFixed(3)}</span> },
            { title: '触发方', render: (_: unknown, r) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.operator}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
