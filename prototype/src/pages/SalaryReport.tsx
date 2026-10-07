import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Row, Table, Tag, message } from 'antd';
import { FilePdfOutlined, FilePptOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { compApi, type AdjustmentPlanSummary, type BonusPlanSummary } from '@/api/comp';

const fmt = (v: number) => `¥${Math.round(v).toLocaleString()}`;

const STATUS_TAG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: 'var(--ink-2)', bg: 'var(--surface-sunken)' },
  submitted: { label: '待审批', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  approved: { label: '已批准', color: 'var(--sage)', bg: 'var(--sage-soft)' },
  rejected: { label: '已驳回', color: 'var(--danger)', bg: 'var(--clay-soft)' },
};

function StatusTag({ status }: { status: string }) {
  const t = STATUS_TAG[status] ?? STATUS_TAG.draft;
  return (
    <Tag style={{ borderRadius: 6, background: t.bg, color: t.color, borderColor: 'transparent' }}>
      {t.label}
    </Tag>
  );
}

const QUESTIONS = [
  {
    q: '调薪包是否向核心人才倾斜到位？',
    detail: '年度调薪只给核心岗位上的核心人才；建议核对方案内「低薪高能优先」标记的覆盖比例，避免普惠式普调稀释激励效果。',
  },
  {
    q: '停涨线执行口径是否一致？',
    detail: '渗透率 ≥ P75 的员工触发停涨（STOP），管理层需确认是否有特批个案，以及市场分位数据的更新节奏。',
  },
  {
    q: '奖金包预切与部门再分配的授权边界？',
    detail: '包内重缩放由 HR 操作留痕；部门包调整需说明理由，管理层需确认授权范围与审批人。',
  },
];

