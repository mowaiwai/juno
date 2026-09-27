import { useMemo, useState } from 'react';
import { Card, Col, Empty, Row, Select, Space, Table, Tag } from 'antd';
import { useDataScope } from '@/store/auth';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { DIMENSION_NAME, PROFILE_DIMENSIONS, profileVersions } from '@/mock/profiles';
import { RadarChart } from '@/components/RadarChart';

export function ProfileCompare() {
  const scope = useDataScope();
  const team = scope(allEmployees);
  /** 优先展示有多版本画像的员工 */
  const multi = useMemo(() => team.filter((e) => profileVersions(e.id).length >= 2), [team]);
  const [empId, setEmpId] = useState<string | undefined>(multi[0]?.id);
  const emp = team.find((e) => e.id === empId) ?? multi[0];
  const versions = emp ? profileVersions(emp.id) : [];

  const a = versions[versions.length - 2];
  const b = versions[versions.length - 1];

  if (!emp || !a || !b) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Empty description="数据范围内暂无含多版本画像的员工（对比需要至少两个画像周期）" />
      </div>
    );
  }

  const deltaRows = PROFILE_DIMENSIONS.map((dim) => ({
    key: dim.key,
    name: DIMENSION_NAME[dim.key],
    before: a.dims[dim.key],
    after: b.dims[dim.key],
    delta: b.dims[dim.key].score - a.dims[dim.key].score,
  }));

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">画像版本对比</h1>
          <div className="page-subtitle">跨周期对比七维变化，回看发展动作与认证回写的效果</div>
        </div>
        <Select
          value={emp.id}
          onChange={setEmpId}
          style={{ width: 280 }}
          options={multi.map((e) => ({ value: e.id, label: `${e.name} · ${e.grade} · ${deptName(e.deptId)}` }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={13}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={
              <Space>
                <b style={{ fontSize: 15 }}>{emp.name}</b>
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{deptName(emp.deptId)} · {emp.position} · {emp.grade}</span>
              </Space>
            }
          >
            <RadarChart
              height={320}
              series={[
                { name: a.version, values: PROFILE_DIMENSIONS.map((d) => a.dims[d.key].score), color: '#7fa09b' },
                { name: b.version, values: PROFILE_DIMENSIONS.map((d) => b.dims[d.key].score), color: '#d97757' },
              ]}
            />
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
              {a.version}（{a.generatedAt} · {a.source}）→ {b.version}（{b.generatedAt} · {b.source}）· 综合 {a.overall} → {b.overall}
            </div>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="变化归因（AI · 可溯源）" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {deltaRows
                .filter((r) => r.delta !== 0)
                .sort((x, y) => y.delta - x.delta)
                .map((r) => (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: r.delta > 0 ? 'var(--sage-soft)' : 'var(--danger-soft)', color: r.delta > 0 ? 'var(--sage)' : 'var(--danger)', minWidth: 44, textAlign: 'center' }}>
                      {r.delta > 0 ? '+' : ''}
                      {r.delta}
                    </Tag>
                    <b style={{ width: 64 }}>{r.name}</b>
                    <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{r.after.note}</span>
                  </div>
                ))}
              <div style={{ fontSize: 12, color: 'var(--ink-4)', paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
                归因依据：认证回写记录 / 绩效中心 / IDP 完成记录 · AI 结论可反查数据来源。
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={11}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="逐维对比" size="small">
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={deltaRows}
              columns={[
                { title: '维度', dataIndex: 'name', width: 80, render: (v: string) => <b style={{ fontSize: 13 }}>{v}</b> },
                {
                  title: a.version,
                  width: 70,
                  align: 'right',
                  render: (_: unknown, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{r.before.score}</span>,
                },
                {
                  title: b.version,
                  width: 70,
                  align: 'right',
                  render: (_: unknown, r) => <span className="num" style={{ fontWeight: 700 }}>{r.after.score}</span>,
                },
                {
                  title: '变化',
                  width: 60,
                  align: 'right',
                  render: (_: unknown, r) => (
                    <span className="num" style={{ fontWeight: 700, color: r.delta > 0 ? 'var(--sage)' : r.delta < 0 ? 'var(--danger)' : 'var(--ink-4)' }}>
                      {r.delta > 0 ? '+' : ''}
                      {r.delta}
                    </span>
                  ),
                },
                {
                  title: '评级变化',
                  render: (_: unknown, r) =>
                    r.before.grade === r.after.grade ? (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.after.grade}</span>
                    ) : (
                      <Space size={4}>
                        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{r.before.grade}</span>
                        <span style={{ color: 'var(--ink-4)' }}>→</span>
                        <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'transparent', background: 'var(--sage-soft)', color: 'var(--sage)' }}>{r.after.grade}</Tag>
                      </Space>
                    ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
