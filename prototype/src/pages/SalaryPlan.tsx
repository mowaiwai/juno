import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, InputNumber, Modal, Progress, Row, Select, Space, Table, Tag, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  compApi,
  type AdjustmentItem,
  type AdjustmentPlan,
  type AdjustmentPlanSummary,
  type AdjustmentPreview,
  type AdjustmentPreviewItem,
} from '@/api/comp';
import { orgApi, type DepartmentItem } from '@/api/org';
import { checkSalaryEligibility, type SalaryEligibility } from '@/api/p3Forward';
import { RobotOutlined } from '@ant-design/icons';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

const MARK_META: Record<string, { label: string; color: string }> = {
  market_stop: { label: '75 分位停涨', color: 'error' },
  pip_fail: { label: 'PIP 不通过降薪', color: 'error' },
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  approving: 'processing',
  approved: 'success',
};
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', approving: '审批中', approved: '已批准',
};

export function SalaryPlan() {
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [scope, setScope] = useState<string[]>([]);
  const [preview, setPreview] = useState<AdjustmentPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<AdjustmentPlanSummary[]>([]);
  const [planDetail, setPlanDetail] = useState<AdjustmentPlan | null>(null);
  const [eligibility, setEligibility] = useState<SalaryEligibility | null>(null);

  const runEligibility = (employeeId: string) => {
    checkSalaryEligibility(employeeId).then(setEligibility).catch((e: { message: string }) => message.error(e.message));
  };

  useEffect(() => {
    orgApi.departments().then(setDepts);
    refreshPlans();
  }, []);

  const refreshPlans = () => {
    compApi.listAdjustmentPlans().then(setPlans).catch(() => undefined);
  };

  const runPreview = () => {
    setLoading(true);
    compApi.previewAdjustments(scope).then((r) => {
      setPreview(r);
      if (r.headcount === 0) message.info('范围内无可用绩效结果的员工');
    }).catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  // 预览表本地微调百分比
  const updatePreviewPct = (employeeId: string, pct: number) => {
    if (!preview) return;
    setPreview({
      ...preview,
      items: preview.items.map((it) =>
        it.employee_id === employeeId
          ? { ...it, adjust_pct: pct, new_salary: Math.round(it.base_salary * (1 + pct / 100)), delta: Math.round(it.base_salary * pct / 100) }
          : it,
      ),
    });
  };

  const stats = useMemo(() => {
    const items = preview?.items ?? [];
    return {
      total: items.length,
      up: items.filter((i) => i.adjust_pct > 0).length,
      freeze: items.filter((i) => i.adjust_pct === 0).length,
      cut: items.filter((i) => i.adjust_pct < 0).length,
      budget: items.reduce((s, i) => s + i.delta, 0),
    };
  }, [preview]);

  const createPlan = () => {
    if (!preview || preview.headcount === 0) return;
    Modal.confirm({
      title: '生成调薪方案',
      content: `将按当前 ${preview.headcount} 条建议创建草稿方案，创建后可继续微调并提交审批。`,
      onOk: () =>
        compApi.createAdjustmentPlan({
          plan_name: `年度调薪 ${new Date().toLocaleDateString()}`,
          scope_depts: scope,
          items: preview.items.map((it: AdjustmentPreviewItem) => ({
            employee_id: it.employee_id,
            current_salary: it.base_salary,
            suggested_pct: it.adjust_pct,
            suggested_salary: it.new_salary,
            mark: it.mark,
            name: it.name, employee_no: it.employee_no, grade: it.grade,
            sequence: it.sequence, dept_id: it.dept_id, perf_grade: it.perf_grade,
            penetration: it.penetration, delta: it.delta,
          })),
        }).then((p) => {
          message.success(`方案「${p.plan_name}」已创建`);
          setPreview(null);
          refreshPlans();
        }).catch((e) => message.error(e.message)),
    });
  };

  const tunePlanPct = (employeeId: string, pct: number) => {
    if (!planDetail) return;
    compApi.tuneAdjustment(planDetail.id, employeeId, pct).then((r) => {
      setPlanDetail({ ...planDetail, items: r.items, adjustments: r.adjustments });
      refreshPlans();
      message.success('已微调并留痕');
    }).catch((e) => message.error(e.message));
  };

  const submitPlan = (id: string) => {
    compApi.submitAdjustment(id).then(() => {
      message.success('已提交高管审批');
      setPlanDetail(null);
      refreshPlans();
    }).catch((e) => message.error(e.message));
  };

  const deptName = (id?: string | null) => depts.find((d) => d.id === id)?.name ?? id ?? '—';

  const previewColumns: ColumnsType<AdjustmentPreviewItem> = [
    {
      title: '员工',
      render: (_: unknown, r: AdjustmentPreviewItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{deptName(r.dept_id)} · {r.employee_no}</div>
        </div>
      ),
    },
    { title: '职级', width: 70, render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.grade}</span> },
    { title: '绩效等级', width: 90, render: (_: unknown, r) => <Tag color="blue">{r.perf_grade}</Tag> },
    { title: '当前月薪', width: 110, render: (_: unknown, r) => <span className="num">{fmt(r.base_salary)}</span> },
    {
      title: '带宽渗透率',
      width: 160,
      render: (_: unknown, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={Math.round(r.penetration * 100)}
            showInfo={false}
            size="small"
            strokeColor={r.penetration >= 0.75 ? 'var(--danger)' : 'var(--teal)'}
            trailColor="var(--line)"
            style={{ width: 90, margin: 0 }}
          />
          <span className="num">{r.penetration.toFixed(2)}</span>
        </div>
      ),
    },
    {
      title: '建议调薪 %',
      width: 120,
      render: (_: unknown, r: AdjustmentPreviewItem) => (
        <InputNumber
          size="small"
          value={r.adjust_pct}
          min={-30}
          max={30}
          step={1}
          formatter={(v) => `${v}%`}
          parser={(v) => Number((v ?? '').replace('%', ''))}
          onChange={(v) => updatePreviewPct(r.employee_id, v ?? 0)}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: '建议月薪',
      width: 120,
      render: (_: unknown, r) => (
        <span className="num" style={{ color: r.adjust_pct < 0 ? 'var(--danger)' : 'var(--sage)', fontWeight: 700 }}>
          {fmt(r.new_salary)}
        </span>
      ),
    },
    {
      title: '年化增减',
      width: 110,
      render: (_: unknown, r) => (
        <span className="num" style={{ color: r.delta < 0 ? 'var(--danger)' : 'var(--ink-2)' }}>
          {r.delta >= 0 ? '+' : ''}{fmt(r.delta * 12)}
        </span>
      ),
    },
    {
      title: '标记',
      width: 130,
      render: (_: unknown, r) =>
        r.mark ? <Tag color={MARK_META[r.mark]?.color}>{MARK_META[r.mark]?.label ?? r.mark}</Tag> : '—',
    },
  ];

  const planColumns: ColumnsType<AdjustmentPlanSummary> = [
    { title: '方案名称', dataIndex: 'plan_name' },
    { title: '人数', dataIndex: 'headcount', width: 80 },
    {
      title: '年化预算',
      width: 130,
      render: (_: unknown, p: AdjustmentPlanSummary) => <span className="num">{fmt(p.budget_total * 12)}</span>,
    },
    {
      title: '状态',
      width: 100,
      render: (_: unknown, p: AdjustmentPlanSummary) => (
        <Tag color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status] ?? p.status}</Tag>
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, p: AdjustmentPlanSummary) => (
        <Space size="small">
          <Button size="small" onClick={() => compApi.getAdjustmentPlan(p.id).then(setPlanDetail)}>查看</Button>
          {p.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => submitPlan(p.id)}>提交审批</Button>
          )}
        </Space>
      ),
    },
  ];

  const modalColumns: ColumnsType<AdjustmentItem> = [
    { title: '员工', render: (_: unknown, r) => <span>{r.name ?? r.employee_id}</span> },
    { title: '职级', width: 70, render: (_: unknown, r) => r.grade ?? '—' },
    { title: '绩效', width: 70, render: (_: unknown, r) => r.perf_grade ?? '—' },
    { title: '当前月薪', width: 110, render: (_: unknown, r) => fmt(r.current_salary) },
    {
      title: '调薪 %',
      width: 120,
      render: (_: unknown, r) =>
        planDetail?.status === 'draft' ? (
          <InputNumber
            size="small"
            value={r.suggested_pct}
            min={-30}
            max={30}
            style={{ width: 90 }}
            formatter={(v) => `${v}%`}
            parser={(v) => Number((v ?? '').replace('%', ''))}
            onChange={(v) => tunePlanPct(r.employee_id, v ?? 0)}
          />
        ) : (
          <span className="num">{r.suggested_pct}%</span>
        ),
    },
    {
      title: '建议月薪',
      width: 110,
      render: (_: unknown, r) => (
        <span className="num" style={{ color: r.suggested_pct < 0 ? 'var(--danger)' : 'var(--sage)' }}>
          {fmt(r.suggested_salary)}
        </span>
      ),
    },
    {
      title: '标记',
      width: 120,
      render: (_: unknown, r) =>
        r.mark ? <Tag color="error">{MARK_META[r.mark]?.label ?? r.mark}</Tag> : '—',
    },
    {
      title: '资格',
      width: 90,
      render: (_: unknown, r) => (
        <Button size="small" icon={<RobotOutlined />} onClick={() => runEligibility(r.employee_id)}>
          初筛
        </Button>
      ),
    },
  ];

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">调薪方案建议</h1>
          <div className="page-subtitle">矩阵 × 渗透率生成建议 · 75 分位停涨 · D + PIP 不通过降薪 · 微调留痕后提交高管审批</div>
        </div>
        <Space>
          <Select
            mode="multiple"
            allowClear
            placeholder="部门范围（默认全部）"
            style={{ minWidth: 260 }}
            value={scope}
            onChange={setScope}
            options={depts.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Button type="primary" loading={loading} onClick={runPreview}>测算调薪建议</Button>
        </Space>
      </div>

      {preview && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={5}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>涉及人数</div>
                <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{stats.total} 人</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>调升 / 冻结 / 降薪</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                  <span style={{ color: 'var(--sage)' }}>{stats.up}</span>
                  <span style={{ color: 'var(--ink-4)' }}> / </span>
                  <span>{stats.freeze}</span>
                  <span style={{ color: 'var(--ink-4)' }}> / </span>
                  <span style={{ color: 'var(--danger)' }}>{stats.cut}</span>
                </div>
              </Card>
            </Col>
            <Col span={7}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>年化新增成本</div>
                <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--clay)' }}>{fmt(stats.budget * 12)}</div>
              </Card>
            </Col>
            <Col span={6} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Button type="primary" size="large" onClick={createPlan}>生成调薪方案</Button>
            </Col>
          </Row>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="测算建议清单（可直接微调百分比）">
            <Table
              rowKey="employee_id"
              dataSource={preview.items}
              pagination={false}
              size="middle"
              columns={previewColumns}
            />
          </Card>
        </>
      )}

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginTop: preview ? 16 : 0 }}
        size="small"
        title="调薪方案"
      >
        <Table
          rowKey="id"
          dataSource={plans}
          pagination={false}
          size="middle"
          columns={planColumns}
        />
      </Card>

      <Modal
        open={!!planDetail}
        title={planDetail ? `${planDetail.plan_name} · ${STATUS_LABEL[planDetail.status] ?? planDetail.status}` : ''}
        width={960}
        footer={
          planDetail?.status === 'draft'
            ? <Button type="primary" onClick={() => submitPlan(planDetail.id)}>提交高管审批</Button>
            : null
        }
        onCancel={() => setPlanDetail(null)}
      >
        {planDetail && (
          <>
            {planDetail.reject_reason && (
              <Tag color="error" style={{ marginBottom: 12 }}>上次驳回原因：{planDetail.reject_reason}</Tag>
            )}
            <Table
              rowKey="employee_id"
              dataSource={planDetail.items}
              pagination={false}
              size="small"
              columns={modalColumns}
            />
            {planDetail.adjustments.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
                微调留痕 {planDetail.adjustments.length} 条（最近：
                {planDetail.adjustments[planDetail.adjustments.length - 1].old_pct}% →{' '}
                {planDetail.adjustments[planDetail.adjustments.length - 1].new_pct}%）
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal
        title={<Space><RobotOutlined />调薪资格初筛（判断辅助）</Space>}
        open={!!eligibility}
        onCancel={() => setEligibility(null)}
        footer={null}
        width={520}
      >
        {eligibility && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Tag color={eligibility.eligible ? 'success' : 'error'} style={{ fontSize: 14, padding: '4px 12px' }}>
              {eligibility.eligible ? '✓ 符合调薪基本条件' : '✗ 暂不建议调薪'}
            </Tag>
            {eligibility.perf_grade && (
              <div>最近绩效等级：<Tag>{eligibility.perf_grade}</Tag></div>
            )}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>判定依据</div>
              {eligibility.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 13, padding: '4px 0', color: 'var(--ink-2)' }}>· {r}</div>
              ))}
            </div>
            <Tag>规则引擎初筛（{eligibility.rule_source}）· 仅供参考，人拍板</Tag>
          </Space>
        )}
      </Modal>
    </div>
  );
}
