import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { trainingApi, COURSE_TYPE_LABEL, COURSE_STATUS_LABEL, type CourseIn, type CourseOut, type CourseType, type CourseStatus, type InstructorIn, type InstructorOut, type OnboardingStage } from '@/api/training';

const TYPE_COLOR: Record<CourseType, string> = {
  internal: 'var(--teal)', micro: 'var(--ochre)', bootcamp: 'var(--clay)', external: 'var(--sage)',
};

export function TrainingAdmin() {
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [instructors, setInstructors] = useState<InstructorOut[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingStage[]>([]);
  const [loading, setLoading] = useState(false);

  // 课程弹窗
  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseOut | null>(null);
  const [courseForm] = Form.useForm<CourseIn>();

  // 讲师弹窗
  const [instOpen, setInstOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<InstructorOut | null>(null);
  const [instForm] = Form.useForm<InstructorIn>();

  const load = async () => {
    setLoading(true);
    try {
      const [c, i, o] = await Promise.all([trainingApi.listCourses(), trainingApi.listInstructors(), trainingApi.getOnboarding()]);
      setCourses(c);
      setInstructors(i);
      setOnboarding(o);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalHours = courses.reduce((s, c) => s + (c.hours ?? 0), 0);
  const active = courses.filter((c) => c.completion > 0);
  const avgCompletion = active.length ? Math.round(active.reduce((s, c) => s + c.completion, 0) / active.length) : 0;

  // ---- 课程保存 ----
  const saveCourse = async () => {
    const values = await courseForm.validateFields();
    try {
      if (editingCourse) {
        await trainingApi.updateCourse(editingCourse.id, values);
        message.success('课程已更新');
      } else {
        await trainingApi.createCourse(values);
        message.success('课程已创建');
      }
      setCourseOpen(false);
      courseForm.resetFields();
      setEditingCourse(null);
      load();
    } catch { /* 表单/接口错误已提示 */ }
  };

  const openCourseEdit = (c: CourseOut) => {
    setEditingCourse(c);
    courseForm.setFieldsValue(c);
    setCourseOpen(true);
  };
  const openCourseNew = () => {
    setEditingCourse(null);
    courseForm.resetFields();
    courseForm.setFieldsValue({ type: 'internal', status: 'enrolling', hours: 0, enrolled: 0, completion: 0 });
    setCourseOpen(true);
  };
  const removeCourse = async (c: CourseOut) => {
    await trainingApi.deleteCourse(c.id);
    message.success('已删除');
    load();
  };

  // ---- 讲师保存 ----
  const saveInst = async () => {
    const values = await instForm.validateFields();
    try {
      if (editingInst) {
        await trainingApi.updateInstructor(editingInst.id, values);
        message.success('讲师已更新');
      } else {
        await trainingApi.createInstructor(values);
        message.success('讲师已创建');
      }
      setInstOpen(false);
      instForm.resetFields();
      setEditingInst(null);
      load();
    } catch { /* 已提示 */ }
  };

  const openInstEdit = (t: InstructorOut) => {
    setEditingInst(t);
    instForm.setFieldsValue(t);
    setInstOpen(true);
  };
  const openInstNew = () => {
    setEditingInst(null);
    instForm.resetFields();
    instForm.setFieldsValue({ rating: 5, internal: true });
    setInstOpen(true);
  };
  const removeInst = async (t: InstructorOut) => {
    await trainingApi.deleteInstructor(t.id);
    message.success('已删除');
    load();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">培训管理</h1>
          <div className="page-subtitle">讲师 / 课程 / 微课 / 报名 · 新员工 180 天融入路径</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '项目/课程', value: courses.length, sub: `招生中 ${courses.filter((c) => c.status === 'enrolling').length}` },
          { label: '总课时', value: totalHours + ' h', sub: '内外部讲师合计' },
          { label: '平均完成率', value: avgCompletion + '%', sub: '进行中与已结项' },
          { label: '认证内训讲师', value: instructors.filter((i) => i.internal).length, sub: '全部内部认证' },
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
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        size="small"
        title="课程项目"
        extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCourseNew}>新增课程</Button>}
      >
        <Table
          rowKey="id"
          dataSource={courses}
          loading={loading}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '课程',
              render: (_: unknown, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.category} · {r.hours} 课时 · {r.started_at ?? '-'} 开始</div>
                </div>
              ),
            },
            {
              title: '类型', width: 90,
              render: (_: unknown, r) => (
                <Tag style={{ borderRadius: 6, background: TYPE_COLOR[r.type] + '22', color: TYPE_COLOR[r.type], borderColor: 'transparent' }}>
                  {COURSE_TYPE_LABEL[r.type]}
                </Tag>
              ),
            },
            { title: '讲师', width: 100, dataIndex: 'instructor_name' },
            { title: '报名', width: 80, render: (_: unknown, r) => <span className="num">{r.enrolled} 人</span> },
            {
              title: '完成率', width: 180,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={r.completion} size="small" strokeColor="var(--sage)" trailColor="var(--line)" style={{ width: 110, margin: 0 }} />
                  <span className="num">{r.completion}%</span>
                </div>
              ),
            },
            {
              title: '状态', width: 90,
              render: (_: unknown, r) => {
                const map: Record<CourseStatus, string> = { ongoing: 'var(--clay)', enrolling: 'var(--ochre)', completed: 'var(--ink-4)' };
                return <span style={{ color: map[r.status], fontWeight: 600, fontSize: 12 }}>{COURSE_STATUS_LABEL[r.status]}</span>;
              },
            },
            {
              title: '操作', width: 100,
              render: (_: unknown, r) => (
                <Space size={4}>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openCourseEdit(r)} />
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeCourse(r)} />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col span={9}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', height: '100%' }}
            size="small"
            title="认证内训讲师"
            extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={openInstNew}>新增</Button>}
          >
            {instructors.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.field}</div>
                </div>
                <Space size={4}>
                  <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>★ {t.rating}</Tag>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openInstEdit(t)} />
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeInst(t)} />
                </Space>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={15}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="新员工 180 天路径">
            <div style={{ display: 'flex' }}>
              {onboarding.map((p, i) => (
                <div key={i} style={{ flex: 1, paddingRight: i < onboarding.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--charcoal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    {i < onboarding.length - 1 && <div style={{ flex: 1, height: 2, background: 'var(--line)' }} />}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{p.stage}</div>
                  {p.items.map((it) => (
                    <div key={it} style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 3 }}>· {it}</div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 课程弹窗 */}
      <Modal
        title={editingCourse ? '编辑课程' : '新增课程'}
        open={courseOpen}
        onOk={saveCourse}
        onCancel={() => { setCourseOpen(false); setEditingCourse(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={courseForm} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={(Object.keys(COURSE_TYPE_LABEL) as CourseType[]).map((v) => ({ value: v, label: COURSE_TYPE_LABEL[v] }))} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="instructor_name" label="讲师" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="hours" label="课时"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="enrolled" label="报名人数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="completion" label="完成率(%)"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="status" label="状态">
              <Select options={(Object.keys(COURSE_STATUS_LABEL) as CourseStatus[]).map((v) => ({ value: v, label: COURSE_STATUS_LABEL[v] }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="started_at" label="开始日期"><Input placeholder="YYYY-MM-DD" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 讲师弹窗 */}
      <Modal
        title={editingInst ? '编辑讲师' : '新增讲师'}
        open={instOpen}
        onOk={saveInst}
        onCancel={() => { setInstOpen(false); setEditingInst(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={instForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="field" label="领域" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="rating" label="评分"><InputNumber min={0} max={5} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="internal" label="内部讲师">
              <Select options={[{ value: true, label: '内部' }, { value: false, label: '外部' }]} />
            </Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
