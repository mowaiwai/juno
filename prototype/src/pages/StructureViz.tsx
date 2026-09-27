import ReactECharts from 'echarts-for-react';
import { Card, Col, Row, Space, Table, Tag } from 'antd';
import { deptStructures } from '@/mock/inventory';
import { CHART, GRADE_RAMP } from '@/charts/palette';

const GRADE_ORDER = ['P2', 'P3', 'P4', 'P5', 'M1', 'M2', 'M3', 'O2', 'O3', 'S2', 'S3', 'S4', 'T3'];
const GRADE_COLORS = GRADE_RAMP;

const SHAPE_COLOR: Record<string, string> = {
  dumbbell: CHART.danger,
  diamond: CHART.butter,
  pyramid: CHART.sky,
  healthy: CHART.mint,
};

export function StructureViz() {
  const structs = deptStructures();

  // 堆积柱：X=部门，系列=职级
  const grades = Array.from(new Set(structs.flatMap((s) => Object.keys(s.gradeCount)))).sort(
    (a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b),
  );

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: grades, textStyle: { color: CHART.ink2 }, type: 'scroll' },
    grid: { left: 40, right: 20, top: 50, bottom: 40 },
    xAxis: {
      type: 'category',
      data: structs.map((s) => s.deptName),
      axisLine: { lineStyle: { color: CHART.line } },
      axisLabel: { color: CHART.ink2 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: CHART.ink2 },
      splitLine: { lineStyle: { color: CHART.line } },
    },
    series: grades.map((g, i) => ({
      name: g,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: structs.map((s) => s.gradeCount[g] ?? 0),
      itemStyle: { color: GRADE_COLORS[i % GRADE_COLORS.length] },
      barWidth: 40,
    })),
  };

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">人才结构可视化</h1>
          <div className="page-subtitle">职级×序列分布 · 自动识别哑铃型/菱形结构，支撑结构优化</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总人数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--clay)' }}>{structs.reduce((s, d) => s + d.headcount, 0)}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>哑铃型部门</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{structs.filter((s) => s.shape === 'dumbbell').length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>中坚层平均占比</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)' }}>{Math.round((structs.reduce((s, d) => s + d.midRatio, 0) / structs.length) * 100)}%</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="各部门职级分布">
        <ReactECharts option={option} style={{ height: 400 }} />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="结构类型识别" size="small">
        <Table
          rowKey="deptId"
          dataSource={structs}
          pagination={false}
          columns={[
            { title: '部门', dataIndex: 'deptName', render: (v, r) => (
              <Space>
                <span style={{ fontWeight: 600 }}>{v}</span>
                <Tag style={{ borderRadius: 6, background: SHAPE_COLOR[r.shape] + '22', color: SHAPE_COLOR[r.shape], borderColor: 'transparent' }}>{r.shapeLabel}</Tag>
              </Space>
            )},
            { title: '人数', dataIndex: 'headcount' },
            { title: '中坚层占比', dataIndex: 'midRatio', render: (v: number) => `${Math.round(v * 100)}%` },
            { title: '职级分布', dataIndex: 'gradeCount', render: (v: Record<string, number>) => (
              <Space size={4} wrap>
                {Object.entries(v).sort((a, b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0])).map(([g, c]) => (
                  <Tag key={g} style={{ borderRadius: 4, fontSize: 11 }}>{g}×{c}</Tag>
                ))}
              </Space>
            )},
            { title: '结构建议', render: (_: unknown, r) => {
              if (r.shape === 'dumbbell') return <span style={{ color: 'var(--danger)' }}>中坚断层，加速中坚培养与招聘</span>;
              if (r.shape === 'diamond') return <span style={{ color: 'var(--ochre)' }}>中坚偏厚，关注晋升通道与出口</span>;
              return <span style={{ color: 'var(--sage)' }}>结构健康</span>;
            }},
          ]}
        />
      </Card>
    </div>
  );
}
