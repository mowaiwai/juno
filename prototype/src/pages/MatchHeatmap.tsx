import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Progress, Row, Segmented, Select, Space, Spin, Table, Tag, message } from 'antd';
import { matchApi, DIM_LABEL, LEVEL_LABEL, LEVEL_COLOR, type HeatmapRowOut } from '@/api/match';
import { orgApi, type DepartmentItem } from '@/api/org';
import { inventoryApi, type BatchOut } from '@/api/inventory';

type ScopeKind = 'dept' | 'batch';

export function MatchHeatmap() {
  const [scopeKind, setScopeKind] = useState<ScopeKind>('dept');
  const [deptId, setDeptId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [batches, setBatches] = useState<BatchOut[]>([]);
  const [rows, setRows] = useState<HeatmapRowOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    orgApi.departments()
      .then((list) => {
        setDepts(list);
        const first = list.find((d) => d.parent_id !== '0');
        if (first && !deptId) setDeptId(first.id);
      })
      .catch(() => message.error('加载部门失败'));
    inventoryApi.list()
      .then(setBatches)
      .catch(() => message.error('加载盘点批次失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const body = scopeKind === 'dept'
      ? (deptId ? { dept_id: deptId } : null)
      : (batchId ? { batch_id: batchId } : null);
    if (!body) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    matchApi.heatmap(body)
      .then(setRows)
      .catch((e) => {
        setRows([]);
        setError(e?.message ?? '加载匹配热力图失败');
      })
      .finally(() => setLoading(false));
  }, [scopeKind, deptId, batchId]);

  const stats = useMemo(() => {
    const count = (lv: string) => rows.filter((r) => r.level === lv).length;
    return {
      total: rows.length,
      good: count('good'),
      watch: count('watch'),
      mismatch: count('mismatch'),
      insufficient: count('insufficient_data'),
    };
  }, [rows]);

  const deptOptions = depts.filter((d) => d.parent_id !== '0').map((d) => ({ value: d.id, label: d.name }));
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.name }));

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">差距热力图</h1>
          <div className="page-subtitle">五要素加权匹配分 · 按部门或盘点批次逐人透视人岗匹配</div>
        </div>
        <Space size={12}>
          <Segmented
            value={scopeKind}
            onChange={(v) => setScopeKind(v as ScopeKind)}
            options={[
              { value: 'dept', label: '按部门' },
              { value: 'batch', label: '按盘点批次' },
            ]}
          />
          {scopeKind === 'dept' ? (
            <Select
              value={deptId || undefined}
              onChange={setDeptId}
              style={{ width: 240 }}
              placeholder="选择部门"
              options={deptOptions}
            />
          ) : (
            <Select
              value={batchId || undefined}
              onChange={setBatchId}
              style={{ width: 240 }}
              placeholder="选择盘点批次"
              options={batchOptions}
            />
          )}
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {([
          ['覆盖员工', stats.total, 'var(--clay)'],
          [LEVEL_LABEL.good, stats.good, LEVEL_COLOR.good],
          [LEVEL_LABEL.watch, stats.watch, LEVEL_COLOR.watch],
          [LEVEL_LABEL.mismatch, stats.mismatch, LEVEL_COLOR.mismatch],
          [LEVEL_LABEL.insufficient_data, stats.insufficient, LEVEL_COLOR.insufficient_data],
        ] as [string, number, string][]).map(([label, value, color]) => (
          <Col flex={1} key={label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="逐人匹配明细" size="small">
        <Spin spinning={loading}>
          {error ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>{error}</div>
          ) : (
            <Table<HeatmapRowOut>
              rowKey="employee_id"
              dataSource={rows}
              pagination={{ pageSize: 10 }}
              expandable={{
                expandedRowRender: (r) => (
                  <Space direction="vertical" size={8} style={{ width: '100%', padding: '4px 8px' }}>
                    {r.dims.map((d) => (
                      <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 72, fontSize: 13, color: 'var(--ink-2)' }}>
                          {DIM_LABEL[d.key as keyof typeof DIM_LABEL] ?? d.key}
                        </span>
                        <Progress
                          percent={Math.round((d.ratio ?? 0) * 100)}
                          size="small"
                          style={{ flex: 1, maxWidth: 420 }}
                          strokeColor={d.is_gap ? 'var(--danger)' : 'var(--sage)'}
                          format={() => (
                            <span className="num" style={{ fontSize: 12, color: d.is_gap ? 'var(--danger)' : 'var(--ink-2)' }}>
                              {d.actual ?? '—'} / {d.required ?? '—'}
                            </span>
                          )}
                        />
                        {d.is_gap && <Tag color="red" style={{ borderRadius: 6 }}>差距</Tag>}
                      </div>
                    ))}
                    {r.reason && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.reason}</div>}
                  </Space>
                ),
              }}
              columns={[
                {
                  title: '员工',
                  render: (_, r) => (
                    <Space>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--clay-soft)', color: 'var(--clay)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        {r.name[0]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position ?? '—'}</div>
                      </div>
                    </Space>
                  ),
                },
                {
                  title: '匹配分',
                  dataIndex: 'score',
                  sorter: (a, b) => (a.score ?? -1) - (b.score ?? -1),
                  render: (v: number | null) => (
                    <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>
                      {v === null ? '—' : v.toFixed(1)}
                    </span>
                  ),
                },
                {
                  title: '等级',
                  dataIndex: 'level',
                  filters: Object.entries(LEVEL_LABEL).map(([value, label]) => ({ value, text: label })),
                  onFilter: (v, r) => r.level === v,
                  render: (lv: string) => (
                    <Tag style={{ borderRadius: 6, background: `${LEVEL_COLOR[lv]}22`, color: LEVEL_COLOR[lv], borderColor: 'transparent' }}>
                      {LEVEL_LABEL[lv] ?? lv}
                    </Tag>
                  ),
                },
                {
                  title: '缺失维度',
                  dataIndex: 'missing_dims',
                  render: (dims: string[]) =>
                    dims.length ? (
                      <Space size={4} wrap>
                        {dims.map((d) => (
                          <Tag key={d} style={{ borderRadius: 6 }}>{DIM_LABEL[d as keyof typeof DIM_LABEL] ?? d}</Tag>
                        ))}
                      </Space>
                    ) : '—',
                },
              ]}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
}
