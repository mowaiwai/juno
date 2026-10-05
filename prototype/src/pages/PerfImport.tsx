import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Transfer,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  RocketOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
  GRADE_COLOR,
  TOOL_LABEL,
  perfApi,
  type DistributionOut,
  type Grade,
  type PerfConstants,
  type PlanOut,
  type PlanStatus,
  type PlanSummary,
  type ResultItemIn,
  type RosterMember,
  type ToolType,
} from '@/api/perf';
import { ApiError } from '@/api/client';
import { orgApi } from '@/api/org';
import { useAuth } from '@/store/auth';
import { perfPermsForRef } from '@/auth/rbac';

interface ApiErrorLike {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const STATUS_META: Record<PlanStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  evaluating: { label: '初评中', color: 'processing' },
  calibrating: { label: '校准中', color: 'warning' },
  published: { label: '已发布', color: 'success' },
};

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const SEQUENCE_OPTIONS = [
  { value: 'SW', label: 'SW 软件' },
  { value: 'ENG', label: 'ENG 工程' },
  { value: 'OP', label: 'OP 操作' },
  { value: 'MGT', label: 'MGT 管理' },
  { value: 'PUR', label: 'PUR 采购' },
  { value: 'SAL', label: 'SAL 销售' },
];

function asApiError(e: unknown): ApiErrorLike {
  if (e instanceof ApiError) return e;
  const err = e as { status?: number; code?: string; message?: string };
  return {
    status: err.status ?? 500,
    code: err.code ?? 'error',
    message: err.message ?? '操作失败',
  };
}

function coefPreview(c: PerfConstants | null, grade: Grade, score: number | null): number {
  if (!c) return 0;
  if (grade === 'C') {
    return Math.round(((score ?? 0) / c.c_divisor) * 100) / 100;
  }
  return c.coefficients[grade] ?? 0;
}

// ============ 列表页 ============

