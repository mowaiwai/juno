import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Modal, Row, Table, Tabs, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  compApi,
  type AdjustmentItem,
  type AdjustmentPlan,
  type AdjustmentPlanSummary,
} from '@/api/comp';
import { ApiError } from '@/api/client';
import { useAuth } from '@/store/auth';

const fmt = (v: number) => `¥${v.toLocaleString()}`;
const money = (v: number | null | undefined) => (v == null ? '—' : fmt(v));

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  approving: 'processing',
  approved: 'success',
};
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿（驳回退回）', approving: '审批中', approved: '已批准',
};

const MARK_LABEL: Record<string, string> = {
  market_stop: '75 分位停涨',
  pip_fail: 'PIP 不通过降薪',
};

export function SalaryApprove() {
  const activeRole = useAuth((s) => s.activeRole);
  const canApprove = activeRole === 'exec' || activeRole === 'tenant_admin';

  const [plans, setPlans] = useState<AdjustmentPlanSummary[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [detail, setDetail] = useState<AdjustmentPlan | null>(null);
  const [rejecting, setRejecting] = useState<AdjustmentPlan | null>(null);
  const [reason, setReason] = useState('');

  const refresh = () => {
    compApi.listAdjustmentPlans().then((rows) => {
      setPlans(rows);
      setForbidden(false);
    }).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const pending = useMemo(() => plans.filter((p) => p.status === 'approving'), [plans]);
  const history = useMemo(
    () => plans.filter((p) => p.status === 'approved' || (p.status === 'draft' && !!p.reject_reason)),
    [plans],
  );
  const pendingCost = pending.reduce((s, p) => s + p.budget_total * 12, 0);

  const openDetail = (id: string) => {
    compApi.getAdjustmentPlan(id).then(setDetail).catch((e) => message.error(e.message));
  };

  const approve = (p: AdjustmentPlan) => {
    Modal.confirm({
      title: `批准方案「${p.plan_name}」`,
      content: `共 ${p.items.length} 人，批准后逐人写入薪资账套并记录调薪历史，不可撤销。`,
      onOk: () =>
        compApi.approveAdjustment(p.id).then(() => {
          message.success('方案已批准，薪资账套已联动更新');
          setDetail(null);
          refresh();
        }).catch((e) => message.error(e.message)),
    });
  };

  const confirmReject = () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) {
      message.warning('驳回原因至少 5 个字，审批留痕必填');
      return;
    }
    compApi.rejectAdjustment(rejecting.id, reason.trim()).then(() => {
      message.success('已驳回，驳回原因已留痕');
      setRejecting(null);
      setReason('');
      setDetail(null);
      refresh();
    }).catch((e) => message.error(e.message));
  };

  const itemColumns: ColumnsType<AdjustmentItem> = [
    {
      title: '员工',
      render: (_: unknown, r: AdjustmentItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name ?? r.employee_id}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.employee_no}</div>
        </div>
      ),
    },
    { title: '职级', width: 70, render: (_: unknown, r) => r.grade ?? '—' },
    { title: '绩效', width: 70, render: (_: unknown, r) => r.perf_grade ?? '—' },
    {
      title: '渗透率',
      width: 80,
      render: (_: unknown, r) => (r.penetration != null ? r.penetration.toFixed(2) : '—'),
    },
    { title: '当前月薪', width: 110, render: (_: unknown, r) => money(r.current_salary) },
    {
      title: '建议调薪',
      width: 90,
      render: (_: unknown, r) => (
        <span className="num" style={{ fontWeight: 700, color: r.suggested_pct < 0 ? 'var(--danger)' : 'var(--sage)' }}>
          {r.suggested_pct > 0 ? '+' : ''}{r.suggested_pct}%
        </span>
      ),
    },
    {
      title: '建议月薪',
      width: 110,
      render: (_: unknown, r) => (
        <span style={{ color: r.suggested_salary == null ? 'var(--ink-4)' : 'var(--sage)' }}>
          {money(r.suggested_salary)}
        </span>
      ),
    },
    {
      title: '标记',
      width: 130,
      render: (_: unknown, r) =>
        r.mark ? <Tag color="error">{MARK_LABEL[r.mark] ?? r.mark}</Tag> : '—',
    },
  ];

  const listColumns = (withActions: boolean): ColumnsType<AdjustmentPlanSummary> => [
    { title: '方案名称', dataIndex: 'plan_name' },
    { title: '人数', dataIndex: 'headcount', width: 80 },
    {
      title: '年化新增成本',
      width: 150,
      render: (_: unknown, p: AdjustmentPlanSummary) => <span className="num">{fmt(p.budget_total * 12)}</span>,
    },
    {
      title: '状态',
      width: 130,
      render: (_: unknown, p: AdjustmentPlanSummary) => (
        <Tag color={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status] ?? p.status}</Tag>
      ),
    },
    ...(withActions
      ? [{
          title: '操作',
          width: 160,
          render: (_: unknown, p: AdjustmentPlanSummary) => (
            <div style={{ display: 'flex' }}>
              <Button
                type="link" size="small" style={{ padding: '0 4px' }}
                onClick={() => openDetail(p.id)}
              >
                {canApprove && p.status === 'approving' ? '审批' : '查看明细'}
              </Button>
            </div>
          ),
        }]
      : [{
          title: '结论',
          render: (_: unknown, p: AdjustmentPlanSummary) =>
            p.status === 'approved' ? (
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                已批准{p.approved_at ? ` · ${p.approved_at.slice(0, 10)}` : ''}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--danger)' }}>驳回：{p.reject_reason}</span>
            ),
        }]),
  ];

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">调薪审批</h1>
          <div className="page-subtitle">草稿 → 审批中 → 批准（写薪资账套）/ 驳回（退回草稿）· 驳回原因必填留痕{!canApprove && ' · 当前角色仅可查看'}</div>
        </div>
      </div>

      {forbidden ? (
        <Alert
          type="error"
          showIcon
          style={{ borderRadius: 8 }}
          message="无权查看调薪审批"
          description="当前角色没有薪酬激励相关权限。调薪方案仅对薪酬 COE 与高管（高管视图金额掩码）开放，如需访问请联系管理员调整角色。"
        />
      ) : (
        <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待我审批</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{pending.length} 件</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待批年化新增成本</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{fmt(pendingCost)}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>审批时效承诺</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--sage)' }}>≤ 5 个工作日</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Tabs
          defaultActiveKey="pending"
          items={[
            {
              key: 'pending',
              label: `待审批（${pending.length}）`,
              children: pending.length ? (
                <Table rowKey="id" dataSource={pending} pagination={false} size="middle" columns={listColumns(true)} />
              ) : (
                <Empty description="暂无待批方案" style={{ padding: '24px 0' }} />
              ),
            },
            {
              key: 'history',
              label: `已办结（${history.length}）`,
              children: (
                <Table
                  rowKey="id"
                  dataSource={history}
                  pagination={false}
                  size="middle"
                  columns={listColumns(false)}
                  expandable={{
                    rowExpandable: (p) => !!p.reject_reason,
                    expandedRowRender: (p) => (
                      <div style={{ fontSize: 12, color: 'var(--danger)' }}>驳回原因：{p.reject_reason}</div>
                    ),
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>流程约定</b>：年度调薪由 HR COE 测算、微调后提交；高管单级审批。批准后逐人写入薪资账套、生成调薪历史与审计日志；
          驳回后方案退回草稿，HR 修改后可重新提交，驳回历史永久留痕。高管视图中个人金额按权限掩码，仅显示百分比与汇总。
        </div>
      </Card>
        </>
      )}

      <Modal
        open={!!detail}
        title={detail ? `${detail.plan_name} · ${STATUS_LABEL[detail.status] ?? detail.status}` : ''}
        width={1000}
        footer={
          detail?.status === 'approving' && canApprove
            ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button danger onClick={() => setRejecting(detail)}>驳回</Button>
                <Button type="primary" onClick={() => approve(detail)}>批准并写薪</Button>
              </div>
            )
            : null
        }
        onCancel={() => setDetail(null)}
      >
        {detail && (
          <>
            {detail.reject_reason && (
              <Tag color="error" style={{ marginBottom: 12 }}>上次驳回原因：{detail.reject_reason}</Tag>
            )}
            <Table
              rowKey="employee_id"
              dataSource={detail.items}
              pagination={false}
              size="small"
              columns={itemColumns}
            />
          </>
        )}
      </Modal>

      <Modal
        title="驳回调薪方案"
        open={!!rejecting}
        onOk={confirmReject}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onCancel={() => { setRejecting(null); setReason(''); }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-2)' }}>
          驳回后方案退回草稿，HR 修改后可重新提交。驳回原因必填，将留痕并通知起草人。
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：市场分位数据未更新，暂缓至下批次"
          style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 13, fontFamily: 'inherit' }}
        />
      </Modal>
    </div>
  );
}
