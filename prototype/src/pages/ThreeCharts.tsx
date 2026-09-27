import ReactECharts from 'echarts-for-react';
import { Card, Col, Progress, Row, Space, Tag } from 'antd';
import { employees } from '@/mock/people';
import { threeCharts } from '@/mock/inventory';

const NIGHT = '#1b1a18';
const NIGHT_2 = '#26241f';
const NIGHT_LINE = '#3a362f';
const NIGHT_INK = '#ece7dd';
const NIGHT_INK_2 = '#a9a294';

export function ThreeCharts() {
  const tc = threeCharts;

  // 战略图：关键举措 × 人才支撑度
  const strategyOption = {
    grid: { left: 90, right: 30, top: 20, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLine: { show: false }, axisLabel: { color: NIGHT_INK_2 }, splitLine: { lineStyle: { color: NIGHT_LINE } } },
    yAxis: { type: 'category', data: tc.strategy.map((s) => s.initiative), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: NIGHT_INK } },
    series: [{
      type: 'bar',
      data: tc.strategy.map((s) => ({
        value: s.talentSupport,
        itemStyle: { color: s.talentSupport >= 75 ? '#7e9b78' : s.talentSupport >= 60 ? '#c2a05a' : '#b5524a', borderRadius: [0, 4, 4, 0] },
      })),
      barWidth: 16,
      label: { show: true, position: 'right', color: NIGHT_INK, formatter: '{c}' },
    }],
  };

  // 组织图：继任覆盖率仪表盘
  const orgOption = {
    series: [{
      type: 'gauge',
      radius: '90%',
      center: ['50%', '58%'],
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      progress: { show: true, width: 14, itemStyle: { color: '#7fa09b' } },
      axisLine: { lineStyle: { width: 14, color: [[1, NIGHT_LINE]] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { valueAnimation: true, formatter: '{value}%', color: NIGHT_INK, fontSize: 28, fontWeight: 700, offsetCenter: [0, '0%'] },
      data: [{ value: Math.round(tc.org.successionCoverage * 100) }],
    }],
  };

  // 人才图：能力×业绩散点 + 意愿度异常标注
  const scatterData = tc.talent.scatter.map((p) => ({
    value: [p.x, p.y, p.size],
    name: p.empId,
    itemStyle: { color: tc.talent.willingnessAnomaly.includes(p.empId) ? '#b5524a' : '#d97757' },
  }));
  const talentOption = {
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'value', name: '业绩', min: 50, max: 100, axisLine: { lineStyle: { color: NIGHT_LINE } }, axisLabel: { color: NIGHT_INK_2 }, splitLine: { lineStyle: { color: NIGHT_LINE } }, nameTextStyle: { color: NIGHT_INK_2 } },
    yAxis: { type: 'value', name: '能力', min: 50, max: 100, axisLine: { lineStyle: { color: NIGHT_LINE } }, axisLabel: { color: NIGHT_INK_2 }, splitLine: { lineStyle: { color: NIGHT_LINE } }, nameTextStyle: { color: NIGHT_INK_2 } },
    series: [
      {
        type: 'scatter',
        data: scatterData,
        symbolSize: (d: number[]) => d[2],
        label: {
          show: true,
          formatter: (p: { name: string }) => employees.find((e) => e.id === p.name)?.name ?? '',
          color: NIGHT_INK,
          fontSize: 10,
          position: 'top',
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(181,82,74,0.08)' },
          data: [[{ xAxis: 50, yAxis: 75 }, { xAxis: 78, yAxis: 100 }]],
        },
      },
    ],
  };

  return (
    <div style={{ background: NIGHT, minHeight: '100vh', padding: 24, color: NIGHT_INK }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="page-header" style={{ borderBottom: `1px solid ${NIGHT_LINE}`, paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h1 className="page-title font-serif" style={{ color: NIGHT_INK }}>三张图驾驶舱</h1>
            <div style={{ color: NIGHT_INK_2 }}>战略 · 组织 · 人才 三图联动 · {tc.year} 年度</div>
          </div>
          <Space>
            <Tag style={{ background: 'var(--clay)', color: '#fff', borderColor: 'transparent', borderRadius: 6 }}>实时</Tag>
          </Space>
        </div>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          {[
            { label: '关键举措', value: tc.strategy.length, color: '#d97757' },
            { label: '部门数', value: tc.org.departments, color: '#c2a05a' },
            { label: '核心岗位继任覆盖', value: `${Math.round(tc.org.successionCoverage * 100)}%`, color: '#7fa09b' },
            { label: 'P4+ 占比', value: `${Math.round(tc.talent.p4PlusRatio * 100)}%`, color: '#7e9b78' },
            { label: '高潜人数', value: tc.talent.highPotentialCount, color: '#7fa09b' },
            { label: '意愿度异常', value: tc.talent.willingnessAnomaly.length, color: '#b5524a' },
          ].map((s) => (
            <Col span={4} key={s.label}>
              <Card variant="borderless" style={{ background: NIGHT_2, border: `1px solid ${NIGHT_LINE}` }} size="small">
                <div style={{ fontSize: 12, color: NIGHT_INK_2 }}>{s.label}</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16}>
          <Col span={10}>
            <Card variant="borderless" style={{ background: NIGHT_2, border: `1px solid ${NIGHT_LINE}` }} size="small" title={<span style={{ color: NIGHT_INK }}>战略图 · 关键举措人才支撑度</span>}>
              <ReactECharts option={strategyOption} style={{ height: 260 }} />
              <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                {tc.strategy.map((s) => (
                  <div key={s.initiative} style={{ fontSize: 11, color: NIGHT_INK_2 }}>
                    <b style={{ color: NIGHT_INK }}>{s.initiative}</b>（{s.owner}）：{s.note}
                  </div>
                ))}
              </Space>
            </Card>
          </Col>

          <Col span={6}>
            <Card variant="borderless" style={{ background: NIGHT_2, border: `1px solid ${NIGHT_LINE}` }} size="small" title={<span style={{ color: NIGHT_INK }}>组织图 · 继任覆盖率</span>}>
              <ReactECharts option={orgOption} style={{ height: 200 }} />
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: NIGHT_INK_2 }}>
                  <span>核心岗位</span><span className="num" style={{ color: NIGHT_INK }}>{tc.org.keyPositions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: NIGHT_INK_2 }}>
                  <span>组织调整</span><span className="num" style={{ color: NIGHT_INK }}>{tc.org.orgChanges} 次</span>
                </div>
                <Progress percent={Math.round(tc.org.successionCoverage * 100)} strokeColor="#7fa09b" showInfo={false} />
              </Space>
            </Card>
          </Col>

          <Col span={8}>
            <Card variant="borderless" style={{ background: NIGHT_2, border: `1px solid ${NIGHT_LINE}` }} size="small" title={<span style={{ color: NIGHT_INK }}>人才图 · 能力×业绩</span>} extra={<Tag style={{ background: 'rgba(181,82,74,0.2)', color: '#e5908a', borderColor: 'transparent', borderRadius: 6 }}>红点=意愿度异常</Tag>}>
              <ReactECharts option={talentOption} style={{ height: 300 }} />
              <div style={{ fontSize: 11, color: NIGHT_INK_2, marginTop: 8 }}>
                红色区域为「能力强但业绩差」区间，提示意愿度问题，需 HRBP 介入面谈。
              </div>
            </Card>
          </Col>
        </Row>

        <Card variant="borderless" style={{ background: NIGHT_2, border: `1px solid ${NIGHT_LINE}`, marginTop: 16 }} size="small" title={<span style={{ color: NIGHT_INK }}>三图联动结论</span>}>
          <div style={{ color: NIGHT_INK_2, fontSize: 13, lineHeight: 1.9 }}>
            本期战略落地整体人才支撑度 <b style={{ color: '#c2a05a' }}>70%</b>，其中「海外建厂」支撑度仅 54%，建议优先补齐运营+质量复合型人才；
            组织继任覆盖率 <b style={{ color: '#7fa09b' }}>62%</b>，核心岗位仍有断层风险；
            人才结构 P4+ 占比 <b style={{ color: '#7e9b78' }}>42%</b>，高潜 {tc.talent.highPotentialCount} 人构成核心池，
            但存在 <b style={{ color: '#e5908a' }}>{tc.talent.willingnessAnomaly.length} 名意愿度异常员工</b>，建议结合九宫格策略与 IDP 推进。
          </div>
        </Card>
      </div>
    </div>
  );
}
