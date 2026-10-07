import { useEffect, useState } from 'react';
import { Card, Col, Progress, Row, Table, Tag, message } from 'antd';
import { successionApi, READINESS_META, type MapPositionOut } from '@/api/succession';

const RISK_TAG: Record<string, { label: string; color: string; bg: string }> = {
  HIGH: { label: '高风险', color: 'var(--danger)', bg: 'var(--clay-soft)' },
  MID: { label: '中风险', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  LOW: { label: '低风险', color: 'var(--sage)', bg: 'var(--sage-soft)' },
};

function ReadinessTags({ row }: { row: MapPositionOut }) {
  const items = [
    { key: 'ready_now', n: row.ready_now },
    { key: 'ready_1_2y', n: row.ready_1_2y },
    { key: 'ready_3y', n: row.ready_3y },
    { key: 'unassessed', n: row.unassessed },
  ].filter((x) => x.n > 0);
  if (items.length === 0) return <span style={{ color: 'var(--ink-4)' }}>无候选</span>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((x) => {
        const meta = READINESS_META[x.key];
        return (
          <Tag
            key={x.key}
            style={{
              borderRadius: 6,
              background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
              color: meta.color,
              borderColor: 'transparent',
            }}
          >
            <span className="num" style={{ fontWeight: 700 }}>{x.n}</span> {meta.label}
          </Tag>
        );
      })}
    </div>
  );
}

export function SuccessionMap() {
  const [map, setMap] = useState<Awaited<ReturnType<typeof successionApi.successionMap>> | null>(null);

  useEffect(() => {
    successionApi
      .successionMap()
      .then(setMap)
      .catch(() => message.error('加载继任地图失败'));
  }, []);

  if (!map) {
    return (
      <div className="page" style={{ maxWidth: 1300 }}>
        <Card loading style={{ minHeight: 300 }} />
      </div>
    );
  }

  const { summary } = map;

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">继任地图</h1>
          <div className="page-subtitle">
            核心岗位 × 就绪度三档（Ready Now → P-L1 · 1–2 年 → P-L2 · 3 年+ → P-L3）· 聚合视图不含个人明细
          </div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>核心岗位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{summary.positions}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Ready Now 覆盖</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>
              {summary.ready_now_positions}
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>
                {' '}/ {summary.positions}
              </span>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>无后备岗位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>
              {summary.no_backup_positions}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>空缺岗位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>
              {summary.vacant_positions}
            </div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="岗位继任就绪度总览">
        <Table
          rowKey={(r) => r.position_id}
          dataSource={map.positions}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '岗位',
              render: (_, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {r.dept_name ?? '—'} · {r.grade}
                  </div>
                </div>
              ),
            },
            {
              title: '在岗人',
              width: 120,
              render: (_, r) =>
                r.incumbent_name ? (
                  r.incumbent_name
                ) : (
                  <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--danger)', borderColor: 'transparent' }}>空缺</Tag>
                ),
            },
            { title: '编制', width: 70, render: (_, r) => <span className="num">{r.headcount}</span> },
            {
              title: '就绪度分布',
              width: 320,
              render: (_, r) => <ReadinessTags row={r} />,
            },
            {
              title: '覆盖率',
              width: 120,
              render: (_, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={r.coverage} size="small" strokeColor={r.coverage >= 100 ? 'var(--sage)' : 'var(--ochre)'} showInfo={false} style={{ width: 70 }} />
                  <span className="num" style={{ fontSize: 12 }}>{r.coverage}%</span>
                </div>
              ),
            },
            {
              title: '风险',
              width: 90,
              render: (_, r) => {
                const t = RISK_TAG[r.risk] ?? RISK_TAG.LOW;
                return (
                  <Tag style={{ borderRadius: 6, background: t.bg, color: t.color, borderColor: 'transparent' }}>
                    {t.label}
                  </Tag>
                );
              },
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>就绪度口径</b>：就绪度来自统一人岗匹配引擎（五要素加权），Ready Now（≥ 匹配良好阈值）→ P-L1 核心继任；
          1–2 年（≥ 错位预警阈值）→ P-L2 重点培养；3 年+（低于预警阈值但可算）→ P-L3 潜力储备。
          无画像数据不计入分母、不造分。高风险岗位（无 Ready Now 候选）建议启动「继任地图 → 智能推荐 → 意愿确认」闭环。
        </div>
      </Card>
    </div>
  );
}
