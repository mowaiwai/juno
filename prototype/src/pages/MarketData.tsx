import { useMemo } from 'react';
import { Card, Col, Row, Table, Tag } from 'antd';
import { marketData, percentileOf } from '@/mock/salary';
import { employees } from '@/mock/people';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

/** 分位刻度条：25/50/75/90 刻度 + 当前公司中位落点 */
function PctBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? 'var(--danger)' : pct >= 50 ? 'var(--sage)' : 'var(--ochre)';
  return (
    <div style={{ position: 'relative', width: 160, height: 14, background: 'var(--surface-sunken)', borderRadius: 4, border: '1px solid var(--line)' }}>
      {[25, 50, 75].map((t) => (
        <div key={t} style={{ position: 'absolute', left: `${t}%`, top: 0, bottom: 0, width: 1, background: 'var(--line)' }} />
      ))}
      <div style={{ position: 'absolute', left: '75%', top: -2, bottom: -2, width: 2, background: 'var(--danger)', opacity: 0.55 }} />
      <div style={{ position: 'absolute', left: `calc(${Math.min(97, pct)}% - 4px)`, top: 1, width: 8, height: 8, borderRadius: '50%', background: color }} />
    </div>
  );
}

export function MarketData() {
  const rows = useMemo(
    () =>
      marketData.map((m) => {
        const peers = employees.filter((e) => e.grade === m.grade && (m.sequence === 'O' ? e.grade.startsWith('O') : e.sequence === m.sequence));
        const sorted = peers.map((e) => e.salary).sort((a, b) => a - b);
        const mid = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
        return { m, count: peers.length, mid, pct: mid ? percentileOf(mid, m) : 0 };
      }),
    [],
  );
  const stale = rows.filter((r) => r.m.updatedAt < '2026-07-01');

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">市场分位数据</h1>
          <div className="page-subtitle">美世 / 怡安 2026 年度报告 · 月薪口径 · 75 分位停涨线数据基础</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>每半年更新</Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖职级组</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{marketData.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>数据来源</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>2 家</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>美世 · 怡安</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>公司中位 ≥ 75 分位</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{rows.filter((r) => r.pct >= 75).length} 组</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>触发停涨观察</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待更新数据组</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{stale.length}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="分位明细（带宽与停涨线生成依据）">
        <Table
          rowKey={(r) => r.m.sequence + r.m.grade}
          dataSource={rows}
          pagination={false}
          size="middle"
          columns={[
            { title: '序列', render: (_: unknown, r) => r.m.sequenceName },
            { title: '职级', width: 70, render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.m.grade}</span> },
            { title: 'P25', width: 90, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{fmt(r.m.p25)}</span> },
            { title: 'P50', width: 90, render: (_: unknown, r) => <span className="num" style={{ fontWeight: 600 }}>{fmt(r.m.p50)}</span> },
            { title: 'P75 停涨线', width: 110, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(r.m.p75)}</span> },
            { title: 'P90', width: 90, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{fmt(r.m.p90)}</span> },
            {
              title: '公司中位落点',
              width: 200,
              render: (_: unknown, r) =>
                r.count === 0 ? (
                  <span style={{ color: 'var(--ink-4)' }}>无在职样本</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PctBar pct={r.pct} />
                    <span className="num" style={{ color: r.pct >= 75 ? 'var(--danger)' : 'var(--ink-2)' }}>{r.pct} 分位</span>
                  </div>
                ),
            },
            { title: '在职', width: 70, render: (_: unknown, r) => <span className="num">{r.count} 人</span> },
            {
              title: '来源 / 更新',
              width: 150,
              render: (_: unknown, r) => (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {r.m.source} · {r.m.updatedAt}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>外部竞争性规则</b>：调薪建议生成时，员工薪酬分位由本表分段线性插值得出；分位 ≥ 75% 触发停涨（STOP），确保薪酬包竞争而不冒进。
          数据维护走「上传报告 → 校验 → 生效」流程，历史版本留痕可回溯。
        </div>
      </Card>
    </div>
  );
}