function PlanList({ onOpen }: { onOpen: (id: string) => void }) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deptOptions, setDeptOptions] = useState<{ value: string; label: string }[]>([]);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { activeRole } = useAuth();
  const perms = perfPermsForRef(activeRole);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await perfApi.listPlans());
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (perms.planManage) {
      void orgApi.departments().then((depts) => {
        setDeptOptions(depts.map((d) => ({ value: d.id, label: `${d.id} · ${d.name}` })));
      });
    }
  }, [reload, perms.planManage]);

  const onCreate = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const plan = await perfApi.createPlan({
        period: v.period,
        tool_type: v.tool_type,
        dept_ids: v.dept_ids ?? [],
        sequence_codes: v.sequence_codes ?? [],
      });
      message.success('方案已创建（草稿）');
      setCreateOpen(false);
      form.resetFields();
      onOpen(plan.id);
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">考核方案</h1>
          <div className="page-subtitle">
            方案 → 主管初评 → COE 校准（SABC 分布）→ 发布回写画像
          </div>
        </div>
        {perms.planManage && (
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新建考核方案
          </Button>
        )}
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={plans}
          pagination={false}
          columns={[
            { title: '周期', dataIndex: 'period' },
            {
              title: '工具',
              dataIndex: 'tool_type',
              render: (t: ToolType) => <Tag>{TOOL_LABEL[t]}</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: PlanStatus) => (
                <Tag color={STATUS_META[s].color}>{STATUS_META[s].label}</Tag>
              ),
            },
            {
              title: '名册/已评',
              render: (_: unknown, r: PlanSummary) => (
                <span className="num">
                  {r.result_count}/{r.roster_size}
                </span>
              ),
            },
            {
              title: '发布时间',
              dataIndex: 'published_at',
              render: (v: string | null) =>
                v ? new Date(v).toLocaleString('zh-CN') : '—',
            },
            {
              title: '操作',
              render: (_: unknown, r: PlanSummary) => (
                <Button size="small" type="link" onClick={() => onOpen(r.id)}>
                  打开
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新建考核方案"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        confirmLoading={saving}
        okText="创建并圈定名册"
      >
        <Form form={form} layout="vertical" initialValues={{ tool_type: 'kpi' }}>
          <Form.Item
            name="period"
            label="考核周期"
            rules={[{ required: true, message: '请填写周期，如 2026H1' }]}
          >
            <Input placeholder="如 2026H1 / 2026Q2" maxLength={20} />
          </Form.Item>
          <Form.Item name="tool_type" label="考核工具" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(TOOL_LABEL) as ToolType[]).map((t) => ({
                value: t,
                label: `${TOOL_LABEL[t]}${t === 'okr' || t === '360' ? '（只沉淀结果，不回写画像）' : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="dept_ids" label="圈定部门（含子树）">
            <Select
              mode="multiple"
              options={deptOptions}
              placeholder="选择部门，名册为部门在职员工并集"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="sequence_codes" label="圈定序列">
            <Select mode="multiple" options={SEQUENCE_OPTIONS} placeholder="可选，与部门取并集" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============ 名册编辑（Transfer） ============

function RosterEditor({
  plan,
  onChange,
}: {
  plan: PlanOut;
  onChange: () => void;
}) {
  const [targetKeys, setTargetKeys] = useState<string[]>(
    plan.roster_members.map((m) => m.id),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetKeys(plan.roster_members.map((m) => m.id));
  }, [plan]);

  const dataSource = useMemo(
    () =>
      [...plan.roster_members, ...plan.excluded_members].map((m) => ({
        key: m.id,
        title: `${m.employee_no} · ${m.name}（${m.position}）`,
        description: m.dept_id,
      })),
    [plan],
  );

  const save = async (keys: string[]) => {
    setSaving(true);
    try {
      await perfApi.replaceRoster(plan.id, keys);
      message.success('名册已更新');
      onChange();
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Transfer
      dataSource={dataSource}
      targetKeys={targetKeys}
      onChange={(keys) => {
        setTargetKeys(keys as string[]);
        void save(keys as string[]);
      }}
      disabled={saving}
      titles={['候选（圈定范围）', '考核名册']}
      render={(item) => item.title}
      listStyle={{ width: 320, minHeight: 240 }}
    />
  );
}

// ============ 草稿导入 ============

function DraftImport({ plan, onChange }: { plan: PlanOut; onChange: () => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<{ employee_no: string; reason: string }[]>([]);
  const [imported, setImported] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    const items = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [no, grade, score] = line.split(/[,\t，]/).map((s) => s.trim());
        return {
          employee_no: no,
          grade: (grade ?? '').toUpperCase() as Grade,
          score: score ? Number(score) : null,
        };
      });
    if (!items.length) {
      message.warning('请粘贴导入内容');
      return;
    }
    setSaving(true);
    try {
      const out = await perfApi.importResults(plan.id, { items });
      setImported(out.imported);
      setErrors(out.errors);
      if (out.imported) {
        message.success(`已导入 ${out.imported} 行（草稿结果，不回写画像）`);
        onChange();
      }
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="每行一条：工号,等级,分数（C 档必须有分；S/A 举证请在初评/校准时补齐）"
      />
      <Input.TextArea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'E10086,B,84\nE10093,D,60'}
      />
      <Space style={{ marginTop: 8 }}>
        <Button type="primary" icon={<ApiOutlined />} loading={saving} onClick={run}>
          导入到草稿
        </Button>
        {imported !== null && (
          <span style={{ color: 'var(--ink-3)' }}>
            成功 {imported} 行，失败 {errors.length} 行
          </span>
        )}
      </Space>
      {errors.length > 0 && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message="以下行未导入"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((er, i) => (
                <li key={i}>
                  {er.employee_no || '（空工号）'}：{er.reason}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}

// ============ 结果录入表 ============

interface DraftRow {
  score: number | null;
  grade: Grade | null;
  evidenceText: string;
}

function ResultEntry({
  plan,
  constants,
  canEdit,
  onChanged,
}: {
  plan: PlanOut;
  constants: PerfConstants | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [results, setResults] = useState<Record<string, ResultItemIn>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void perfApi.listResults(plan.id).then((rows) => {
      if (!alive) return;
      const map: Record<string, ResultItemIn> = {};
      for (const r of rows) {
        map[r.employee_id] = {
          employee_id: r.employee_id,
          grade: r.grade,
          score: r.score,
          evidence: r.evidence,
        };
      }
      setResults(map);
      setDrafts({});
    });
    return () => {
      alive = false;
    };
  }, [plan.id, plan.result_count]);

  const rowOf = (m: RosterMember): DraftRow => {
    if (drafts[m.id]) return drafts[m.id];
    const saved = results[m.id];
    return {
      score: saved?.score ?? null,
      grade: saved?.grade ?? null,
      evidenceText: (saved?.evidence ?? []).join('；'),
    };
  };

  const setRow = (m: RosterMember, patch: Partial<DraftRow>) => {
    setDrafts((d) => ({ ...d, [m.id]: { ...rowOf(m), ...patch } }));
  };

  const dirtyCount = Object.keys(drafts).length;

  const save = async () => {
    const items: ResultItemIn[] = Object.entries(drafts)
      .map(([employeeId, d]) => ({
        employee_id: employeeId,
        grade: d.grade as Grade,
        score: d.score,
        evidence: d.evidenceText
          .split(/[；;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((x) => x.grade);
    if (!items.length) return;
    setSaving(true);
    try {
      await perfApi.putResults(plan.id, items);
      message.success(`已保存 ${items.length} 条评定`);
      setDrafts({});
      onChanged();
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {canEdit && (
        <Space style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            disabled={!dirtyCount}
            loading={saving}
            onClick={save}
          >
            保存评定（{dirtyCount} 条待存）
          </Button>
          <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>
            {plan.status === 'calibrating'
              ? '校准阶段仅 COE 可修改'
              : '初评阶段：主管仅可见本人数据范围内成员'}
          </span>
        </Space>
      )}
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={plan.roster_members}
        columns={[
          { title: '工号', dataIndex: 'employee_no', width: 90 },
          { title: '姓名', dataIndex: 'name', width: 100 },
          {
            title: '分数',
            width: 110,
            render: (_: unknown, m: RosterMember) => (
              <InputNumber
                min={0}
                max={100}
                size="small"
                disabled={!canEdit}
                value={rowOf(m).score}
                onChange={(v) => setRow(m, { score: v ?? null })}
              />
            ),
          },
          {
            title: '等级',
            width: 90,
            render: (_: unknown, m: RosterMember) => {
              const row = rowOf(m);
              return (
                <Select
                  size="small"
                  style={{ width: 72 }}
                  disabled={!canEdit}
                  value={row.grade}
                  placeholder="-"
                  onChange={(grade) => setRow(m, { grade })}
                  options={GRADES.map((g) => ({
                    value: g,
                    label: <span style={{ color: GRADE_COLOR[g] }}>{g}</span>,
                  }))}
                />
              );
            },
          },
          {
            title: '系数',
            width: 70,
            render: (_: unknown, m: RosterMember) => {
              const row = rowOf(m);
              if (!row.grade) return '—';
              return (
                <span className="num">
                  {coefPreview(constants, row.grade, row.score).toFixed(2)}
                </span>
              );
            },
          },
          {
            title: '举证（S/A 必填，多条用；分隔）',
            render: (_: unknown, m: RosterMember) => (
              <Input
                size="small"
                disabled={!canEdit}
                value={rowOf(m).evidenceText}
                placeholder="关键事实/项目"
                onChange={(e) => setRow(m, { evidenceText: e.target.value })}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

// ============ 分布与发布 ============

function DistributionPanel({
  distribution,
  threshold,
}: {
  distribution: DistributionOut | null;
  threshold: number;
}) {
  if (!distribution) return null;

  const bands = [
    { key: 'S', label: 'S 卓越', value: distribution.ratios.S ?? 0, low: 0.0, high: 0.05 },
    { key: 'A', label: 'A 优秀', value: distribution.ratios.A ?? 0, low: 0.0, high: 0.15 },
    { key: 'B', label: 'B 胜任', value: distribution.ratios.B ?? 0, low: 0.15, high: 0.8 },
    { key: 'CD', label: 'C+D 待改进', value: distribution.cd_ratio, low: 0.0, high: 0.1 },
  ];
  const violated = new Set(distribution.violations.map((v) => v.bucket));

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Tag>
          名册 {distribution.roster_size} 人 · 已评 {distribution.graded_count}
        </Tag>
        {distribution.small_roster && (
          <Tag color="blue">小团队（{`< ${threshold}`} 人）：分布仅提示，不强制理由</Tag>
        )}
      </Space>

      {distribution.ungraded.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${distribution.ungraded.length} 人未评定，不可发布`}
          description={distribution.ungraded.map((u) => u.employee_no).join('、')}
        />
      )}

      {bands.map((b) => {
        const bad = violated.has(b.key);
        const pct = Math.round(b.value * 100);
        return (
          <div key={b.key} style={{ marginBottom: 10 }}>
            <Space size={12} style={{ display: 'flex' }}>
              <span style={{ width: 110, fontSize: 13 }}>{b.label}</span>
              <Progress
                percent={pct}
                size="small"
                style={{ width: 320, marginBottom: 0 }}
                strokeColor={bad ? '#b91c1c' : '#4b5563'}
                format={() => `${pct}%`}
              />
              <span style={{ fontSize: 12, color: bad ? '#b91c1c' : 'var(--ink-4)' }}>
                建议区间 {Math.round(b.low * 100)}–{Math.round(b.high * 100)}%
                {bad ? ' · 越界' : ''}
              </span>
            </Space>
          </div>
        );
      })}
    </div>
  );
}

