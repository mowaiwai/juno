import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Segmented, Select, Space, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, LikeOutlined, PlusOutlined } from '@ant-design/icons';
import {
  trainingApi, KNOWLEDGE_STATUS_META,
  type ExtractWay, type KnowledgeIn, type KnowledgeOut, type KnowledgeStatus,
} from '@/api/training';

type Filter = 'all' | KnowledgeStatus;

export function KnowledgeBase() {
  const [items, setItems] = useState<KnowledgeOut[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeOut | null>(null);
  const [form] = Form.useForm<KnowledgeIn>();

  const load = async (status?: string) => {
    setLoading(true);
    try {
      setItems(await trainingApi.listKnowledge(status && status !== 'all' ? status : undefined));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const list = useMemo(() => items, [items]);
  const totalReads = items.reduce((s, k) => s + k.reads, 0);

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await trainingApi.updateKnowledge(editing.id, values);
        message.success('已更新');
      } else {
        await trainingApi.createKnowledge(values);
        message.success('已创建');
      }
      setOpen(false);
      form.resetFields();
      setEditing(null);
      load(filter);
    } catch { /* 已提示 */ }
  };

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ way: 'interview', status: 'draft' });
    setOpen(true);
  };
  const openEdit = (k: KnowledgeOut) => {
    setEditing(k);
    form.setFieldsValue(k);
    setOpen(true);
  };
  const remove = async (k: KnowledgeOut) => {
    await trainingApi.deleteKnowledge(k.id);
    message.success('已删除');
    load(filter);
  };
  const publish = async (k: KnowledgeOut) => {
    await trainingApi.publishKnowledge(k.id);
    message.success('已发布');
    load(filter);
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">经验萃取库</h1>
          <div className="page-subtitle">专家访谈萃取 + AI 自动萃取 · 组织经验沉淀为可检索资产</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '知识条目', value: items.length, sub: '覆盖多个领域' },
          { label: '已发布', value: items.filter((k) => k.status === 'published').length, sub: '全员可检索' },
          { label: '累计阅读', value: totalReads, sub: '本季度 +18%' },
          { label: 'AI 萃取中', value: items.filter((k) => k.status === 'extracting').length, sub: '来自会议纪要与报表' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        size="small"
        title="知识条目"
        extra={
          <Space>
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { label: '全部', value: 'all' },
                { label: '已发布', value: 'published' },
                { label: 'AI 萃取中', value: 'extracting' },
                { label: '草稿', value: 'draft' },
              ]}
            />
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openNew}>新增条目</Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {list.map((k) => (
            <Col span={8} key={k.id}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, height: '100%', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <Tag style={{ borderRadius: 6, background: KNOWLEDGE_STATUS_META[k.status].bg, color: KNOWLEDGE_STATUS_META[k.status].color, borderColor: 'transparent', margin: 0 }}>
                    {KNOWLEDGE_STATUS_META[k.status].label}
                  </Tag>
                  <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', color: 'var(--ink-2)', borderColor: 'var(--line)', margin: 0 }}>
                    {k.category}
                  </Tag>
                </div>
                <div className="font-serif" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{k.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7, minHeight: 40 }}>{k.summary}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {k.way === 'ai' ? 'AI 访谈萃取' : '专家访谈'} · {k.author}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    <EyeOutlined /> <span className="num">{k.reads}</span>
                    <LikeOutlined style={{ marginLeft: 8 }} /> <span className="num">{k.likes}</span>
                  </span>
                </div>
                <Space size={4} style={{ marginTop: 8 }}>
                  {k.status !== 'published' && (
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => publish(k)}>发布</Button>
                  )}
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(k)} />
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(k)} />
                </Space>
              </div>
            </Col>
          ))}
        </Row>
        {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-4)' }}>加载中...</div>}
      </Card>

      <Modal
        title={editing ? '编辑知识条目' : '新增知识条目'}
        open={open}
        onOk={save}
        onCancel={() => { setOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="category" label="分类" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="author" label="作者" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="way" label="萃取方式">
              <Select options={[{ value: 'interview' as ExtractWay, label: '专家访谈' }, { value: 'ai' as ExtractWay, label: 'AI 自动萃取' }]} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="状态">
              <Select options={(Object.keys(KNOWLEDGE_STATUS_META) as KnowledgeStatus[]).map((v) => ({ value: v, label: KNOWLEDGE_STATUS_META[v].label }))} />
            </Form.Item></Col>
          </Row>
          <Form.Item name="summary" label="摘要"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
