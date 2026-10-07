import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Table, Tag, Spin, message } from 'antd';
import { orgApi, type ChannelFamily, type GradeBand } from '@/api/org';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

/** 分位刻度条：25/50/75 刻度 + 落点 */
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

/** 分位定位：p25–p90 分段线性插值，返回 5–99（与调薪引擎同口径） */
function percentileOf(salary: number, p25: number, p50: number, p75: number, p90: number): number {
  const pts: [number, number][] = [[p25, 25], [p50, 50], [p75, 75], [p90, 90]];
  if (salary <= pts[0][0]) return Math.max(5, Math.round((salary / pts[0][0]) * 25));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    if (salary <= x2) return Math.round(y1 + ((salary - x1) / (x2 - x1)) * (y2 - y1));
  }
  return Math.min(99, Math.round(90 + ((salary - pts[3][0]) / pts[3][0]) * 10));
}

interface Row {
  key: string;
  familyName: string;
  grade: string;
  band: GradeBand;
  headcount: number;
  bandMidPct: number | null; // 带宽中点相对市场分位的落点
}

export function MarketData() {
  const [channels, setChannels] = useState<ChannelFamily[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([orgApi.channels(), employeesApi.list().catch(() => [])])
      .then(([chs, emps]) => {
        setChannels(chs);
        setEmployees(emps);
      })
      .catch((e) => message.error(e?.message ?? '加载市场分位数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!channels) return [];
    const out: Row[] = [];
    for (const ch of channels) {
      for (const g of ch.grades) {
        if (g.p25 == null || g.p50 == null || g.p75 == null || g.p90 == null) continue;
        const count = employees.filter(
          (e) => e.grade === g.grade && (e.sequence ? ch.sequences.includes(e.sequence) : e.family === ch.family),
        ).length;
        const mid = (g.salary_band[0] + g.salary_band[1]) / 2;
        out.push({
          key: `${ch.family}:${g.grade}`,
          familyName: ch.name,
          grade: g.grade,
          band: g,
          headcount: count,
          bandMidPct: g.p25 > 0 ? percentileOf(mid, g.p25, g.p50, g.p75, g.p90) : null,
        });
      }
    }
    return out;
  }, [channels, employees]);

  const noMarket = channels
    ? channels.flatMap((c) => c.grades).filter((g) => g.p25 == null).length
    : 0;

  if (loading || !channels) {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">市场分位数据</h1>
          <div className="page-subtitle">市场报告分位锚定 · 月薪口径 · 75 分位停涨线数据基础</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>每半年更新</Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖职级组</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{rows.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>数据来源</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
              {new Set(rows.map((r) => r.band.market_source_year).filter(Boolean)).size || 1} 期
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>租户可覆盖维护</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>带宽中点 ≥ P75</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>
              {rows.filter((r) => r.bandMidPct != null && r.bandMidPct >= 75).length} 组
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>触发停涨观察</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待补市场数据</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{noMarket}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>等级工资表中维护</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="分位明细（带宽与停涨线生成依据）">
        <Table
          rowKey={(r) => r.key}
          dataSource={rows}
          pagination={false}
          size="middle"
          columns={[
            { title: '序列', render: (_: unknown, r) => r.familyName },
            { title: '职级', width: 70, render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.grade}</span> },
            { title: 'P25', width: 90, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{fmt(r.band.p25!)}</span> },
            { title: 'P50', width: 90, render: (_: unknown, r) => <span className="num" style={{ fontWeight: 600 }}>{fmt(r.band.p50!)}</span> },
            { title: 'P75 停涨线', width: 110, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(r.band.p75!)}</span> },
            { title: 'P90', width: 90, render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{fmt(r.band.p90!)}</span> },
            {
              title: '带宽中点落点',
              width: 200,
              render: (_: unknown, r) =>
                r.bandMidPct == null ? (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PctBar pct={r.bandMidPct} />
                    <span className="num" style={{ color: r.bandMidPct >= 75 ? 'var(--danger)' : 'var(--ink-2)' }}>{r.bandMidPct} 分位</span>
                  </div>
                ),
            },
            { title: '在职', width: 70, render: (_: unknown, r) => <span className="num">{r.headcount} 人</span> },
            {
              title: '数据年份',
              width: 100,
              render: (_: unknown, r) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.band.market_source_year ?? '—'}</span>,
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>外部竞争性规则</b>：调薪建议生成时，员工薪酬分位由本表分段线性插值得出；分位 ≥ 75% 触发停涨（STOP），确保薪酬包竞争而不冒进。
          市场分位在「等级工资表」中按职级维护（租户覆盖），历史版本留痕可回溯。
        </div>
      </Card>
    </div>
  );
}
