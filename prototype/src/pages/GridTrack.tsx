import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Col, Row, Select, Space, Tag, Timeline } from 'antd';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { GRID_CELLS } from '@/mock/inventory';

/** 每个员工的历史九宫格轨迹（mock，按姓名首字母确定性生成） */
function historyOf(empId: string) {
  const e = employees.find((x) => x.id === empId)!;
  // 用 perf 推回历史：每往前一档，业绩列可能降一档
  const shift = (code: string, dx: number, dy: number) => {
    const col = code[1];
    const row = Number(code[2]);
    const cols = ['A', 'B', 'C'];
    const ci = Math.max(0, Math.min(2, cols.indexOf(col) + dx));
    const ri = Math.max(1, Math.min(3, row + dy));
    return `9${cols[ci]}${ri}`;
  };
  const now = e.grid;
  return [
    { batch: '2024 年度盘点', grid: shift(now, e.potential === 'HIGH' ? 0 : 1, e.potential === 'HIGH' ? 1 : 0) },
    { batch: '2025 年度盘点', grid: shift(now, e.perf === 'S' ? 0 : 1, 0) },
    { batch: '2026 半年度', grid: now },
  ];
}

export function GridTrack() {
  const [empId, setEmpId] = useState(employees[0].id);
  const emp = employees.find((e) => e.id === empId)!;
  const history = useMemo(() => historyOf(empId), [empId]);

  // 折线：X=批次，Y=九宫格行（数值），散点大小表示业绩列
  const option = {
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: history.map((h) => h.batch),
      axisLine: { lineStyle: { color: '#e7e3d9' } },
      axisLabel: { color: '#57534b' },
    },
    yAxis: {
      type: 'value',
      min: 1,
      max: 3,
      interval: 1,
      axisLabel: {
        color: '#57534b',
        formatter: (v: number) => ({ 1: '高潜', 2: '中潜', 3: '低潜' })[v],
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#e7e3d9', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: history.map((h) => Number(h.grid[2])),
        smooth: true,
        symbol: 'circle',
        symbolSize: 18,
        lineStyle: { color: '#d97757', width: 3 },
        itemStyle: { color: '#d97757', borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: (p: { dataIndex: number }) => history[p.dataIndex].grid, color: '#211f1c', fontWeight: 700, position: 'top' },
      },
    ],
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">位置轨迹</h1>
          <div className="page-subtitle">员工在历次盘点中的九宫格位置变化，识别成长趋势与风险</div>
        </div>
        <Select
          value={empId}
          onChange={setEmpId}
          style={{ width: 240 }}
          showSearch
          optionFilterProp="label"
          options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="员工档案" size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space size={12}>
                <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emp.name[0]}</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{emp.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{emp.position} · {deptName(emp.deptId)}</div>
                </div>
              </Space>
              <Space wrap>
                <Tag color="blue" style={{ borderRadius: 6 }}>{emp.grade} 级</Tag>
                <Tag color="geekblue" style={{ borderRadius: 6 }}>绩效 {emp.perf}</Tag>
                <Tag color={emp.potential === 'HIGH' ? 'green' : emp.potential === 'MID' ? 'gold' : 'red'} style={{ borderRadius: 6 }}>
                  潜力 {emp.potential === 'HIGH' ? '高' : emp.potential === 'MID' ? '中' : '低'}
                </Tag>
                <Tag style={{ background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', borderRadius: 6 }}>流失风险 {emp.risk === 'HIGH' ? '高' : emp.risk === 'MID' ? '中' : '低'}</Tag>
              </Space>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>司龄 {emp.years} 年</div>
            </Space>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="轨迹时间线" size="small">
            <Timeline
              items={history.map((h) => {
                const cell = GRID_CELLS.find((c) => c.code === h.grid)!;
                return {
                  color: cell.color,
                  children: (
                    <Space direction="vertical" size={2}>
                      <span style={{ fontWeight: 600 }}>{h.batch}</span>
                      <Tag style={{ background: cell.color + '22', color: cell.color, borderColor: 'transparent', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>{h.grid} · {cell.label}</Tag>
                    </Space>
                  ),
                };
              })}
            />
          </Card>
        </Col>

        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="九宫格位置变化趋势" size="small">
            <ReactECharts option={option} style={{ height: 360 }} />
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
              纵轴为潜力维度（高→低），折线位置代表九宫格行；标签显示当次盘点定位编码。
              {emp.potential === 'HIGH' && ' 当前位于高潜区，建议保持培养节奏。'}
              {emp.potential === 'LOW' && ' 潜力持续偏低，建议关注留用与转岗。'}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
