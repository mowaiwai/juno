import { useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Modal, Row, Table, Tabs, Tag, message } from 'antd';
import { approvalHistory, approvalPending, ApprovalRecord } from '@/mock/salary';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { useAuth } from '@/store/auth';
import { MaskedField } from '@/components/MaskedField';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

const KIND_META = {
  annual: { label: '年度调薪', color: 'var(--teal)', bg: 'var(--teal-soft)' },
  promotion: { label: '晋升联动', color: 'var(--clay)', bg: 'var(--clay-soft)' },
};
const STATUS_META: Record<ApprovalRecord['status'], { label: string; color: string; bg: string }> = {
  1: { label: '审批中', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  2: { label: '已通过', color: 'var(--sage)', bg: 'var(--sage-soft)' },
  3: { label: '已驳回', color: 'var(--danger)', bg: 'var(--danger-soft)' },
};

function EmployeeCell({ id }: { id: string }) {
  const e = employees.find((x) => x.id === id);
  if (!e) return <span>—</span>;
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{e.name}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{deptName(e.deptId)} · {e.position}</div>
    </div>
  );
}

export function SalaryApprove() {
  const persona = useAuth((s) => s.persona);
  const [records, setRecords] = useState<ApprovalRecord[]>(approvalPending);
  const [rejecting, setRejecting] = useState<ApprovalRecord | null>(null);
  const [reason, setReason] = useState('');

  const pending = records.filter((r) => r.status === 1);
  const decidedLocal = records.filter((r) => r.status !== 1);
  const pendingCost = pending.reduce((s, r) => s + (r.newSalary - r.oldSalary) * 12, 0);

  const approve = (r: ApprovalRecord) => {
    setRecords((list) => list.map((x) => (x.id === r.id ? { ...x, status: 2, decidedAt: '2026-09-27', decider: persona?.name } : x)));
    message.success(`${employees.find((e) => e.id === r.employeeId)?.name} 调薪已通过，职级薪酬联动生效`);
  };

  const confirmReject = () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) {
      message.warning('驳回原因至少 5 个字，审批留痕必填');
      return;
    }
    setRecords((list) => list.map((x) => (x.id === rejecting.id ? { ...x, status: 3, decidedAt: '2026-09-27', decider: persona?.name, rejectReason: reason.trim() } : x)));
    message.success('已驳回，驳回原因已留痕');
    setRejecting(null);
    setReason('');
  };

  const columns = (interactive: boolean) => [
    { title: '员工', render: (_: unknown, r: ApprovalRecord) => <EmployeeCell id={r.employeeId} /> },
    {
      title: '类型',
      width: 110,
      render: (_: unknown, r: ApprovalRecord) => (
        <Tag style={{ borderRadius: 6, background: KIND_META[r.kind].bg, color: KIND_META[r.kind].color, borderColor: 'transparent' }}>{KIND_META[r.kind].label}</Tag>
      ),
    },
    {
      title: '职级变动',
      width: 110,
      render: (_: unknown, r: ApprovalRecord) =>
        r.oldGrade === r.newGrade ? (
          <span style={{ color: 'var(--ink-4)' }}>{r.oldGrade} 不变</span>
        ) : (
          <span className="num" style={{ fontWeight: 700 }}>
            {r.oldGrade} → {r.newGrade}
          </span>
        ),
    },
    {
      title: '薪酬变动',
      render: (_: unknown, r: ApprovalRecord) => (
        <span className="num">
          <MaskedField value={r.oldSalary} format={(v) => fmt(Number(v))} />
          <span style={{ color: 'var(--ink-3)' }}> → </span>
          <span style={{ color: 'var(--sage)', fontWeight: 700 }}>{fmt(r.newSalary)}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>（+{Math.round(((r.newSalary - r.oldSalary) / r.oldSalary) * 100)}%）</span>
        </span>
      ),
    },
    { title: '市场分位', width: 90, render: (_: unknown, r: ApprovalRecord) => (r.marketPercentile ? <span className="num">{r.marketPercentile}%</span> : '—') },
    { title: '提交时间', width: 110, dataIndex: 'submittedAt' },
    {
      title: '状态',
      width: 100,
      render: (_: unknown, r: ApprovalRecord) => (
        <Tag style={{ borderRadius: 6, background: STATUS_META[r.status].bg, color: STATUS_META[r.status].color, borderColor: 'transparent', fontWeight: 600 }}>
          {STATUS_META[r.status].label}
        </Tag>
      ),
    },
    ...(interactive
      ? [
          {
            title: '操作',
            width: 150,
            render: (_: unknown, r: ApprovalRecord) => (
              <div style={{ display: 'flex' }}>
                <Button type="link" size="small" style={{ color: 'var(--sage)', fontWeight: 600, padding: '0 4px' }} onClick={() => approve(r)}>
                  通过
                </Button>
                <Button type="link" size="small" danger style={{ fontWeight: 600, padding: '0 4px' }} onClick={() => setRejecting(r)}>
                  驳回
                </Button>
              </div>
            ),
          },
        ]
      : [
          {
            title: '审批结论',
            render: (_: unknown, r: ApprovalRecord) => (
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {r.decider} · {r.decidedAt}
                {r.rejectReason && <div style={{ color: 'var(--danger)', marginTop: 2 }}>驳回原因：{r.rejectReason}</div>}
              </span>
            ),
          },
        ]),
  ];

  const historyColumns = useMemo(() => columns(false), []);
  const pendingColumns = useMemo(() => columns(true), []);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">调薪审批</h1>
          <div className="page-subtitle">建议 → 审批中 → 通过 / 驳回 · 驳回原因必填留痕 · 通过后职级薪酬联动生效</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待我审批</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{pending.length} 件</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本批年化新增成本</div>
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
                <Table rowKey="id" dataSource={pending} pagination={false} size="middle" columns={pendingColumns} />
              ) : (
                <Empty description="本批已全部办结，等待 HR 归档生效" style={{ padding: '24px 0' }} />
              ),
            },
            {
              key: 'history',
              label: `已办结（${approvalHistory.length + decidedLocal.length}）`,
              children: (
                <Table
                  rowKey="id"
                  dataSource={[...decidedLocal, ...approvalHistory]}
                  pagination={false}
                  size="middle"
                  columns={historyColumns}
                  expandable={{
                    rowExpandable: (r) => !!r.rejectReason,
                    expandedRowRender: (r) => (
                      <div style={{ fontSize: 12, color: 'var(--danger)' }}>驳回原因：{r.rejectReason}</div>
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
          <b>流程约定</b>：晋升联动类调薪随认证结果自动发起（岗变薪变）；年度调薪由 HR 起草、高管审批。驳回后 HR 修改可重新提交，驳回历史永久留痕；
          审批通过后当月薪资账套联动更新，并写审计日志（操作人 / 时间 / 前后状态）。
        </div>
      </Card>

      <Modal
        title="驳回调薪建议"
        open={!!rejecting}
        onOk={confirmReject}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onCancel={() => { setRejecting(null); setReason(''); }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-2)' }}>
          驳回 {rejecting && employees.find((e) => e.id === rejecting.employeeId)?.name} 的调薪建议（
          {rejecting && fmt(rejecting.oldSalary)} → {rejecting && fmt(rejecting.newSalary)}）。驳回原因必填，将留痕并通知起草人。
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：分位数据未更新，暂缓至下批次"
          style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 13, fontFamily: 'inherit' }}
        />
      </Modal>
    </div>
  );
}
