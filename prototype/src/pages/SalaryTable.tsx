import { useMemo, useState } from 'react';
import { Card, Col, Progress, Row, Table, Tabs, Tag, Tooltip } from 'antd';
import { bandOf, coveredSequences, marketOf } from '@/mock/salary';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { MaskedField } from '@/components/MaskedField';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

/** 带宽五档条 */
function TierBar({ tiers }: { tiers: number[] }) {
  return (
    <Tooltip title={tiers.map((t, i) => `${i + 1} 档 ¥${t.toLocaleString()}`).join(' · ')}>
      <div style={{ display: 'flex', width: 180, height: 14, borderRadius: 4, overflow: 'hidden' }}>
        {tiers.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: `color-mix(in srgb, var(--clay) ${25 + i * 15}%, var(--clay-soft))`,
              borderRight: i < 4 ? '1px solid var(--surface)' : 'none',
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
}

function compaColor(r: number) {
  if (r < 0.85) return 'var(--danger)';
  if (r > 1.15) return 'var(--ochre)';
  return 'var(--sage)';
}

export function SalaryTable() {
  const seqs = coveredSequences();
  const [seq, setSeq] = useState(seqs[0].sequence);

  const rows = useMemo(
    () =>
      seqs
        .find((s) => s.sequence === seq)!
        .grades.map((g) => {
          const band = bandOf(seq, g)!;
          const m = marketOf(seq, g)!;
          const peers = employees.filter((e) => e.grade === g && (g.startsWith('O') ? true : e.sequence === seq));
          const compas = peers.map((e) => e.salary / band.mid);
          const avg = compas.length ? compas.reduce((a, b) => a + b, 0) / compas.length : 0;
          return { band, m, count: peers.length, avg };
        }),
    [seq, seqs],
  );

  const coverage = useMemo(() => {
    const stats = { low: 0, in: 0, high: 0 };
    for (const e of employees) {
      const b = bandOf(e.sequence, e.grade);
      if (!b) continue;
      const r = e.salary / b.mid;
      if (r < 0.85) stats.low++;
      else if (r > 1.15) stats.high++;
      else stats.in++;
    }
    return stats;
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">等级工资表</h1>
          <div className="page-subtitle">以市场 P50 锚定带宽 · M 序列宽带 · 每职级 5 档 · 岗变薪变联动</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>
          2026 版 · 已生效
        </Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖职级组</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{coveredSequences().reduce((s, x) => s + x.grades.length, 0)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>带宽内（0.85–1.15）</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--sage)' }}>{coverage.in} 人</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>低于下沿（&lt;0.85）</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{coverage.low} 人</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高于上沿（&gt;1.15）</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{coverage.high} 人</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Tabs
          activeKey={seq}
          onChange={setSeq}
          items={seqs.map((s) => ({ key: s.sequence, label: s.name }))}
        />
        <Table
          rowKey={(r) => r.band.grade}
          dataSource={rows}
          pagination={false}
          size="middle"
          columns={[
            { title: '职级', width: 90, render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.band.grade}</span> },
            {
              title: '带宽（月基本工资）',
              render: (_: unknown, r) => (
                <span className="num" style={{ fontWeight: 600 }}>
                  {fmt(r.band.min)} — {fmt(r.band.max)}
                </span>
              ),
            },
            {
              title: '五档薪档',
              width: 220,
              render: (_: unknown, r) => <TierBar tiers={r.band.tiers} />,
            },
            { title: '带宽比', width: 90, render: (_: unknown, r) => <span className="num">{(r.band.max / r.band.min).toFixed(2)}</span> },
            { title: '市场 P50', width: 110, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-2)' }}>{fmt(r.m.p50)}</span> },
            { title: '75 分位停涨线', width: 130, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--danger)' }}>{fmt(r.m.p75)}</span> },
            {
              title: '在职',
              width: 70,
              render: (_: unknown, r) => <span className="num">{r.count} 人</span>,
            },
            {
              title: '平均渗透率',
              width: 170,
              render: (_: unknown, r) =>
                r.count === 0 ? (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Progress
                      percent={Math.min(100, Math.round(r.avg * 100))}
                      showInfo={false}
                      size="small"
                      strokeColor={compaColor(r.avg)}
                      trailColor="var(--line)"
                      style={{ width: 90, margin: 0 }}
                    />
                    <span className="num" style={{ color: compaColor(r.avg) }}>{r.avg.toFixed(2)}</span>
                  </div>
                ),
            },
          ]}
          expandable={{
            rowExpandable: () => true,
            expandedRowRender: (r) => (
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                {employees
                  .filter((e) => e.grade === r.band.grade && (r.band.grade.startsWith('O') ? true : e.sequence === seq))
                  .map((e) => (
                    <div key={e.id} style={{ display: 'flex', gap: 12, padding: '3px 0' }}>
                      <span style={{ width: 60 }}>{e.name}</span>
                      <span style={{ width: 170, color: 'var(--ink-3)' }}>{deptName(e.deptId)} · {e.position}</span>
                      <span style={{ width: 110 }}>
                        <MaskedField value={e.salary} format={(v) => fmt(Number(v))} />
                      </span>
                      <span style={{ color: compaColor(e.salary / r.band.mid) }} className="num">
                        渗透率 {(e.salary / r.band.mid).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            ),
          }}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>规则说明</b>：带宽以市场 P50 锚定生成，管理序列带宽比 1.80、专业序列 1.64；晋升认证通过后按「岗变薪变」晋档，套改过渡期补贴不计入带宽。
        </div>
      </Card>
    </div>
  );
}