// ============ 详情 ============

function PlanDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [distribution, setDistribution] = useState<DistributionOut | null>(null);
  const [constants, setConstants] = useState<PerfConstants | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { activeRole } = useAuth();
  const perms = perfPermsForRef(activeRole);

  const reload = useCallback(async () => {
    const p = await perfApi.getPlan(id);
    setPlan(p);
    if (perms.planManage && p.status !== 'draft') {
      try {
        setDistribution(await perfApi.distribution(id));
      } catch {
        setDistribution(null);
      }
    }
  }, [id, perms.planManage]);

  useEffect(() => {
    void perfApi.getConstants().then(setConstants).catch(() => setConstants(null));
    void reload();
  }, [reload]);

  if (!plan) {
    return (
      <div className="page">
        <Button type="link" onClick={onBack} icon={<RollbackOutlined />}>
          返回方案列表
        </Button>
      </div>
    );
  }

  const entryEditable =
    plan.status === 'evaluating'
      ? perms.planManage || perms.resultEntry
      : plan.status === 'calibrating' && perms.planManage;

  const transition = async (to: 'evaluating' | 'calibrating') => {
    setSaving(true);
    try {
      await perfApi.transition(id, to);
      message.success(to === 'evaluating' ? '已进入初评' : '已提交校准');
      await reload();
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const clone = async () => {
    try {
      const p = await perfApi.clone(id);
      message.success('已克隆为草稿方案');
      onBack();
      void p;
    } catch (e) {
      message.error(asApiError(e).message);
    }
  };

  const publish = async () => {
    if (
      distribution &&
      !distribution.small_roster &&
      distribution.violations.length &&
      !reason.trim()
    ) {
      message.warning('分布越界时必须填写校准理由');
      return;
    }
    setSaving(true);
    try {
      await perfApi.publish(id, reason.trim() || null);
      message.success('方案已发布，PBC/KPI 结果已回写画像');
      setPublishOpen(false);
      setReason('');
      await reload();
    } catch (e) {
      const ae = asApiError(e);
      message.error(ae.message);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    setSaving(true);
    try {
      await perfApi.unpublish(id);
      message.success('已撤回至校准阶段（画像等级保留，重发将覆盖）');
      await reload();
    } catch (e) {
      message.error(asApiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="page-header">
        <div>
          <Space>
            <Button type="link" onClick={onBack} icon={<RollbackOutlined />} style={{ paddingLeft: 0 }}>
              返回
            </Button>
          </Space>
          <h1 className="page-title font-serif" style={{ marginTop: 4 }}>
            {plan.period} · {TOOL_LABEL[plan.tool_type]}
            <Tag color={STATUS_META[plan.status].color} style={{ marginLeft: 12 }}>
              {STATUS_META[plan.status].label}
            </Tag>
          </h1>
          <div className="page-subtitle">
            名册 {plan.roster_members.length} 人 · 已评 {plan.result_count} 人
            {plan.tool_type !== 'pbc' && plan.tool_type !== 'kpi' && (
              <Tag color="purple" style={{ marginLeft: 8 }}>
                {TOOL_LABEL[plan.tool_type]} 只沉淀结果，不回写画像/不建 PIP
              </Tag>
            )}
          </div>
        </div>
        <Space>
          {perms.planManage && (
            <Button icon={<CopyOutlined />} onClick={clone}>
              克隆为新方案
            </Button>
          )}
          {plan.status === 'draft' && perms.planManage && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={saving}
              onClick={() => transition('evaluating')}
            >
              开始初评
            </Button>
          )}
          {plan.status === 'evaluating' && perms.planManage && (
            <Button
              type="primary"
              loading={saving}
              onClick={() => transition('calibrating')}
            >
              提交 COE 校准
            </Button>
          )}
          {plan.status === 'calibrating' && perms.planManage && (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => setPublishOpen(true)}
            >
              发布
            </Button>
          )}
          {plan.status === 'published' && perms.planManage && (
            <Button danger loading={saving} onClick={unpublish}>
              撤回到校准
            </Button>
          )}
        </Space>
      </div>

      {plan.distribution_override_reason && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="发布时分布越界理由"
          description={plan.distribution_override_reason}
        />
      )}

      {plan.status === 'draft' && perms.planManage && (
        <>
          <Card
            variant="borderless"
            size="small"
            title="名册圈定（草稿可编辑）"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
          >
            <RosterEditor plan={plan} onChange={reload} />
          </Card>
          <Card
            variant="borderless"
            size="small"
            title="批量导入初值"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
          >
            <DraftImport plan={plan} onChange={reload} />
          </Card>
        </>
      )}

      {(plan.status === 'evaluating' ||
        plan.status === 'calibrating' ||
        plan.status === 'published') && (
        <Card
          variant="borderless"
          size="small"
          title="结果评定"
          style={{ background: 'var(--surface)', marginBottom: 16 }}
        >
          <ResultEntry
            plan={plan}
            constants={constants}
            canEdit={entryEditable}
            onChanged={reload}
          />
        </Card>
      )}

      {plan.status !== 'draft' && perms.planManage && (
        <Card
          variant="borderless"
          size="small"
          title="SABC 分布校准"
          style={{ background: 'var(--surface)' }}
        >
          <DistributionPanel
            distribution={distribution}
            threshold={constants?.small_roster_threshold ?? 10}
          />
        </Card>
      )}

      <Modal
        title="发布考核结果"
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={publish}
        confirmLoading={saving}
        okText="确认发布"
      >
        {distribution && (
          <DistributionPanel
            distribution={distribution}
            threshold={constants?.small_roster_threshold ?? 10}
          />
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6 }}>分布覆盖理由（越界时必填）</div>
          <Input.TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如：业务扩张期，校准会批准 S/A 比例上浮"
          />
        </div>
      </Modal>
    </div>
  );
}

export function PerfImport() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? (
    <PlanDetail id={selected} onBack={() => setSelected(null)} />
  ) : (
    <PlanList onOpen={setSelected} />
  );
}
