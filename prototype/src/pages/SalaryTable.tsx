import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Table, Tabs, Tag, Spin } from 'antd';
import { orgApi, type ChannelFamily, type GradeBand } from '@/api/org';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

export function SalaryTable() {
  const [channels, setChannels] = useState<ChannelFamily[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [seq, setSeq] = useState<string>('');

  useEffect(() => {
    orgApi.channels().then((chs) => {
      setChannels(chs);
      if (chs.length) setSeq(chs[0].sequences[0] ?? chs[0].family);
      setLoading(false);
    });
  }, []);

  const rows = useMemo<GradeBand[]>(() => {
    if (!channels) return [];
    const ch = channels.find((c) => c.sequences.includes(seq)) ?? channels[0];
    return ch ? ch.grades : [];
  }, [channels, seq]);

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
          <h1 className="page-title font-serif">等级工资表</h1>
          <div className="page-subtitle">市场分位锚定带宽 · 渗透率监控 · 75 分位停涨</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>
          已生效
        </Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖职级</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
              {channels.reduce((s, c) => s + c.grades.length, 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>停涨分位</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>P75</div>
          </Card>
        </Col>
        <Col span={12}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>序列</div>
            <Tabs
              activeKey={seq}
              onChange={setSeq}
              size="small"
              items={channels.map((c) => ({
                key: c.sequences[0] ?? c.family,
                label: c.name,
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Table
          rowKey={(r) => r.grade}
          dataSource={rows}
          pagination={false}
          size="middle"
          columns={[
            { title: '职级', width: 90, render: (_, r) => <span style={{ fontWeight: 700 }}>{r.grade}</span> },
            { title: '名称', width: 120, render: (_, r) => r.title },
            {
              title: '带宽（月基本工资）',
              render: (_, r) => (
                <span className="num" style={{ fontWeight: 600 }}>
                  {fmt(r.salary_band[0])} — {fmt(r.salary_band[1])}
                </span>
              ),
            },
            { title: '带宽比', width: 90, render: (_, r) => <span className="num">{(r.salary_band[1] / r.salary_band[0]).toFixed(2)}</span> },
            {
              title: '市场 P25',
              width: 110,
              render: (_, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{r.p25 != null ? fmt(r.p25) : '—'}</span>,
            },
            {
              title: '市场 P50',
              width: 110,
              render: (_, r) => <span className="num" style={{ color: 'var(--ink-2)' }}>{r.p50 != null ? fmt(r.p50) : '—'}</span>,
            },
            {
              title: '市场 P75（停涨线）',
              width: 140,
              render: (_, r) => <span className="num" style={{ color: 'var(--danger)' }}>{r.p75 != null ? fmt(r.p75) : '—'}</span>,
            },
            {
              title: '市场 P90',
              width: 110,
              render: (_, r) => <span className="num">{r.p90 != null ? fmt(r.p90) : '—'}</span>,
            },
            {
              title: '数据年份',
              width: 90,
              render: (_, r) => r.market_source_year ?? '—',
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>规则说明</b>：带宽以市场 P50 锚定；渗透率 ≥ P75 触发停涨；D 等 + PIP 不通过自动降薪。
        </div>
      </Card>
    </div>
  );
}
