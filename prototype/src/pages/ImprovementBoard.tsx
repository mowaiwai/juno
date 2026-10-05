import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Form, Input, Modal, Row, Select,
  Space, Table, Tag, message,
} from 'antd';
import dayjs from 'dayjs';
import { perfApi } from '@/api/perf';
import type { PipOut, PipStatusValue } from '@/api/perf';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { useAuth } from '@/store/auth';
import { perfPermsForRef } from '@/auth/rbac';
import { ApiError } from '@/api/client';

interface ApiErrorLike {
  status?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

function asApiError(e: unknown): ApiErrorLike {
  if (e instanceof ApiError) return e;
  if (e && typeof e === 'object') return e as ApiErrorLike;
  return { message: String(e) };
}

const STATUS_LABEL: Record<PipStatusValue, string> = {
  active: '改进中',
  passed: '已通过',
  failed: '未通过',
};

const STATUS_COLOR: Record<PipStatusValue, string> = {
  active: 'orange',
  passed: 'green',
  failed: 'red',
};

interface PipFormValues {
  employee_id?: string;
  period?: string;
  goalsText?: string;
  deadline?: dayjs.Dayjs | null;
}

export function ImprovementBoard() {
  const { activeRole } = useAuth();
  const perms = perfPermsForRef(activeRole);

  const [loading, setLoading] = useState(false);
  const [pips, setPips] = useState<PipOut[]>([]);
  const [status, setStatus] = useState<'all' | PipStatusValue>('all');
  const [directory, setDirectory] = useState<EmployeeDirectoryItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PipOut | null>(null);
  const [concludeTarget, setConcludeTarget] = useState<PipOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm] = Form.useForm<PipFormValues>();
  const [editForm] = Form.useForm<PipFormValues>();
  const [concludeForm] = Form.useForm<{ result: 'passed' | 'failed'; note?: string }>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await perfApi.listPips(status === 'all' ? undefined : status);
      setPips(list);
    } catch (e) {
      message.error(asApiError(e).message ?? '加载 PIP 列表失败');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = async () => {
    try {
      const list = await employeesApi.list();
      setDirectory(list.filter((e) => e.is_active));
    } catch (e) {
      message.error(asApiError(e).message ?? '加载员工目录失败');
      return;
    }
    createForm.resetFields();
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const v = await createForm.validateFields();
    setSaving(true);
    try {
      await perfApi.createPip({
        employee_id: v.employee_id!,
        period: v.period!,
        goals: (v.goalsText ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD') : null,
      });
      message.success('PIP 已创建');
      setCreateOpen(false);
      await reload();
    } catch (e) {
      if (e instanceof ApiError || (e as ApiErrorLike)?.status) {
        message.error(asApiError(e).message ?? '创建失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: PipOut) => {
    setEditTarget(p);
    editForm.setFieldsValue({
      goalsText: p.goals.join('\n'),
      deadline: p.deadline ? dayjs(p.deadline) : null,
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const v = await editForm.validateFields();
    setSaving(true);
    try {
      await perfApi.updatePip(editTarget.id, {
        goals: (v.goalsText ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD') : null,
      });
      message.success('PIP 已更新');
      setEditTarget(null);
      await reload();
    } catch (e) {
      message.error(asApiError(e).message ?? '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const submitConclude = async () => {
    if (!concludeTarget) return;
    const v = await concludeForm.validateFields();
    setSaving(true);
    try {
      await perfApi.concludePip(
        concludeTarget.id,
        v.result,
        v.note?.trim() ? v.note.trim() : null,
      );
      message.success('结论已录入，PIP 终结');
      setConcludeTarget(null);
      concludeForm.resetFields();
      await reload();
    } catch (e) {
      message.error(asApiError(e).message ?? '录入结论失败');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: pips.length,
      active: pips.filter((p) => p.status === 'active').length,
      passed: pips.filter((p) => p.status === 'passed').length,
      failed: pips.filter((p) => p.status === 'failed').length,
    }),
    [pips],
  );

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">绩效改进计划（PIP）</h1>
          <div className="page-subtitle">D 等发布自动建档 · 可手动为 C 等建档 · 结论终结不可改</div>
        </div>
        <Space>
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '改进中' },
              { value: 'passed', label: '已通过' },
              { value: 'failed', label: '未通过' },
            ]}
          />
          {perms.pipManage && <Button type="primary" onClick={openCreate}>新建 PIP</Button>}
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: 'PIP 总数', value: stats.total, color: 'var(--clay)' },
          { label: '改进中', value: stats.active, color: 'var(--ochre)' },
          { label: '已通过', value: stats.passed, color: 'var(--sage)' },
          { label: '未通过', value: stats.failed, color: '#b91c1c' },
        ].map((c) => (
          <Col span={6} key={c.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="PIP 清单" size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={pips}
          pagination={false}
          columns={[
            {
              title: '员工',
              render: (_: unknown, r: PipOut) => (
                <Space direction="vertical" size={2}>
                  <span style={{ fontWeight: 600 }}>{r.employee_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.employee_no} · {r.period}</span>
                </Space>
              ),
            },
            {
              title: '改进目标',
              render: (_: unknown, r: PipOut) =>
                r.goals.length === 0 ? (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                ) : (
                  <Space size={[4, 4]} wrap>
                    {r.goals.map((g, i) => <Tag key={i}>{g}</Tag>)}
                  </Space>
                ),
            },
            {
              title: '截止日期',
              dataIndex: 'deadline',
              width: 120,
              render: (v: string | null) => v ?? '—',
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (s: PipStatusValue) => (
                <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
              ),
            },
            {
              title: '结论',
              render: (_: unknown, r: PipOut) =>
                r.status === 'active' ? (
                  <span style={{ color: 'var(--ink-4)' }}>待结论</span>
                ) : (
                  <Space direction="vertical" size={2}>
                    <span>{r.conclusion ?? '—'}</span>
                    {r.concluded_at && (
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {dayjs(r.concluded_at).format('YYYY-MM-DD')}
                      </span>
                    )}
                  </Space>
                ),
            },
            {
              title: '操作',
              width: 180,
              render: (_: unknown, r: PipOut) =>
                r.status === 'active' && perms.pipManage ? (
                  <Space>
                    <Button size="small" onClick={() => openEdit(r)}>编辑目标</Button>
                    <Button size="small" type="primary" danger onClick={() => {
                      setConcludeTarget(r);
                      concludeForm.resetFields();
                    }}>录入结论</Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        title="新建 PIP"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreate}
        confirmLoading={saving}
        okText="创建"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="employee_id" label="员工" rules={[{ required: true, message: '请选择员工' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择员工"
              options={directory.map((e) => ({
                value: e.id,
                label: `${e.name} · ${e.employee_no} · ${e.position}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="period" label="考核周期" rules={[{ required: true, message: '请填写周期，如 2026H1' }]}>
            <Input placeholder="如 2026H1" />
          </Form.Item>
          <Form.Item name="goalsText" label="改进目标（每行一条）">
            <Input.TextArea rows={4} placeholder={'如：连续两季度达成率不低于 90%'} />
          </Form.Item>
          <Form.Item name="deadline" label="改进截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑 PIP · ${editTarget?.employee_name ?? ''}`}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={submitEdit}
        confirmLoading={saving}
        okText="保存"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="goalsText" label="改进目标（每行一条）">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="deadline" label="改进截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`录入结论 · ${concludeTarget?.employee_name ?? ''}`}
        open={!!concludeTarget}
        onCancel={() => setConcludeTarget(null)}
        onOk={submitConclude}
        confirmLoading={saving}
        okText="提交结论"
        okButtonProps={{ danger: concludeForm.getFieldValue('result') === 'failed' }}
        destroyOnClose
      >
        <Form form={concludeForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="result" label="结论" rules={[{ required: true, message: '请选择结论' }]}>
            <Select
              options={[
                { value: 'passed', label: '改进通过' },
                { value: 'failed', label: '改进未通过' },
              ]}
              onChange={() => concludeForm.validateFields(['result'])}
            />
          </Form.Item>
          <Form.Item name="note" label="结论说明">
            <Input.TextArea rows={3} placeholder="终结后不可修改" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
