import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Space, Table, Tag, message,
} from 'antd';
import {
  compApi,
  type BonusPlan as BonusPlanDetail,
  type BonusPlanItem,
  type BonusPlanSummary,
} from '@/api/comp';
import { orgApi, type DepartmentItem } from '@/api/org';
import { ApiError } from '@/api/client';
import { useAuth } from '@/store/auth';

const fmt = (v: number) => `¥${v.toLocaleString()}`;
const money = (v: number | null | undefined) => (v == null ? '—' : fmt(v));
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : '操作失败，请稍后重试');

/** 部门包微调受控弹窗 */
function PoolTuneModal(props: {
  planId: string;
  deptId: string;
  formulaSum: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const { planId, deptId, formulaSum, onDone, onClose } = props;
  const [amount, setAmount] = useState<number>(formulaSum);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const ok = () => {
    if (!reason.trim()) { message.warning('请填写调整理由'); return; }
    setSaving(true);
    compApi.tuneDeptPool(planId, deptId, amount, reason.trim())
      .then(() => { message.success('已调整部门包'); onDone(); })
      .catch((e) => message.error(errMsg(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open
      title="微调部门包"
      onOk={ok}
      confirmLoading={saving}
      onCancel={onClose}
      okText="保存"
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <span>公式应发合计：{fmt(formulaSum)}</span>
        <InputNumber
          style={{ width: '100%' }}
          value={amount}
          min={0}
          precision={2}
          onChange={(v) => setAmount(v ?? 0)}
        />
        <Input.TextArea
          placeholder="调整理由（必填）"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Space>
    </Modal>
  );
}

/** 个人目标奖金覆盖受控弹窗 */
function ItemTuneModal(props: {
  planId: string;
  item: BonusPlanItem;
  onDone: () => void;
  onClose: () => void;
}) {
  const { planId, item, onDone, onClose } = props;
  const [target, setTarget] = useState<number>(item.target_bonus ?? 0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const ok = () => {
    if (!(target > 0)) { message.warning('目标奖金须大于 0'); return; }
    if (!reason.trim()) { message.warning('请填写覆盖理由（留痕）'); return; }
    setSaving(true);
    compApi.tuneBonusItem(planId, item.employee_id, target, reason.trim())
      .then((r) => {
        message.success(`已覆盖：公式应发 ${fmt(r.formula_amount)}`);
        onDone();
      })
      .catch((e) => message.error(errMsg(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open
      title={`覆盖目标奖金 · ${item.name ?? item.employee_no ?? ''}`}
      onOk={ok}
      confirmLoading={saving}
      onCancel={onClose}
      okText="保存覆盖"
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <span>
          原目标奖金：{money(item.target_bonus)} · 绩效系数 {item.perf_coefficient ?? '—'}
          {' · '}组织系数 {item.org_coefficient ?? '—'}
        </span>
        <InputNumber
          style={{ width: '100%' }}
          value={target}
          min={0.01}
          precision={2}
          onChange={(v) => setTarget(v ?? 0)}
        />
        <Input.TextArea
          placeholder="覆盖理由（必填，将写入审计）"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Space>
    </Modal>
  );
}

export function BonusPlan() {
  const activeRole = useAuth((s) => s.activeRole);
  const isApprover = activeRole === 'exec' || activeRole === 'tenant_admin';

  const [plans, setPlans] = useState<BonusPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [detail, setDetail] = useState<BonusPlanDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('2026H1 绩效奖金');
  const [perfPlanId, setPerfPlanId] = useState('');
  const [poolTotal, setPoolTotal] = useState<number>(0);
  const [poolTune, setPoolTune] = useState<{ planId: string; deptId: string; formulaSum: number } | null>(null);
  const [itemTune, setItemTune] = useState<{ planId: string; item: BonusPlanItem } | null>(null);

  useEffect(() => {
    orgApi.departments().then(setDepts).catch(() => undefined);
  }, []);

  const deptName = (id?: string | null) => depts.find((d) => d.id === id)?.name ?? id ?? '—';

  const refresh = () => {
    compApi.listBonusPlans().then((ps) => {
      setPlans(ps);
      setForbidden(false);
      setLoading(false);
    }).catch((e: unknown) => {
      setLoading(false);
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
    });
  };

  useEffect(() => { refresh(); }, []);

  const openDetail = (id: string) => {
    compApi.getBonusPlan(id).then((d) => setDetail(d))
      .catch((e) => message.error(errMsg(e)));
  };

  const handleCreate = () => {
    if (!perfPlanId) { message.warning('请输入考核方案 ID'); return; }
    compApi.createBonusPlan({
      perf_plan_id: perfPlanId, plan_name: newName,
      scope_depts: [], proration_enabled: true,
      bonus_pool_total: poolTotal > 0 ? poolTotal : 0,
    }).then(() => {
      message.success('已创建奖金方案');
      setCreating(false);
      setPoolTotal(0);
      refresh();
    }).catch((e) => message.error(errMsg(e)));
  };

  const handleCalculate = (id: string) => {
    compApi.calculateBonus(id).then((r) => {
      message.success(`测算完成：${r.headcount} 人，${r.excluded} 人排除`);
      openDetail(id);
      refresh();
    }).catch((e) => message.error(errMsg(e)));
  };

  const handleSubmit = (id: string) => {
    compApi.submitBonus(id).then(() => { message.success('已提交审批'); refresh(); openDetail(id); })
      .catch((e) => message.error(errMsg(e)));
  };

  const handleApprove = (id: string) => {
    compApi.approveBonus(id).then(() => { message.success('已批准'); refresh(); openDetail(id); })
      .catch((e) => message.error(errMsg(e)));
  };

  const handleExport = (id: string) => {
    compApi.downloadBonusPayout(id)
      .then(() => message.success('发放清单已导出'))
      .catch((e) => message.error(errMsg(e)));
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">绩效奖金</h1>
          <div className="page-subtitle">目标奖金 × 绩效系数 × 折算 · 部门包缩放 · 高管审批</div>
        </div>
        <Button type="primary" onClick={() => setCreating(true)} disabled={isApprover}>新建奖金方案</Button>
      </div>

      {forbidden ? (
        <Alert
          type="error"
          showIcon
          style={{ borderRadius: 8 }}
          message="无权查看奖金方案"
          description="当前角色没有奖金管理权限。奖金方案仅对薪酬 COE 与高管（高管视图个人金额掩码）开放。"
        />
      ) : (
      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={plans}
          pagination={false}
          columns={[
            { title: '方案名称', dataIndex: 'plan_name' },
            {
              title: '状态', dataIndex: 'status', width: 120,
              render: (s: string) => {
                const map: Record<string, string> = {
                  draft: 'default', calculated: 'blue', approving: 'orange',
                  archived: 'green',
                };
                return <Tag color={map[s] ?? 'default'}>{s}</Tag>;
              },
            },
            { title: '奖金包总额', dataIndex: 'bonus_pool_total', width: 140, render: (v: number) => fmt(v) },
            {
              title: '操作', width: 320,
              render: (_, p) => (
                <Space size="small">
                  <Button size="small" onClick={() => openDetail(p.id)}>明细</Button>
                  {!isApprover && (p.status === 'draft' || p.status === 'calculated') && (
                    <Button size="small" onClick={() => handleCalculate(p.id)}>测算</Button>
                  )}
                  {!isApprover && p.status === 'calculated' && (
                    <Button size="small" type="primary" onClick={() => handleSubmit(p.id)}>提交</Button>
                  )}
                  {isApprover && p.status === 'approving' && (
                    <Button size="small" type="primary" onClick={() => handleApprove(p.id)}>批准</Button>
                  )}
                  {p.status === 'archived' && (
                    <Button size="small" onClick={() => handleExport(p.id)}>导出发放清单</Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      )}

      {detail && (
        <Modal
          open={!!detail}
          title={`${detail.plan_name} · ${detail.status}`}
          width={900}
          footer={null}
          onCancel={() => setDetail(null)}
        >
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={8}><Card size="small"><b>奖金包总额</b>：{fmt(detail.bonus_pool_total)}</Card></Col>
            <Col span={8}><Card size="small"><b>折算</b>：{detail.proration_enabled ? '开启' : '关闭'}</Card></Col>
          </Row>
          {detail.dept_pools.length > 0 && (
            <Card size="small" title="部门包" style={{ marginBottom: 12 }}>
              <Table
                rowKey="dept_id"
                dataSource={detail.dept_pools}
                pagination={false}
                size="small"
                columns={[
                  { title: '部门', render: (_, r) => deptName(r.dept_id) },
                  { title: '目标合计', render: (_, r) => fmt(r.target_sum) },
                  { title: '公式合计', render: (_, r) => fmt(r.formula_sum) },
                  { title: '包额', render: (_, r) => fmt(r.pool_amount) },
                  { title: '缩放比', render: (_, r) => (r.formula_sum ? r.pool_amount / r.formula_sum : 1).toFixed(4) },
                  { title: '理由', dataIndex: 'adjust_reason', render: (v: string | null) => v ?? '—' },
                  {
                    title: '操作',
                    render: (_, r) => (!isApprover && detail.status === 'calculated') ? (
                      <Button size="small" onClick={() => setPoolTune({
                        planId: detail.id, deptId: r.dept_id, formulaSum: r.formula_sum,
                      })}
                      >
                        微调
                      </Button>
                    ) : null,
                  },
                ]}
              />
            </Card>
          )}
          <Card
            size="small"
            title="发放明细"
            extra={detail.status === 'archived' ? (
              <Button size="small" onClick={() => handleExport(detail.id)}>导出发放清单</Button>
            ) : null}
          >
            <Table
              rowKey="employee_id"
              dataSource={detail.items}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '员工', width: 180,
                  render: (_, r) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name ?? r.employee_id}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{[r.employee_no, deptName(r.dept_id)].filter(Boolean).join(' · ')}</div>
                    </div>
                  ),
                },
                { title: '绩效系数', width: 90, render: (_, r) => r.perf_coefficient ?? '—' },
                { title: '组织系数', width: 90, render: (_, r) => r.org_coefficient ?? '—' },
                { title: '服务月数', width: 90, render: (_, r) => r.service_months ?? '—' },
                { title: '目标奖金', render: (_, r) => money(r.target_bonus) },
                { title: '公式应发', render: (_, r) => money(r.formula_amount) },
                { title: '缩放比', dataIndex: 'scale_ratio', render: (v: number) => v.toFixed(4) },
                { title: '实发', render: (_, r) => money(r.final_amount) },
                { title: '排除原因', dataIndex: 'excluded_reason', render: (v: string | null) => v },
                {
                  title: '操作', width: 110,
                  render: (_, r) => (!isApprover && detail.status === 'calculated' && !r.excluded_reason) ? (
                    <Button size="small" onClick={() => setItemTune({ planId: detail.id, item: r })}>
                      覆盖目标
                    </Button>
                  ) : null,
                },
              ]}
            />
          </Card>
        </Modal>
      )}

      {poolTune && (
        <PoolTuneModal
          {...poolTune}
          onDone={() => { setPoolTune(null); openDetail(poolTune.planId); refresh(); }}
          onClose={() => setPoolTune(null)}
        />
      )}
      {itemTune && (
        <ItemTuneModal
          planId={itemTune.planId}
          item={itemTune.item}
          onDone={() => { const { planId } = itemTune; setItemTune(null); openDetail(planId); }}
          onClose={() => setItemTune(null)}
        />
      )}

      <Modal
        open={creating}
        title="新建奖金方案"
        onCancel={() => setCreating(false)}
        onOk={handleCreate}
        okText="创建"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>方案名称：<Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
          <div>考核方案 ID：<Input value={perfPlanId} onChange={(e) => setPerfPlanId(e.target.value)} /></div>
          <div>
            奖金包总额：
            <InputNumber
              style={{ width: 220 }}
              value={poolTotal}
              min={0}
              precision={2}
              onChange={(v) => setPoolTotal(v ?? 0)}
            />
            <span style={{ marginLeft: 8, color: 'var(--ink-4)', fontSize: 12 }}>
              填 0 或留空不预切，按公式 1:1 发放
            </span>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
