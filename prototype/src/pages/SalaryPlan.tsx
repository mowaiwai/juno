import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Progress, Row, Switch, Table, Tag, Tooltip, message } from 'antd';
import { ADJUST_BATCH, ANNUAL_BUDGET, AdjustSuggestion, adjustSuggestions, budgetOf } from '@/mock/salary';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { MaskedField } from '@/components/MaskedField';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

const ACTION_META: Record<AdjustSuggestion['action'], { label: string; color: string; bg: string }> = {
  UP: { label: '调升', color: 'var(--sage)', bg: 'var(--sage-soft)' },
  FREEZE: { label: '冻结', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  STOP: { label: '停涨', color: 'var(--danger)', bg: 'var(--danger-soft)' },
};

export function SalaryPlan() {
  const suggestions = useMemo(() => adjustSuggestions(), []);
  const [stress, setStress] = useState(false);
  const budget = stress ? 480000 : ANNUAL_BUDGET;
  const cost = budgetOf(suggestions);
  const usage = cost / budget;
  const exceeded = cost > budget;

  const counts = {
    up: suggestions.filter((s) => s.action === 'UP').length,
    freeze: suggestions.filter((s) => s.action === 'FREEZE').length,
    stop: suggestions.filter((s) => s.action === 'STOP').length,
  };
  const excludedLowPerf = employees.filter((e) => e.isCorePosition && e.perfScore < 85).length;
  const excludedStars = employees.filter((e) => !e.isCorePosition && e.perfScore >= 90).map((e) => e.name);

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">调薪方案建议</h1>
          <div className="page-subtitle">{ADJUST_BATCH} · 规则引擎生成：核心岗位核心人才 · 内部公平性（低薪高能优先）· 外部竞争性（75 分位停涨）</div>
        </div>
        <Button type="primary" style={{ background: 'var(--charcoal)' }} disabled={exceeded} onClick={() => message.success('方案已提交高管审批，共 ' + counts.up + ' 条调升建议进入审批流')}>
          提交审批
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>入选核心人才</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{suggestions.length} 人</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>调升 / 冻结 / 停涨</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>
              <span style={{ color: 'var(--sage)' }}>{counts.up}</span>
              <span style={{ color: 'var(--ink-4)' }}> / </span>
              <span style={{ color: 'var(--ochre)' }}>{counts.freeze}</span>
              <span style={{ color: 'var(--ink-4)' }}> / </span>
              <span style={{ color: 'var(--danger)' }}>{counts.stop}</span>
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>年新增成本</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--clay)' }}>{fmt(cost)}</div>
          </Card>
        </Col>
        <Col span={11}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>年度调薪预算使用率（预算 {fmt(budget)}）</span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                压力测试 ¥480,000 <Switch size="small" checked={stress} onChange={setStress} />
              </span>
            </div>
            <Progress
              percent={Math.round(usage * 100)}
              strokeColor={exceeded ? 'var(--danger)' : 'var(--sage)'}
              trailColor="var(--line)"
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {exceeded && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
          message={`超预算阻断：方案总额 ${fmt(cost)} 超出预算 ${fmt(cost - budget)}，提交被规则引擎拦截`}
          description="请缩减低优先级建议（内部公平分较低者），或走特批流程由 CEO 与 CFO 联签。"
        />
      )}

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="建议清单（按内部公平分降序 = 低薪高能优先）">
        <Table
          rowKey="id"
          dataSource={suggestions}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '员工',
              render: (_: unknown, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{deptName(r.dept)} · {r.position}</div>
                </div>
              ),
            },
            { title: '职级', width: 70, dataIndex: 'grade', render: (g: string) => <span style={{ fontWeight: 700 }}>{g}</span> },
            {
              title: '当前月薪',
              width: 110,
              render: (_: unknown, r) => <MaskedField value={r.oldSalary} format={(v) => fmt(Number(v))} />,
            },
            {
              title: '市场分位',
              width: 190,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress
                    percent={r.marketPercentile}
                    showInfo={false}
                    size="small"
                    strokeColor={r.marketPercentile >= 75 ? 'var(--danger)' : 'var(--teal)'}
                    trailColor="var(--line)"
                    style={{ width: 100, margin: 0 }}
                  />
                  <span className="num" style={{ color: r.marketPercentile >= 75 ? 'var(--danger)' : 'var(--ink-2)' }}>{r.marketPercentile}%</span>
                </div>
              ),
            },
            {
              title: '内部公平分',
              width: 110,
              sorter: (a: AdjustSuggestion, b: AdjustSuggestion) => a.internalEquityScore - b.internalEquityScore,
              render: (_: unknown, r) => (
                <Tooltip title="低于同职级中位越多，得分越高，调升优先级越高">
                  <span className="num" style={{ fontWeight: 700, color: r.internalEquityScore >= 70 ? 'var(--sage)' : r.internalEquityScore <= 40 ? 'var(--danger)' : 'var(--ochre)' }}>
                    {r.internalEquityScore}
                  </span>
                </Tooltip>
              ),
            },
            { title: '绩效', width: 70, render: (_: unknown, r) => <span className="num">{r.perfScore}</span> },
            {
              title: '建议动作',
              width: 100,
              render: (_: unknown, r) => (
                <Tag style={{ borderRadius: 6, background: ACTION_META[r.action].bg, color: ACTION_META[r.action].color, borderColor: 'transparent', fontWeight: 600 }}>
                  {ACTION_META[r.action].label}
                </Tag>
              ),
            },
            {
              title: '建议调薪',
              width: 150,
              render: (_: unknown, r) =>
                r.action === 'UP' ? (
                  <span className="num">
                    <span style={{ color: 'var(--sage)', fontWeight: 700 }}>+{r.suggestPct}%</span>
                    <span style={{ color: 'var(--ink-3)' }}> → </span>
                    <MaskedField value={r.newSalary} format={(v) => fmt(Number(v))} />
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                ),
            },
          ]}
          expandable={{
            rowExpandable: () => true,
            expandedRowRender: (r) => (
              <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', gap: 8 }}>
                <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>AI 依据</Tag>
                <span>{r.reason}</span>
              </div>
            ),
          }}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>规则闸门（未入选说明）</b>：核心岗位但绩效 &lt; 85 分共 {excludedLowPerf} 人不入选；非核心岗位的高绩效明星员工（{excludedStars.join('、')}）
          依据「年底调薪只给核心岗位上的核心人才」规则不入选，建议纳入专项留人池。所有决策输出均「草稿 → 确认 → 生效」，提交前经预算校验。
        </div>
      </Card>
    </div>
  );
}