export function SalaryReport() {
  const [adjustPlans, setAdjustPlans] = useState<AdjustmentPlanSummary[]>([]);
  const [bonusPlans, setBonusPlans] = useState<BonusPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([compApi.listAdjustmentPlans(), compApi.listBonusPlans()])
      .then(([a, b]) => {
        setAdjustPlans(a);
        setBonusPlans(b);
      })
      .catch((e) => message.error(e?.message ?? '加载薪酬方案数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const approvedAdj = adjustPlans.filter((p) => p.status === 'approved');
    const approvedBonus = bonusPlans.filter((p) => p.status === 'approved');
    return {
      adjTotal: adjustPlans.length,
      adjApproved: approvedAdj.length,
      adjHeadcount: approvedAdj.reduce((s, p) => s + p.headcount, 0),
      adjBudget: approvedAdj.reduce((s, p) => s + p.budget_total, 0),
      bonusTotal: bonusPlans.length,
      bonusApproved: approvedBonus.length,
      bonusPool: approvedBonus.reduce((s, p) => s + p.bonus_pool_total, 0),
      bonusPoolAll: bonusPlans.reduce((s, p) => s + p.bonus_pool_total, 0),
    };
  }, [adjustPlans, bonusPlans]);

  const conclusion =
    stats.adjTotal === 0 && stats.bonusTotal === 0
      ? '本期暂无调薪 / 奖金方案。请先在「调薪方案」「绩效奖金」中创建并测算方案，本页将自动汇总生成汇报结论。'
      : `本期共 ${stats.adjTotal} 个调薪方案（已批准 ${stats.adjApproved} 个，覆盖 ${stats.adjHeadcount} 人、月增预算 ${fmt(stats.adjBudget)}），${stats.bonusTotal} 个奖金方案（已批准 ${stats.bonusApproved} 个，奖金包 ${fmt(stats.bonusPool)}）。所有批准动作均留痕可审计，建议按方案清单逐项过会确认。`;

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <Card loading style={{ minHeight: 300 }} />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">薪酬汇报材料</h1>
          <div className="page-subtitle">先结论 → 抛问题 → 数据 → 方案清单 · 供管理层汇报（实时取自调薪 / 奖金方案）</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<FilePdfOutlined />} onClick={() => message.success('汇报 PDF 已生成（模拟）')}>
            导出 PDF
          </Button>
          <Button icon={<FilePptOutlined />} onClick={() => message.success('汇报 PPT 已生成（模拟）')}>
            导出 PPT
          </Button>
        </div>
      </div>

      {/* 一、结论先行 */}
      <Card variant="borderless" style={{ background: 'var(--clay-soft)', marginBottom: 16 }} size="small">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Tag style={{ borderRadius: 6, background: 'var(--clay)', color: '#fff', borderColor: 'transparent', fontWeight: 700, marginTop: 2 }}>结论</Tag>
          <div className="font-serif" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.7 }}>
            {conclusion}
          </div>
        </div>
      </Card>

      {/* 二、抛出问题 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="二、抛给管理层的三个问题">
        <Row gutter={16}>
          {QUESTIONS.map((q, i) => (
            <Col span={8} key={i}>
              <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 14, height: '100%' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <QuestionCircleOutlined style={{ color: 'var(--ochre)' }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>问题 {i + 1}</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{q.q}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>{q.detail}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 三、数据支撑 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="三、数据支撑（实时方案汇总）">
        <Row gutter={16}>
          <Col span={4}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>调薪方案</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{stats.adjTotal} 个</div>
            </Card>
          </Col>
          <Col span={4}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已批准覆盖</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--sage)' }}>{stats.adjHeadcount} 人</div>
            </Card>
          </Col>
          <Col span={5}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>月增预算（已批）</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--clay)' }}>{fmt(stats.adjBudget)}</div>
            </Card>
          </Col>
          <Col span={4}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>奖金方案</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{stats.bonusTotal} 个</div>
            </Card>
          </Col>
          <Col span={7}>
            <Card variant="borderless" style={{ background: 'var(--surface-sunken)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>奖金包（已批 / 全部）</div>
              <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)' }}>
                {fmt(stats.bonusPool)} <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>/ {fmt(stats.bonusPoolAll)}</span>
              </div>
            </Card>
          </Col>
        </Row>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.8 }}>
          口径说明：预算取方案测算结果汇总；仅「已批准」状态计入执行口径，草稿 / 待审批 / 已驳回方案不计入。
          金额明细按角色权限掩码展示（COE·薪酬激励与租户管理员可见明文）。
        </div>
      </Card>

      {/* 四、方案清单 */}
      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="四、方案清单">
        <div style={{ fontWeight: 700, fontSize: 13, margin: '4px 0 8px' }}>调薪方案</div>
        {adjustPlans.length === 0 ? (
          <Empty description="暂无调薪方案" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            rowKey="id"
            dataSource={adjustPlans}
            pagination={false}
            size="small"
            style={{ marginBottom: 16 }}
            columns={[
              { title: '方案名称', render: (_, p) => p.plan_name },
              { title: '状态', width: 100, render: (_, p) => <StatusTag status={p.status} /> },
              { title: '人数', width: 80, render: (_, p) => <span className="num">{p.headcount}</span> },
              { title: '月增预算', width: 130, render: (_, p) => <span className="num">{fmt(p.budget_total)}</span> },
              {
                title: '批准时间',
                width: 170,
                render: (_, p) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.approved_at ?? '—'}</span>,
              },
            ]}
          />
        )}
        <div style={{ fontWeight: 700, fontSize: 13, margin: '4px 0 8px' }}>绩效奖金方案</div>
        {bonusPlans.length === 0 ? (
          <Empty description="暂无奖金方案" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            rowKey="id"
            dataSource={bonusPlans}
            pagination={false}
            size="small"
            columns={[
              { title: '方案名称', render: (_, p) => p.plan_name },
              { title: '状态', width: 100, render: (_, p) => <StatusTag status={p.status} /> },
              { title: '奖金包', width: 150, render: (_, p) => <span className="num">{fmt(p.bonus_pool_total)}</span> },
            ]}
          />
        )}
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
          审批 / 驳回操作在「调薪审批」「绩效奖金」页完成；本页为只读汇报视图。
        </div>
      </Card>
    </div>
  );
}
