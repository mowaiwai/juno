import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, DatePicker, Select, Space, Tag, Tabs, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import {
  listIncentives,
  createIncentive,
  updateIncentive,
  deleteIncentive,
  type IncentiveCategory,
  type IncentiveRecord,
} from '@/api/p3Forward'

const CATEGORY_MAP: Record<string, { color: string; text: string }> = {
  benefit: { color: 'blue', text: '津贴福利' },
  equity: { color: 'purple', text: '股权' },
  honor: { color: 'gold', text: '荣誉表彰' },
}

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '生效中' },
  expired: { color: 'default', text: '已失效' },
  revoked: { color: 'red', text: '已撤销' },
}

export default function IncentiveManagement() {
  const [data, setData] = useState<IncentiveRecord[]>([])
  const [cat, setCat] = useState<IncentiveCategory | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const load = () => listIncentives(cat === 'all' ? undefined : { category: cat }).then(setData)
  useEffect(() => { load() }, [cat])

  const onOk = async () => {
    const vals = await form.validateFields()
    const payload = {
      ...vals,
      granted_at: vals.granted_at?.format('YYYY-MM-DD'),
      effective_from: vals.effective_from?.format('YYYY-MM-DD'),
      effective_to: vals.effective_to?.format('YYYY-MM-DD'),
    }
    await createIncentive(payload)
    message.success('已添加')
    setOpen(false)
    form.resetFields()
    load()
  }

  const onDelete = async (id: string) => {
    await deleteIncentive(id)
    message.success('已删除')
    load()
  }

  const onStatus = async (id: string, status: string) => {
    await updateIncentive(id, { status })
    message.success('状态已更新')
    load()
  }

  const cols = [
    { title: '员工 ID', dataIndex: 'employee_id', width: 120, ellipsis: true },
    {
      title: '类别', dataIndex: 'category',
      render: (c: string) => <Tag color={CATEGORY_MAP[c]?.color}>{CATEGORY_MAP[c]?.text}</Tag>,
    },
    { title: '项目名称', dataIndex: 'item_name' },
    {
      title: '金额', dataIndex: 'amount',
      render: (v: number | null, r: IncentiveRecord) =>
        v != null ? `${v.toLocaleString()} ${r.currency || ''}` : '—',
    },
    { title: '授予日期', dataIndex: 'granted_at', render: (v: string) => v || '—' },
    { title: '有效期', render: (_: any, r: IncentiveRecord) => `${r.effective_from || '—'} ~ ${r.effective_to || '长期'}` },
    {
      title: '状态', dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.text}</Tag>,
    },
    {
      title: '操作',
      render: (_: any, r: IncentiveRecord) => (
        <Space>
          {r.status === 'active' && <Button size="small" onClick={() => onStatus(r.id, 'expired')}>失效</Button>}
          <Button size="small" danger onClick={() => onDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  const counts = {
    benefit: data.filter(d => d.category === 'benefit').length,
    equity: data.filter(d => d.category === 'equity').length,
    honor: data.filter(d => d.category === 'honor').length,
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="津贴福利 / 股权 / 荣誉表彰"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>添加记录</Button>}
      >
        <Tabs
          activeKey={cat}
          onChange={k => setCat(k as any)}
          items={[
            { key: 'all', label: `全部 (${data.length})`, children: <Table rowKey="id" columns={cols} dataSource={data} /> },
            { key: 'benefit', label: `津贴福利 (${counts.benefit})`, children: <Table rowKey="id" columns={cols} dataSource={data.filter(d => d.category === 'benefit')} /> },
            { key: 'equity', label: `股权 (${counts.equity})`, children: <Table rowKey="id" columns={cols} dataSource={data.filter(d => d.category === 'equity')} /> },
            { key: 'honor', label: `荣誉表彰 (${counts.honor})`, children: <Table rowKey="id" columns={cols} dataSource={data.filter(d => d.category === 'honor')} /> },
          ]}
        />
      </Card>
      <Modal title="添加激励记录" open={open} onOk={onOk} onCancel={() => setOpen(false)} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="employee_id" label="员工 ID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select options={[
              { value: 'benefit', label: '津贴福利' },
              { value: 'equity', label: '股权' },
              { value: 'honor', label: '荣誉表彰' },
            ]} />
          </Form.Item>
          <Form.Item name="item_name" label="项目名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="amount" label="金额（荣誉可空）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="granted_at" label="授予日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effective_from" label="生效起始"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effective_to" label="生效结束（空为长期）"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
