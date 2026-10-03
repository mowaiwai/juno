import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Select, Space, Spin, Tag, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { orgApi, type DepartmentItem } from '@/api/org';
import { inventoryApi, type BatchOut, type ResultOut } from '@/api/inventory';
import { GRID_CELLS } from '@/mock/inventory';

const { Paragraph } = Typography;

export function GridStrategy() {
  const [params] = useSearchParams();
  const paramId = params.get('id') ?? '';

  const [batches, setBatches] = useState<BatchOut[] | null>(null);
  const [batchId, setBatchId] = useState<string>(paramId);
  const [results, setResults] = useState<ResultOut[] | null>(null);
  const [emps, setEmps] = useState<Map<string, EmployeeDirectoryItem>>(new Map());
  const [depts, setDepts] = useState<Map<string, DepartmentItem>>(new Map());

  // 批次目录（无 id 时默认取首个，优先校准中批次）
  useEffect(() => {
    inventoryApi
      .list()
      .then((list) => {
        setBatches(list);
        if (!batchId) {
          setBatchId(list.find((b) => b.status === 'CALIBRATING')?.id ?? list[0]?.id ?? '');
        }
      })
      .catch(() => setBatches([]));
  }, []);

  useEffect(() => {
    Promise.all([employeesApi.list(), orgApi.departments()])
      .then(([list, d]) => {
        setEmps(new Map(list.map((e) => [e.id, e])));
        setDepts(new Map(d.map((x) => [x.id, x])));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!batchId) {
      setResults([]);
      return;
    }
    setResults(null);
    inventoryApi.results(batchId).then(setResults).catch(() => setResults([]));
  }, [batchId]);

  const batch = batches?.find((b) => b.id === batchId);

  const dist = useMemo(() => {
    const m = new Map<string, ResultOut[]>();
    for (const c of GRID_CELLS) m.set(c.code, []);
    for (const r of results ?? []) {
      if (r.grid_code) m.get(r.grid_code)?.push(r);
    }
    return m;
  }, [results]);

  const empDesc = (e: EmployeeDirectoryItem) =>
    `${e.position} · ${depts.get(e.dept_id)?.name ?? ''}`;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">差异化策略</h1>
          <div className="page-subtitle">
            {batch ? `${batch.name} · ` : ''}基于九宫格定位的人才策略建议，覆盖培养、激励、改进、退出四类动作
          </div>
        </div>
        {batches && batches.length > 0 && (
          <Select
            value={batchId || undefined}
            onChange={setBatchId}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            options={batches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </div>

      {results === null ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {GRID_CELLS.map((c) => {
              const list = dist.get(c.code) ?? [];
              const isEmpty = list.length === 0;
              return (
                <Col span={8} key={c.code}>
                  <Card
                    variant="borderless"
                    style={{ background: 'var(--surface)', borderTop: `3px solid ${c.color}`, opacity: isEmpty ? 0.55 : 1 }}
                    size="small"
                    title={
                      <Space>
                        <span className="num" style={{ color: c.color, fontWeight: 700 }}>{c.code}</span>
                        <span style={{ fontWeight: 700 }}>{c.label}</span>
                        <Tag style={{ background: c.color + '22', color: c.color, borderColor: 'transparent', borderRadius: 6, marginInlineStart: 8 }}>{list.length} 人</Tag>
                      </Space>
                    }
                  >
                    <Paragraph style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>{c.strategy}</Paragraph>
                    {isEmpty ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>本格暂无员工</div>
                    ) : (
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        {list.map((r) => {
                          const e = emps.get(r.employee_id);
                          return (
                            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-sunken)' }}>
                              <span style={{ fontWeight: 600 }}>{e?.name ?? '—'}</span>
                              <span style={{ color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {e ? empDesc(e) : ''}
                              </span>
                            </div>
                          );
                        })}
                      </Space>
                    )}
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="策略执行说明" size="small">
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
              <li><b>重点培养区（9A1/9B1）</b>：纳入高潜池，配导师、给核心项目、加速晋升通道，每季度复盘。</li>
              <li><b>保留激励区（9A2/9A3）</b>：调薪倾斜、关键岗位匹配、避免职业倦怠，关注流失风险。</li>
              <li><b>培养辅导区（9B1/9C1）</b>：IDP 聚焦短板，配辅导人，3-6 个月观察期。</li>
              <li><b>绩效改进区（9B3/9C2/9C3）</b>：启动 PIP，设明确目标与周期，不行则转岗/降级/退出。</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
