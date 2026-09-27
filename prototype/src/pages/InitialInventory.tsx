import ReactECharts from 'echarts-for-react';
import { Card, Col, Row, Space, Table, Tag } from 'antd';
import { initialInventory, LEVEL_LABEL } from '@/mock/gap';
import { CHART } from '@/charts/palette';

const LEVEL_COLOR = { qualified: CHART.mint, near: CHART.butter, need_improve: CHART.danger };

export function InitialInventory() {
  const data = initialInventory();
  const total = data.reduce((s, d) => s + d.headcount, 0);
  const qualified = data.filter((d) => d.level === 'qualified').reduce((s, d) => s + d.headcount, 0);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.grade),
      axisLine: { lineStyle: { color: CHART.line } },
      axisLabel: { color: CHART.ink2 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: CHART.ink2 },
      splitLine: { lineStyle: { color: CHART.line } },
    },
    series: [{
      type: 'bar',
      data: data.map((d) => ({
        value: d.headcount,
        itemStyle: { color: LEVEL_COLOR[d.level], borderRadius: [6, 6, 0, 0] },
      })),
      barWidth: 40,
      label: { show: true, position: 'top', color: CHART.ink2 },
    }],
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">人才初盘</h1>
          <div className="page-subtitle">各职级水平层级分布 · 先找核心岗位再盘知识能力</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总人数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--clay)' }}>{total}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>达标人数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--sage)' }}>{qualified}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>达标率</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)' }}>{Math.round((qualified / total) * 100)}%</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="各职级人数分布" size="small">
            <ReactECharts option={option} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="图例说明" size="small">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(['qualified', 'near', 'need_improve'] as const).map((lv) => (
                <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: LEVEL_COLOR[lv] }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{LEVEL_LABEL[lv]}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {lv === 'qualified' && '绩效 B 以上且潜力非低，可正常晋升/留用'}
                      {lv === 'near' && '接近达标，需补短板后进入达标区'}
                      {lv === 'need_improve' && '需启动绩效改进或能力提升计划'}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="职级水平层级明细" size="small">
        <Table
          rowKey="grade"
          dataSource={data}
          pagination={false}
          columns={[
            { title: '职级', dataIndex: 'grade' },
            { title: '人数', dataIndex: 'headcount' },
            {
              title: '水平层级',
              dataIndex: 'level',
              render: (v: 'qualified' | 'near' | 'need_improve') => (
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[v] + '22', color: LEVEL_COLOR[v], borderColor: 'transparent' }}>
                  {LEVEL_LABEL[v]}
                </Tag>
              ),
            },
            { title: '达标率', dataIndex: 'ratio', render: (v: number) => `${Math.round(v * 100)}%` },
          ]}
        />
      </Card>
    </div>
  );
}
