import { useEffect, useState } from 'react'
import {
  Alert, Button, Card, Col, Form, InputNumber, Modal, Row, Segmented, Space, Spin, Statistic, Table, Tag, Tooltip, message,
} from 'antd'
import { SettingOutlined, WarningFilled } from '@ant-design/icons'
import {
  getTurnoverConfig,
  updateTurnoverConfig,
  getTurnoverRisks,
  type TurnoverConfig,
  type TurnoverRiskItem,
  type TurnoverRiskReport,
} from '@/api/p3Forward'

const BUCKET_META: Record<string, { color: string; text: string }> = {
  high: { color: 'red', text: '高风险' },
  medium: { color: 'orange', text: '中风险' },
  low: { color: 'green', text: '低风险' },
}

export default function TurnoverRisk() {
  const [report, setReport] = useState<TurnoverRiskReport | null>(null)
  const [bucket, setBucket] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [config, setConfig] = useState<TurnoverConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = (b = bucket) => {
    setLoading(true)
    getTurnoverRisks(b === 'all' ? undefined : b)
      .then(setReport)
      .catch((e: { message: string }) => message.error(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load('all'); getTurnoverConfig().then(setConfig); /* eslint-disable-next-line */ }, [])

  const openConfig = () => {
    getTurnoverConfig().then((cfg) => {
      setConfig(cfg)
      form.setFieldsValue({
        stale_raise_months: cfg.thresholds.stale_raise_months as number,
        stale_promotion_months: cfg.thresholds.stale_promotion_months as number,
        medium: cfg.buckets.medium,
        high: cfg.buckets.high,
      })
      setCfgOpen(true)
    })
  }

  const saveConfig = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const cfg = await updateTurnoverConfig({
        thresholds: { stale_raise_months: v.stale_raise_months, stale_promotion_months: v.stale_promotion_months },
        buckets: { medium: v.medium, high: v.high },
      })
      setConfig(cfg)
      message.success('信号配置已更新（已留审计）')
      setCfgOpen(false)
      load(bucket)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const cols = [
    { title: '员工', dataIndex: 'name', render: (v: string, r: TurnoverRiskItem) => (
      <Space direction="vertical" size={0}>
        <b>{v}</b>
        <span style={{ color: '#a099aa', fontSize: 12 }}>{r.position} · {r.grade}</span>
      </Space>
    ) },
    { title: '部门', dataIndex: 'dept_id', width: 80 },
    { title: '绩效', dataIndex: 'perf_grade', width: 70, render: (v: string | null) => v || '—' },
    { title: '信号分', dataIndex: 'score', width: 80, render: (v: number) => <b>{v}</b> },
    {
      title: '风险档', dataIndex: 'bucket', width: 100,
      render: (b: string) => <Tag icon={b === 'high' ? <WarningFilled /> : undefined} color={BUCKET_META[b]?.color}>{BUCKET_META[b]?.text}</Tag>,
    },
    {
      title: '命中信号', dataIndex: 'signals',
      render: (signals: TurnoverRiskItem['signals']) => (
        <Space size={4} wrap>
          {signals.length === 0 && <span style={{ color: '#a099aa' }}>无</span>}
          {signals.map((s) => (
            <TooltipItem key={s.key} label={s.label} detail={s.detail} />
          ))}
        </Space>
      ),
    },
  ]

  if (!report) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div style={{ padding: 24 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="规则信号预警 · 非概率预测"
        description={report.disclaimer}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="扫描在职人数" value={report.summary.total_scanned} /></Card></Col>
        <Col span={6}><Card><Statistic title="高风险" value={report.summary.high} valueStyle={{ color: '#de7066' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="中风险" value={report.summary.medium} valueStyle={{ color: '#e3be6b' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="低风险" value={report.summary.low} valueStyle={{ color: '#7fc49b' }} /></Card></Col>
      </Row>

      <Card
        title="离职风险信号扫描"
        extra={
          <Space>
            <Segmented
              value={bucket}
              onChange={(v) => { setBucket(v as string); load(v as string) }}
              options={[
                { label: '全部', value: 'all' },
                { label: '高风险', value: 'high' },
                { label: '中风险', value: 'medium' },
                { label: '低风险', value: 'low' },
              ]}
            />
            <Button icon={<SettingOutlined />} onClick={openConfig}>信号配置</Button>
          </Space>
        }
      >
        <Table
          rowKey="employee_id"
          columns={cols}
          dataSource={loading ? [] : report.items}
          loading={loading}
          pagination={{ pageSize: 20 }}
          expandable={{
            expandedRowRender: (r) => (
              <Space direction="vertical" size={4}>
                {r.signals.map((s) => (
                  <div key={s.key} style={{ fontSize: 13 }}>
                    <Tag color={BUCKET_META[r.bucket]?.color}>{s.label}</Tag>
                    <span style={{ color: '#6e6778' }}>{s.detail}</span>
                  </div>
                ))}
              </Space>
            ),
          }}
        />
      </Card>

      <Modal
        title="离职信号配置（租户可配）"
        open={cfgOpen}
        onOk={saveConfig}
        confirmLoading={saving}
        onCancel={() => setCfgOpen(false)}
        okText="保存"
      >
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="调整阈值将改变全员风险分档结果，保存即留审计；不产出概率。" />
        <Form form={form} layout="vertical">
          <Form.Item name="stale_raise_months" label="久未调薪阈值（月）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stale_promotion_months" label="同职级停留过久阈值（月）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="medium" label="中风险信号分阈值（≥）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="high" label="高风险信号分阈值（≥）" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {config && <Tag>{config.is_default ? '当前为系统默认配置' : '已自定义'}</Tag>}
        </Form>
      </Modal>
    </div>
  )
}

function TooltipItem({ label, detail }: { label: string; detail: string }) {
  return (
    <Tooltip title={detail}>
      <Tag color="orange">{label}</Tag>
    </Tooltip>
  )
}
