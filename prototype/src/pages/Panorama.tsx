import { useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Statistic, Tag } from 'antd'
import ReactECharts from 'echarts-for-react'
import { getPanoramaSummary, type PanoramaSummary } from '@/api/p3Forward'
import { MACARON, CHART, LIGHT_AXIS } from '@/charts/palette'

const SYSTEM_META: Record<string, { icon: string; color: string; desc: string }> = {
  standard: { icon: '📐', color: MACARON[0], desc: '任职资格标准库 · 岗位标准 · 薪级带宽' },
  selection: { icon: '🎯', color: MACARON[1], desc: '招聘需求 · 认证 · 考试 · 人岗匹配' },
  evaluation: { icon: '📊', color: MACARON[2], desc: '绩效考核 · 人才盘点 · 九宫格' },
  incentive: { icon: '💰', color: MACARON[3], desc: '等级工资 · 调薪 · 绩效奖金 · 津贴/股权/荣誉' },
  development: { icon: '🌱', color: MACARON[4], desc: 'IDP · 差距分析 · 培训 · 梯队建设' },
}

const ORDER = ['standard', 'selection', 'evaluation', 'incentive', 'development']

export default function Panorama() {
  const [data, setData] = useState<PanoramaSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPanoramaSummary()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  const systems = ORDER.map(k => ({ key: k, ...data.systems[k], meta: SYSTEM_META[k] }))

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: systems.map(s => ({ name: s.name, max: Math.max(...systems.map(x => x.value), 1) * 1.2 })),
      axisName: { color: LIGHT_AXIS.text },
      splitLine: { lineStyle: { color: LIGHT_AXIS.line } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: systems.map(s => s.value),
        name: '五体系活跃度',
        areaStyle: { color: 'rgba(217,106,142,0.2)' },
        lineStyle: { color: CHART.primary },
        itemStyle: { color: CHART.primary },
      }],
    }],
  }

  const barOption = {
    tooltip: {},
    xAxis: {
      type: 'category',
      data: systems.map(s => s.name),
      axisLabel: { color: LIGHT_AXIS.text },
      axisLine: { lineStyle: { color: LIGHT_AXIS.line } },
    },
    yAxis: { type: 'value', axisLabel: { color: LIGHT_AXIS.text }, splitLine: { lineStyle: { color: LIGHT_AXIS.line } } },
    series: [{
      type: 'bar',
      data: systems.map((s, i) => ({ value: s.value, itemStyle: { color: MACARON[i] } })),
      barWidth: '45%',
      label: { show: true, position: 'top', color: CHART.ink },
    }],
  }

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col span={6}>
            <Statistic title="在册员工总数" value={data.total_employees} />
          </Col>
          <Col span={18}>
            <div style={{ color: CHART.ink2, lineHeight: 1.8 }}>
              五体系全景聚合视图，从<b>标准 → 选聘 → 评价 → 激励 → 发展</b>呈现人才管理体系运行全貌。
              指标反映各体系数据沉淀与动作闭环情况，辅助管理层识别体系短板与联动机会。
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {systems.map(s => (
          <Col span={Math.floor(24 / systems.length)} key={s.key}>
            <Card hoverable>
              <div style={{ fontSize: 22 }}>{s.meta.icon}</div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>{s.name}</div>
              <Statistic value={s.value} valueStyle={{ color: s.meta.color, fontSize: 28 }} suffix="" />
              <div style={{ color: CHART.ink3, fontSize: 12 }}>{s.metric}</div>
              <Tag color="default" style={{ marginTop: 8 }}>运行中</Tag>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="五体系活跃度雷达">
            <ReactECharts option={radarOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="各体系数据量对比">
            <ReactECharts option={barOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card title="体系说明" style={{ marginTop: 16 }}>
        {systems.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${LIGHT_AXIS.line}` }}>
            <span style={{ fontSize: 18, marginRight: 12 }}>{s.meta.icon}</span>
            <b style={{ width: 90, color: s.meta.color }}>{s.name}</b>
            <span style={{ color: CHART.ink2 }}>{s.meta.desc}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}
