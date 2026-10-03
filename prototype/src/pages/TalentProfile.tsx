import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Row, Space, Table, Tag, message } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { profilesApi, type ProfileOut, type DimensionOut } from '@/api/profiles';
import { DIMENSION_NAME, PROFILE_DIMENSIONS } from '@/mock/profiles';
import { RadarChart } from '@/components/RadarChart';

const GRADE_COLOR: Record<string, string> = {
  优: 'var(--sage)',
  良: 'var(--teal)',
  达标: 'var(--ochre)',
  待改进: 'var(--danger)',
};

/** 将后端 dimensions 数组转为 mock 风格的 Record，复用既有 UI */
function dimsToRecord(dimensions: DimensionOut[]): Record<string, { score: number; grade: string; note: string }> {
  const rec: Record<string, { score: number; grade: string; note: string }> = {};
  for (const d of PROFILE_DIMENSIONS) {
    const dim = dimensions.find((x) => x.dimension_key === d.key);
    rec[d.key] = {
      score: dim?.score ?? 0,
      grade: dim?.grade_label ?? '—',
      note: dim?.note ?? '',
    };
  }
  return rec;
}

export function TalentProfile() {
  const [emps, setEmps] = useState<EmployeeDirectoryItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [versions, setVersions] = useState<{ version_seq: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    employeesApi.list().then((dir) => {
      setEmps(dir);
      if (dir.length) setSelectedId(dir[0].id);
    }).catch(() => message.error('加载员工目录失败'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([profilesApi.latest(selectedId), profilesApi.versions(selectedId)])
      .then(([p, v]) => {
        setProfile(p);
        setVersions(v);
      })
      .catch(() => {
        setProfile(null);
        message.error('加载画像数据失败');
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const filtered = useMemo(
    () =>
      emps.filter(
        (e) =>
          e.name.includes(keyword) ||
          e.employee_no.includes(keyword.toUpperCase()) ||
          e.position.includes(keyword),
      ),
    [emps, keyword],
  );

  const emp = filtered.find((e) => e.id === selectedId) ?? filtered[0];
  const dims = profile ? dimsToRecord(profile.dimensions) : {};
  const versionLabel = profile ? `v${profile.version_seq}` : '';

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
        {/* 左：人员列表 */}
        <Col span={7}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`人员（${emps.length} 人）`}
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
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{e.sequence} · {versionLabel || '—'}</div>
                    </div>
                    {profile && emp?.id === e.id && (
                      <span className="num" style={{ fontSize: 15, fontWeight: 700, color: (profile.overall ?? 0) >= 80 ? 'var(--sage)' : (profile.overall ?? 0) >= 65 ? 'var(--ochre)' : 'var(--danger)' }}>
                        {profile.overall}
                      </span>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配员工" />}
            </div>
          </Card>
        </Col>

        {/* 右：画像详情 */}
        <Col span={17}>
          {!emp || !profile ? (
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <Empty description={loading ? '加载中…' : '该员工暂无画像'} />
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
                    <Tag style={{ borderRadius: 6 }}>{emp.employee_no}</Tag>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {emp.sequence} · {emp.position} · {emp.grade}
                    </span>
                  </Space>
                }
                extra={
                  <Space size={6}>
                    {versions.length > 1 && <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'var(--line)' }}>含 {versions.length} 个版本</Tag>}
                    <Tag style={{ borderRadius: 6, fontSize: 11, background: 'var(--surface-sunken)', color: 'var(--ink-3)', borderColor: 'transparent' }}>{versionLabel}</Tag>
                  </Space>
                }
              >
                <Row gutter={20}>
                  <Col span={11}>
                    <RadarChart
                      height={260}
                      series={[{ name: versionLabel, values: PROFILE_DIMENSIONS.map((d) => dims[d.key]?.score ?? 0), color: '#d96a8e' }]}
                    />
                  </Col>
                  <Col span={13}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                      综合分 <span className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{profile.overall}</span>
                      {'  '}· 生成 {profile.generated_at?.slice(0, 10)} · {profile.source}
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 }}>
                      <span className="ai-badge" style={{ marginRight: 8 }}>AI 画像</span>
                      画像由系统按七维数据自动生成，详情见下方各维度说明。
                    </div>
                  </Col>
                </Row>
              </Card>

              <Card variant="borderless" style={{ background: 'var(--surface)' }} title="七维明细" size="small">
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={PROFILE_DIMENSIONS.map((dim) => ({ dim, ...dims[dim.key] }))}
                  columns={[
                    { title: '维度', render: (_: unknown, r) => <b style={{ fontSize: 13 }}>{DIMENSION_NAME[r.dim.key]}</b> },
                    {
                      title: '得分',
                      width: 220,
                      render: (_: unknown, r) => (
                        <Space size={8}>
                          <div style={{ width: 120, height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${r.score}%`, height: '100%', background: GRADE_COLOR[r.grade] || 'var(--ink-3)', borderRadius: 3 }} />
                          </div>
                          <span className="num" style={{ fontWeight: 700 }}>{r.score}</span>
                        </Space>
                      ),
                    },
                    { title: '评级', width: 80, render: (_: unknown, r) => <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: 'var(--surface-sunken)', color: GRADE_COLOR[r.grade] || 'var(--ink-3)', fontSize: 11 }}>{r.grade}</Tag> },
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
