import { useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Row, Space, Table, Tag } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useDataScope } from '@/store/auth';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { DIMENSION_NAME, PROFILE_DIMENSIONS, latestProfile, profileVersions } from '@/mock/profiles';
import { bandOf } from '@/mock/channels';
import { MaskedField } from '@/components/MaskedField';
import { RadarChart } from '@/components/RadarChart';

const GRADE_COLOR: Record<string, string> = {
  优: 'var(--sage)',
  良: 'var(--teal)',
  达标: 'var(--ochre)',
  待改进: 'var(--danger)',
};

export function TalentProfile() {
  const scope = useDataScope();
  const team = scope(allEmployees);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const filtered = useMemo(
    () =>
      team.filter(
        (e) => e.name.includes(keyword) || e.id.includes(keyword.toUpperCase()) || e.position.includes(keyword),
      ),
    [team, keyword],
  );

  const emp = filtered.find((e) => e.id === selectedId) ?? filtered[0];
  const profile = emp ? latestProfile(emp.id) : undefined;
  const versions = emp ? profileVersions(emp.id) : [];

  return (
    <div className="page" style={{ maxWidth: 1360 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">七维人才画像</h1>
          <div className="page-subtitle">
            基本条件 / 业绩 / 团队贡献 / 职责履行 / 知识技能 / 能力素质 / 绩效 · 按周期生成、认证回写、版本可追溯
          </div>
        </div>
      </div>

      <Row gutter={16}>
        {/* 左：人员列表（数据范围内） */}
        <Col span={7}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`人员（数据范围 ${team.length} 人）`}
            size="small"
          >
            <Input
              size="small"
              prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
              placeholder="搜索姓名 / 工号 / 岗位"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              style={{ marginBottom: 10 }}
            />
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {filtered.map((e) => {
                const p = latestProfile(e.id);
                const active = emp?.id === e.id;
                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      marginBottom: 4,
                      border: active ? '1px solid var(--clay)' : '1px solid transparent',
                      background: active ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                    }}
                  >
                    <div
                      style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
                        background: 'var(--surface)', color: 'var(--clay-hover)',
                      }}
                    >
                      {e.name.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {e.name} <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{e.grade} · {e.position}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{deptName(e.deptId)} · {p.version}</div>
                    </div>
                    <span className="num" style={{ fontSize: 15, fontWeight: 700, color: p.overall >= 80 ? 'var(--sage)' : p.overall >= 65 ? 'var(--ochre)' : 'var(--danger)' }}>
                      {p.overall}
                    </span>
                  </div>
                );
              })}
              {filtered.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="范围内无匹配员工" />}
            </div>
          </Card>
        </Col>

        {/* 右：画像详情 */}
        <Col span={17}>
          {!emp || !profile ? (
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <Empty description="选择左侧员工查看画像" />
            </Card>
          ) : (
            <>
              <Card
                variant="borderless"
                style={{ background: 'var(--surface)', marginBottom: 16 }}
                title={
                  <Space>
                    <UserOutlined style={{ color: 'var(--clay)' }} />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{emp.name}</span>
                    <Tag style={{ borderRadius: 6 }}>{emp.id}</Tag>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {deptName(emp.deptId)} · {emp.position} · {emp.family}-{emp.grade}
                    </span>
                  </Space>
                }
                extra={
                  <Space size={6}>
                    {versions.length > 1 && <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'var(--line)' }}>含 {versions.length} 个版本</Tag>}
                    <Tag style={{ borderRadius: 6, fontSize: 11, background: 'var(--surface-sunken)', color: 'var(--ink-3)', borderColor: 'transparent' }}>{profile.version}</Tag>
                  </Space>
                }
              >
                <Row gutter={20}>
                  <Col span={11}>
                    <RadarChart
                      height={260}
                      series={[{ name: profile.version, values: PROFILE_DIMENSIONS.map((d) => profile.dims[d.key].score), color: '#d96a8e' }]}
                    />
                  </Col>
                  <Col span={13}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                      综合分 <span className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{profile.overall}</span>
                      {'  '}· 生成 {profile.generatedAt} · {profile.source}
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 }}>
                      <span className="ai-badge" style={{ marginRight: 8 }}>AI 画像</span>
                      {profile.summary}
                    </div>
                    <Row gutter={8} style={{ marginTop: 12 }}>
                      <Col span={8}>
                        <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', textAlign: 'center' }}>
                          <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{emp.perf}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>2025 绩效</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', textAlign: 'center' }}>
                          <div className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>{emp.grid}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>九宫格</div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', textAlign: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            <MaskedField value={emp.salary} format={(v) => `¥${Number(v).toLocaleString()}`} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>月薪（{bandOf(emp.family, emp.grade)?.bandRange ?? '带宽'}）</div>
                        </div>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Card>

              <Card variant="borderless" style={{ background: 'var(--surface)' }} title="七维明细" size="small">
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={PROFILE_DIMENSIONS.map((dim) => ({ dim, ...profile.dims[dim.key] }))}
                  columns={[
                    { title: '维度', render: (_: unknown, r) => <b style={{ fontSize: 13 }}>{DIMENSION_NAME[r.dim.key]}</b> },
                    {
                      title: '得分',
                      width: 220,
                      render: (_: unknown, r) => (
                        <Space size={8}>
                          <div style={{ width: 120, height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${r.score}%`, height: '100%', background: GRADE_COLOR[r.grade], borderRadius: 3 }} />
                          </div>
                          <span className="num" style={{ fontWeight: 700 }}>{r.score}</span>
                        </Space>
                      ),
                    },
                    { title: '评级', width: 80, render: (_: unknown, r) => <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: 'var(--surface-sunken)', color: GRADE_COLOR[r.grade], fontSize: 11 }}>{r.grade}</Tag> },
                    { title: '数据来源与说明', render: (_: unknown, r) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.note}</span> },
                  ]}
                />
              </Card>
            </>
          )}
        </Col>
      </Row>
    </div>
  );
}
