import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, List, message, Empty } from 'antd'
import { PlusOutlined, FileTextOutlined, RobotOutlined } from '@ant-design/icons'
import {
  listQuestionnaires,
  generateQuestionnaire,
  deleteQuestionnaire,
  type Questionnaire,
} from '@/api/p3Forward'

const TYPE_MAP: Record<string, string> = {
  inventory: '盘点问卷',
  competency: '能力测评',
  engagement: '敬业度',
}

export default function QuestionnairePage() {
  const [data, setData] = useState<Questionnaire[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<Questionnaire | null>(null)
  const [form] = Form.useForm()

  const load = () => listQuestionnaires().then(setData)
  useEffect(() => { load() }, [])

  const onGenerate = async () => {
    const vals = await form.validateFields()
    setLoading(true)
    try {
      await generateQuestionnaire(vals)
      message.success('问卷已生成')
      setOpen(false)
      form.resetFields()
      load()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: string) => {
    await deleteQuestionnaire(id)
    message.success('已删除')
    load()
  }

  const cols = [
    { title: '标题', dataIndex: 'title' },
    { title: '类型', dataIndex: 'q_type', render: (v: string) => <Tag color="blue">{TYPE_MAP[v]}</Tag> },
    {
      title: '题数', dataIndex: 'questions',
      render: (q: any[]) => q?.length ?? 0,
    },
    {
      title: '来源', dataIndex: 'source',
      render: (s: string) => (
        <Tag icon={s === 'ai_generated' ? <RobotOutlined /> : <FileTextOutlined />} color={s === 'ai_generated' ? 'geekblue' : 'default'}>
          {s === 'ai_generated' ? 'AI 生成' : '规则模板'}
        </Tag>
      ),
    },
    {
      title: '操作',
      render: (_: any, r: Questionnaire) => (
        <Space>
          <Button size="small" onClick={() => setDetail(r)}>查看题目</Button>
          <Button size="small" danger onClick={() => onDelete(r.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="问卷生成（盘点 / 能力测评 / 敬业度）"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>生成问卷</Button>}
      >
        <Table rowKey="id" columns={cols} dataSource={data} locale={{ emptyText: <Empty description="暂无问卷，点击右上角生成" /> }} />
      </Card>

      <Modal title="生成问卷" open={open} onOk={onGenerate} onCancel={() => setOpen(false)} confirmLoading={loading} okText="生成">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="问卷标题" rules={[{ required: true }]}>
            <Input placeholder="如：2026 年度中高层盘点问卷" />
          </Form.Item>
          <Form.Item name="q_type" label="问卷类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'inventory', label: '盘点问卷' },
              { value: 'competency', label: '能力测评' },
              { value: 'engagement', label: '敬业度' },
            ]} />
          </Form.Item>
          <Form.Item name="focus" label="关注点（可选）">
            <Input.TextArea rows={3} placeholder="如：领导力、决策力、跨部门协同…" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={detail?.title} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={640}>
        <List
          dataSource={detail?.questions || []}
          renderItem={(q: any, i: number) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Tag>{i + 1}</Tag>}
                title={q.text}
                description={
                  <Space>
                    {q.dimension && <Tag>{q.dimension}</Tag>}
                    {q.level && <Tag color="orange">L{q.level}</Tag>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}
