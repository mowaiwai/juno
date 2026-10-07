import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Space, Tag, Statistic, Row, Col, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import {
  defaultFactors,
  listJobEvals,
  createJobEval,
  updateJobEval,
  deleteJobEval,
  type JobEvaluation,
} from '@/api/p3Forward'

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  published: { color: 'green', text: '已发布' },
}

export default function JobEvaluation() {
  const [data, setData] = useState<JobEvaluation[]>([])
  const [factors, setFactors] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<JobEvaluation | null>(null)
  const [form] = Form.useForm()
  const [scores, setScores] = useState<Record<string, number>>({})

  const load = () => {
    listJobEvals().then(setData)
    defaultFactors().then(setFactors)
  }
  useEffect(() => { load() }, [])

  const total = Object.entries(scores).reduce((s, [k, v]) => {
    const f = factors.find(x => x.key === k)
    return s + (f ? v * f.weight : 0)
  }, 0)

  const openCreate = () => {
    setEditing(null)
    const init: Record<string, number> = {}
    factors.forEach(f => { init[f.key] = 3 })
    setScores(init)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (ev: JobEvaluation) => {
    setEditing(ev)
    const init: Record<string, number> = {}
    ev.factor_scores.forEach(f => { init[f.key] = f.score })
    setScores(init)
    form.setFieldsValue({
      position_name: ev.position_name,
      dept_id: ev.dept_id,
      grade: ev.grade,
      notes: ev.notes,
    })
    setOpen(true)
  }

  const onOk = async () => {
    const vals = await form.validateFields()
    const factor_scores = factors.map(f => ({ key: f.key, score: scores[f.key] || 1, weight: f.weight }))
    try {
      if (editing) {
        await updateJobEval(editing.id, { ...vals, factor_scores })
        message.success('已更新')
      } else {
        await createJobEval({ ...vals, factor_scores })
        message.success('已创建')
      }
      setOpen(false)
      load()
    } catch (e: any) { message.error(e.message) }
  }

  const onDelete = async (id: string) => {
    await deleteJobEval(id)
    message.success('已删除')
    load()
  }

  const cols = [
    { title: '岗位名称', dataIndex: 'position_name' },
    { title: '部门', dataIndex: 'dept_id' },
    {
      title: '总分', dataIndex: 'total_score',
      render: (v: number) => <Tag color="blue">{v.toFixed(2)}</Tag>,
    },
    { title: '职级', dataIndex: 'grade', render: (v: string) => v || '—' },
    {
      title: '状态', dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.text}</Tag>,
    },
    {
      title: '操作',
      render: (_: any, r: JobEvaluation) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" danger onClick={() => onDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="评估总数" value={data.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="已发布" value={data.filter(d => d.status === 'published').length} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均分" value={data.length ? (data.reduce((s, d) => s + d.total_score, 0) / data.length).toFixed(2) : 0} /></Card></Col>
      </Row>
      <Card title="岗位价值评估（点因素法）" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建评估</Button>}>
        <Table rowKey="id" columns={cols} dataSource={data} />
      </Card>
      <Modal
        title={editing ? '编辑评估' : '新建评估'}
        open={open}
        onOk={onOk}
        onCancel={() => setOpen(false)}
        width={700}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="position_name" label="岗位名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="dept_id" label="部门编码"><Input /></Form.Item></Col>
          </Row>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>因素评分（1-5 级）</div>
            {factors.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 160 }}>{f.name}（权重 {(f.weight * 100).toFixed(0)}%）</span>
                <InputNumber min={1} max={5} value={scores[f.key]} onChange={v => setScores(s => ({ ...s, [f.key]: v || 1 }))} style={{ width: 80 }} />
                <span style={{ marginLeft: 12, color: '#888' }}>加权：{((scores[f.key] || 0) * f.weight).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600 }}>总分：<span style={{ color: '#1677ff' }}>{total.toFixed(2)}</span></div>
          </div>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="grade" label="映射职级"><Input placeholder="如 P3 / M2" /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
