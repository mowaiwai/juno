import { Card, Col, Progress, Row, Table, Tag } from 'antd';
import { courses, instructors, onboardingPath } from '@/mock/training';

const TYPE_COLOR: Record<string, string> = {
  内训: 'var(--teal)',
  微课: 'var(--ochre)',
  训练营: 'var(--clay)',
  外训: 'var(--sage)',
};

export function TrainingAdmin() {
  const totalHours = courses.reduce((s, c) => s + c.hours, 0);
  const avgCompletion = Math.round(courses.filter((c) => c.completion > 0).reduce((s, c) => s + c.completion, 0) / courses.filter((c) => c.completion > 0).length);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">培训管理</h1>
          <div className="page-subtitle">讲师 / 课程 / 微课 / 报名 · 新员工 180 天融入路径</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '项目/课程', value: courses.length, sub: `招生中 ${courses.filter((c) => c.status === '招生中').length}` },
          { label: '总课时', value: totalHours + ' h', sub: '内外部讲师合计' },
          { label: '平均完成率', value: avgCompletion + '%', sub: '进行中与已结项' },
          { label: '认证内训讲师', value: instructors.length, sub: '全部内部认证' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="课程项目">
        <Table
          rowKey="id"
          dataSource={courses}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '课程',
              render: (_: unknown, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.category} · {r.hours} 课时 · {r.startedAt} 开始</div>
                </div>
              ),
            },
            {
              title: '类型',
              width: 90,
              render: (_: unknown, r) => (
                <Tag style={{ borderRadius: 6, background: TYPE_COLOR[r.type] + '22', color: TYPE_COLOR[r.type], borderColor: 'transparent' }}>{r.type}</Tag>
              ),
            },
            { title: '讲师', width: 100, dataIndex: 'instructor' },
            {
              title: '报名',
              width: 80,
              render: (_: unknown, r) => <span className="num">{r.enrolled} 人</span>,
            },
            {
              title: '完成率',
              width: 180,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={r.completion} size="small" strokeColor="var(--sage)" trailColor="var(--line)" style={{ width: 110, margin: 0 }} />
                  <span className="num">{r.completion}%</span>
                </div>
              ),
            },
            {
              title: '状态',
              width: 90,
              render: (_: unknown, r) => {
                const map: Record<string, string> = { 进行中: 'var(--clay)', 招生中: 'var(--ochre)', 已结项: 'var(--ink-4)' };
                return <span style={{ color: map[r.status], fontWeight: 600, fontSize: 12 }}>{r.status}</span>;
              },
            },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col span={9}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="认证内训讲师">
            {instructors.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.field} · 授课 {t.courses} 门</div>
                </div>
                <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                  ★ {t.rating}
                </Tag>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={15}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="新员工 180 天路径">
            <div style={{ display: 'flex' }}>
              {onboardingPath.map((p, i) => (
                <div key={i} style={{ flex: 1, paddingRight: i < 4 ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--charcoal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    {i < 4 && <div style={{ flex: 1, height: 2, background: 'var(--line)' }} />}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{p.stage}</div>
                  {p.items.map((it) => (
                    <div key={it} style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 3 }}>· {it}</div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
