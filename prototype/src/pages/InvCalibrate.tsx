import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Row, Space, Table, Tag, Tooltip, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { latestProfile } from '@/mock/profiles';
import { GRID_CELLS, batchById, resultsOfBatch } from '@/mock/inventory';
import { RadarChart } from '@/components/RadarChart';

export function InvCalibrate() {
  const [params] = useSearchParams();
  const batch = batchById(params.get('id') ?? 'inv_2026_h1');
  const [selected, setSelected] = useState<string>(employees[0].id);
  const [calibrated, setCalibrated] = useState<Record<string, { grid: string; note: string }>>({});

  const results = useMemo(() => (batch ? resultsOfBatch(batch.id) : []), [batch]);

  const current = results.find((r) => r.employeeId === selected);
  const emp = employees.find((e) => e.id === selected);
  const profile = emp ? latestProfile(emp.id) : null;

  const applyCalibration = (grid: string) => {
    setCalibrated((p) => ({ ...p, [selected]: { grid, note: p[selected]?.note ?? '' } }));
    message.success(`已将 ${emp?.name} 校准至 ${grid}`);
  };

  return (
    <div className="page" style={{ maxWidth: 1440 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">初排与校准</h1>
          <div className="page-subtitle">{batch?.name} · 画像引擎已汇聚绩效/认证/测评生成初排，业务部门可调整定位</div>
        </div>
        <Space>
          <Tag style={{ background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent', borderRadius: 6 }}>
            初排 {results.length} 人
          </Tag>
          <Tag style={{ background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', borderRadius: 6 }}>
            已校准 {Object.keys(calibrated).length} 人
          </Tag>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="员工初排列表">
            <Table
              rowKey="employeeId"
              dataSource={results}
              size="small"
              pagination={{ pageSize: 8 }}
              onRow={(r) => ({ onClick: () => setSelected(r.employeeId), style: { cursor: 'pointer', background: selected === r.employeeId ? 'var(--surface-sunken)' : undefined } })}
              columns={[
                { title: '员工', render: (_: unknown, r) => {
                  const e = employees.find((x) => x.id === r.employeeId)!;
                  return (
                    <Space>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--clay-soft)', color: 'var(--clay)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{e.name[0]}</span>
                      <span style={{ fontWeight: 600 }}>{e.name}</span>
                    </Space>
                  );
                }},
                { title: '部门', render: (_: unknown, r) => deptName(employees.find((e) => e.id === r.employeeId)!.deptId) },
                { title: '业绩', dataIndex: 'perfScore', render: (v: number) => <span className="num">{v}</span> },
                { title: '能力', dataIndex: 'abilityScore', render: (v: number) => <span className="num">{v}</span> },
                { title: '潜力', dataIndex: 'potentialScore', render: (v: number) => <span className="num">{v}</span> },
                {
                  title: '初排',
                  dataIndex: 'grid',
                  render: (g: string, r) => {
                    const c = calibrated[r.employeeId];
                    return (
                      <Space>
                        <Tag style={{ background: GRID_CELLS.find((x) => x.code === g)?.color + '22', color: GRID_CELLS.find((x) => x.code === g)?.color, borderColor: 'transparent', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>{g}</Tag>
                        {c && <Tag color="green" style={{ borderRadius: 6 }}>已校准</Tag>}
                      </Space>
                    );
                  },
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            size="small"
            title={emp ? `${emp.name} · ${emp.position}` : '未选择'}
            extra={<span className="ai-badge">AI 校准建议</span>}
          >
            {!current || !emp || !profile ? (
              <Empty />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={8}>
                  {[
                    { label: '业绩', value: current.perfScore, color: 'var(--clay)' },
                    { label: '能力', value: current.abilityScore, color: 'var(--teal)' },
                    { label: '潜力', value: current.potentialScore, color: 'var(--ochre)' },
                  ].map((d) => (
                    <Col span={8} key={d.label}>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{d.label}</div>
                      <div className="num" style={{ fontSize: 22, fontWeight: 700, color: d.color }}>{d.value}</div>
                    </Col>
                  ))}
                </Row>

                <RadarChart
                  height={220}
                  series={[
                    {
                      name: emp.name,
                      values: [
                        profile.dims.basic.score,
                        profile.dims.biz.score,
                        profile.dims.contribution.score,
                        profile.dims.duty.score,
                        profile.dims.knowledge.score,
                        profile.dims.ability.score,
                        profile.dims.perf.score,
                      ],
                      color: 'var(--clay)',
                    },
                  ]}
                />

                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                    当前定位 <Tag style={{ color: GRID_CELLS.find((c) => c.code === current.grid)?.color, borderColor: 'transparent', background: GRID_CELLS.find((c) => c.code === current.grid)?.color + '22', borderRadius: 6 }}>{current.grid} · {GRID_CELLS.find((c) => c.code === current.grid)?.label}</Tag>
                    {calibrated[selected] && <> → 校准为 <Tag color="green" style={{ borderRadius: 6 }}>{calibrated[selected].grid}</Tag></>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {GRID_CELLS.map((c) => {
                      const isCur = (calibrated[selected]?.grid ?? current.grid) === c.code;
                      return (
                        <Tooltip key={c.code} title={`${c.label} · ${c.strategy}`}>
                          <Button
                            block
                            size="small"
                            style={{
                              borderRadius: 8,
                              background: isCur ? c.color : 'transparent',
                              color: isCur ? '#fff' : 'var(--ink-2)',
                              borderColor: isCur ? c.color : 'var(--line)',
                              fontSize: 11,
                              padding: '4px 0',
                            }}
                            onClick={() => applyCalibration(c.code)}
                          >
                            {c.code}<br />{c.label}
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <Input.TextArea
                  rows={2}
                  placeholder="校准理由（必填，将与九宫格定位一同提交高管确认）"
                  value={calibrated[selected]?.note ?? ''}
                  onChange={(e) =>
                    setCalibrated((p) => ({
                      ...p,
                      [selected]: { grid: p[selected]?.grid ?? current.grid, note: e.target.value },
                    }))
                  }
                />

                <Alert
                  type="info"
                  showIcon
                  style={{ background: 'var(--teal-soft)', border: 'none', fontSize: 12 }}
                  message="AI 建议：能力与潜力双高但业绩未达预期，建议保留在「潜力股」区并配合 IDP 补业绩短板。"
                />

                <Space>
                  <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.success('校准结果已提交高管确认')}>提交校准</Button>
                  <Button icon={<ThunderboltOutlined />} onClick={() => message.warning('争议已升级至高管裁决')}>升级争议</Button>
                </Space>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
