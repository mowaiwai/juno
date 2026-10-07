import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  trainingApi, LEARN_TYPE_LABEL, LEARN_TYPE_COLOR, MASTERY_LABEL,
  type LearningPathIn, type LearningPathOut,
} from '@/api/training';

export function LearnMap() {
  const [paths, setPaths] = useState<LearningPathOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<string>('');
  const [grade, setGrade] = useState<string>('all');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearningPathOut | null>(null);
  const [form] = Form.useForm<LearningPathIn>();

  const load = async () => {
    setLoading(true);
    try {
      setPaths(await trainingApi.listPaths());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const positions = Array.from(new Set(paths.map((l) => l.position)));
  useEffect(() => {
    if (positions.length && !positions.includes(position)) setPosition(positions[0]);
  }, [positions]);

  const grades = Array.from(new Set(paths.filter((l) => l.position === position).map((l) => l.grade)));
  const list = paths.filter((l) => l.position === position && (grade === 'all' || l.grade === grade));

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await trainingApi.updatePath(editing.id, values);
        message.success('已更新');
      } else {
        await trainingApi.createPath(values);
        message.success('已创建');
      }
      setOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch { /* 已提示 */ }
  };

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ learn_type: 1, mastery: 2, duration: '' });
    setOpen(true);
  };
  const openEdit = (lp: LearningPathOut) => {
    setEditing(lp);
    form.setFieldsValue(lp);
    setOpen(true);
  };
  const remove = async (lp: LearningPathOut) => {
    await trainingApi.deletePath(lp.id);
    message.success('已删除');
    load();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">学习地图</h1>
          <div className="page-subtitle">岗位×职级→学什么 · 知识四档（了解/掌握/熟练/精通）对应考试题型</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>当前岗位</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--clay)', marginTop: 2 }}>{position || '-'}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>课程总数</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>必修课程</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{list.filter((l) => l.learn_type === 1).length}</div>
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={position}
          onChange={setPosition}
          style={{ width: 200 }}
          options={positions.map((p) => ({ value: p, label: p }))}
        />
        <Select
          value={grade}
          onChange={setGrade}
          style={{ width: 160 }}
          options={[{ value: 'all', label: '全部职级' }, ...grades.map((g) => ({ value: g, label: g }))]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>新增学习条目</Button>
      </Space>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="课程清单" size="small">
        <Table
          rowKey="id"
          dataSource={list}
          loading={loading}
          pagination={false}
          columns={[
            { title: '课程名称', dataIndex: 'course_name', render: (v, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{v}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position} · {r.grade}</span>
              </Space>
            ) },
            {
              title: '课程类型', dataIndex: 'learn_type',
              render: (v: number) => {
                const color = LEARN_TYPE_COLOR[v] ?? 'var(--ink-3)';
                return (
                  <Tag style={{ borderRadius: 6, background: color + '22', color, borderColor: 'transparent' }}>
                    {LEARN_TYPE_LABEL[v] ?? v}
                  </Tag>
                );
              },
            },
            {
              title: '掌握层级', dataIndex: 'mastery',
              render: (v: number) => (
                <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
                  {MASTERY_LABEL[v] ?? v}
                </Tag>
              ),
            },
            { title: '考试题型', dataIndex: 'exam_mode' },
            { title: '学时', dataIndex: 'duration' },
            {
              title: '操作', width: 100,
              render: (_: unknown, r) => (
                <Space size={4}>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="知识四档出题规则" size="small">
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--clay)' }}>了解</b> → 选择题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>掌握</b> → 填空题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>熟练掌握</b> → 问答题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>精通</b> → 答辩
        </div>
      </Card>

      <Modal
        title={editing ? '编辑学习条目' : '新增学习条目'}
        open={open}
        onOk={save}
        onCancel={() => { setOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="position" label="岗位" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="grade" label="职级" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="course_name" label="课程名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="learn_type" label="课程类型" rules={[{ required: true }]}>
                <Select options={Object.entries(LEARN_TYPE_LABEL).map(([v, l]) => ({ value: Number(v), label: l }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mastery" label="掌握层级" rules={[{ required: true }]}>
                <Select options={Object.entries(MASTERY_LABEL).map(([v, l]) => ({ value: Number(v), label: l }))} />
              </Form.Item>
            </Col>
            <Col span={8}><Form.Item name="exam_mode" label="考试题型" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="duration" label="学时"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
