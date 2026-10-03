import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Modal, Row, Select, Space, Statistic, Tag, Typography, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { inventoryApi, type BatchOut, type ResultOut } from '@/api/inventory';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { GRID_CELLS, GRID_DIM_PAIRS, type GridCell } from '@/mock/inventory';

const { Text, Paragraph } = Typography;

export function NineGrid() {
  const [params] = useSearchParams();
  const paramBatchId = params.get('id') ?? '';
  const [dimPair, setDimPair] = useState<string>('perf_potential');
  const [activeCell, setActiveCell] = useState<GridCell | null>(null);
  const [results, setResults] = useState<ResultOut[]>([]);
  const [emps, setEmps] = useState<Map<string, EmployeeDirectoryItem>>(new Map());
  const [batches, setBatches] = useState<BatchOut[]>([]);
  const [batchId, setBatchId] = useState<string>(paramBatchId);

  // 无 id 时自动选择：优先已发布，其次校准中
  useEffect(() => {
    inventoryApi
      .list()
      .then((list) => {
        setBatches(list);
        if (!batchId) {
          setBatchId(
            list.find((b) => b.status === 'PUBLISHED')?.id ??
              list.find((b) => b.status === 'CALIBRATING')?.id ??
              list[0]?.id ??
              '',
          );
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部链接带 id 进入时同步（容器内 Link 跳转）
  useEffect(() => {
    if (paramBatchId) setBatchId(paramBatchId);
  }, [paramBatchId]);

  useEffect(() => {
    employeesApi
      .list()
      .then((dir) => setEmps(new Map(dir.map((e) => [e.id, e]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!batchId) {
      setResults([]);
      return;
    }
    inventoryApi
      .results(batchId)
      .then(setResults)
      .catch(() => message.error('加载九宫格数据失败'));
  }, [batchId]);

  const dist = useMemo(() => {
    const m = new Map<string, ResultOut[]>();
    for (const c of GRID_CELLS) m.set(c.code, []);
    for (const r of results) {
      if (r.grid_code) m.get(r.grid_code)?.push(r);
    }
    return m;
  }, [results]);

  const highHigh = (dist.get('9A1')?.length ?? 0) + (dist.get('9B1')?.length ?? 0);
  const lowLow = (dist.get('9C3')?.length ?? 0) + (dist.get('9B3')?.length ?? 0);
  const starPct = results.length ? Math.round((highHigh / results.length) * 100) : 0;

  const cellResults = (code: string) => dist.get(code) ?? [];
  const empOf = (id: string) => emps.get(id);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">九宫格人才看板</h1>
          <div className="page-subtitle">业绩 × 潜力/能力 交叉定位，支撑差异化策略</div>
        </div>
        <Space>
          <Select
            value={batchId || undefined}
            onChange={setBatchId}
            style={{ width: 240 }}
            showSearch
            optionFilterProp="label"
            placeholder="选择盘点批次"
            options={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
          <Select
            value={dimPair}
            onChange={setDimPair}
            style={{ width: 160 }}
            options={GRID_DIM_PAIRS.map((d) => ({ value: d.key, label: d.label }))}
          />
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="盘点总人数" value={results.length} valueStyle={{ color: 'var(--clay)' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="高潜/明星占比" value={starPct} suffix="%" valueStyle={{ color: 'var(--sage)' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="待改进人数" value={lowLow} valueStyle={{ color: 'var(--ochre)' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="已定位" value={results.filter((r) => r.located).length} suffix={`/ ${results.length} 人`} valueStyle={{ color: 'var(--teal)' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px 8px', fontSize: 12, color: 'var(--ink-3)' }}>
              <span>← 潜力高</span>
              <span>潜力低 →</span>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 4px', fontSize: 12, color: 'var(--ink-3)', writingMode: 'vertical-rl' }}>
                <span>业绩高</span>
                <span>业绩低</span>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 8, aspectRatio: '3 / 2' }}>
                {GRID_CELLS.map((c) => {
                  const list = cellResults(c.code);
                  const isHot = list.length >= 3;
                  return (
                    <div
                      key={c.code}
                      onClick={() => setActiveCell(c)}
                      style={{
                        borderRadius: 12, padding: 12,
                        background: c.color + (isHot ? '33' : '1a'),
                        border: `1px solid ${c.color}55`,
                        cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between', transition: 'transform .15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div>
                        <Space>
                          <span className="num" style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.code}</span>
                          <Tag style={{ background: c.color, color: '#fff', borderColor: 'transparent', borderRadius: 6, margin: 0 }}>{c.label}</Tag>
                        </Space>
                        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, color: c.color }}>{list.length}</div>
                      </div>
                      <div style={{ display: 'flex', gap: -4, flexWrap: 'wrap' }}>
                        {list.slice(0, 5).map((r) => {
                          const e = empOf(r.employee_id);
                          return (
                            <div key={r.id} title={e?.name} style={{
                              width: 22, height: 22, borderRadius: '50%', background: c.color, color: '#fff',
                              fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              border: '2px solid var(--surface)', marginLeft: -4,
                            }}>{e?.name?.[0] ?? '?'}</div>
                          );
                        })}
                        {list.length > 5 && <span style={{ fontSize: 11, color: c.color, alignSelf: 'center' }}>+{list.length - 5}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="九宫格策略速览" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {GRID_CELLS.map((c) => (
                <div key={c.code} onClick={() => setActiveCell(c)} style={{ cursor: 'pointer', padding: 8, borderRadius: 8, background: 'var(--surface-sunken)' }}>
                  <Space>
                    <span className="num" style={{ color: c.color, fontWeight: 700 }}>{c.code}</span>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <Tag style={{ borderRadius: 6, marginInlineStart: 'auto', background: c.color + '22', color: c.color, borderColor: 'transparent' }}>{cellResults(c.code).length} 人</Tag>
                  </Space>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{c.strategy}</div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal open={!!activeCell} onCancel={() => setActiveCell(null)} footer={null} width={640} title={activeCell ? `${activeCell.code} · ${activeCell.label}` : ''}>
        {activeCell && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={activeCell.strategy} style={{ background: activeCell.color + '18', border: 'none' }} />
            {cellResults(activeCell.code).map((r) => {
              const e = empOf(r.employee_id);
              return (
                <Card key={r.id} size="small" variant="borderless" style={{ background: 'var(--surface-sunken)' }}>
                  <Space size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <span style={{ width: 32, height: 32, borderRadius: '50%', background: activeCell.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{e?.name?.[0] ?? '?'}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{e?.name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e?.position ?? '—'}</div>
                      </div>
                    </Space>
                    <Space size={10}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>绩效</div>
                        <div className="num" style={{ fontWeight: 700, color: 'var(--clay)' }}>{r.perf_label ?? '—'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>能力</div>
                        <div className="num" style={{ fontWeight: 700, color: 'var(--teal)' }}>{r.ability_score ?? '—'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>潜力</div>
                        <div className="num" style={{ fontWeight: 700, color: 'var(--ochre)' }}>{r.potential ?? '—'}</div>
                      </div>
                    </Space>
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}
      </Modal>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} size="small" title="盘点结论">
        <Paragraph style={{ marginBottom: 0 }}>
          本期盘点 <Text strong>{results.length}</Text> 人，明星与高潜合计 <Text strong style={{ color: 'var(--sage)' }}>{highHigh} 人（{starPct}%）</Text>，
          构成核心人才池；待改进区 <Text strong style={{ color: 'var(--ochre)' }}>{lowLow} 人</Text>，建议结合绩效改进计划与 IDP 推进。
          校准由业务部门主导，HR 提供画像数据支撑，高管最终确认九宫格定位与人才结构图。
        </Paragraph>
      </Card>
    </div>
  );
}
