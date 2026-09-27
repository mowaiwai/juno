import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Space, Table, Tag } from 'antd';
import { AuditOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { useAuth, useDataScope } from '@/store/auth';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { certifications, CERT_ROUTER_LABEL, CERT_STAGE_LABEL } from '@/mock/certifications';
import { todosOf } from '@/mock/notifications';

export function WsManager() {
  const persona = useAuth((s) => s.persona);
  const scope = useDataScope();
  const team = scope(allEmployees);
  const teamCerts = scope(certifications);
  const inFlight = teamCerts.filter((c) => !['passed', 'terminated', 'withdrawn'].includes(c.stage));
  const todos = persona ? todosOf(persona.id) : [];

  const avgPerf = team.length
    ? Math.round(team.reduce((s, e) => s + e.perfScore, 0) / team.length)
    : 0;
  const highPot = team.filter((e) => e.potential === 'HIGH').length;
  const risk = team.filter((e) => e.risk === 'HIGH').length;
  const gradeDist = team.reduce<Record<string, number>>((m, e) => {
    m[e.grade] = (m[e.grade] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">{persona?.name}的工作台</h1>
          <div className="page-subtitle">
            {team.length > 0 && deptName(team[0].deptId)} · 团队 {team.length} 人 · 数据范围：所辖组织子树
          </div>
        </div>
        <Space>
          <Link to="/app/cert-review"><Button icon={<AuditOutlined />}>认证审核台</Button></Link>
          <Link to="/app/talent-profile"><Button type="primary" style={{ background: 'var(--charcoal)' }}>团队画像</Button></Link>
        </Space>
      </div>

      {/* 团队概览 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '团队人数', value: team.length, sub: '编制内在职' },
          { label: '平均绩效分', value: avgPerf, sub: '2025 年度' },
          { label: '高潜人数', value: highPot, sub: '潜力 HIGH' },
          { label: '高风险预警', value: risk, sub: risk > 0 ? '需保留面谈' : '—' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={15}>
          {/* 团队认证在途 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={`团队认证在途（${inFlight.length}）`}
            extra={<Link to="/app/cert-review"><Button type="text" size="small">进审核台</Button></Link>}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={inFlight}
              pagination={false}
              columns={[
                { title: '员工', dataIndex: 'employeeId', render: (id: string) => team.find((e) => e.id === id)?.name ?? id },
                { title: '目标', render: (_: unknown, r) => `${r.sequence}-${r.toGrade}` },
                { title: '环节', render: (_: unknown, r) => <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>{CERT_STAGE_LABEL[r.stage]}</Tag> },
                { title: '路由', render: (_: unknown, r) => CERT_ROUTER_LABEL[r.router] },
                { title: '举证截止', dataIndex: 'deadline' },
              ]}
            />
          </Card>

          {/* 我的待办 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`待我处理（${todos.length}）`}
            extra={<Link to="/app/notifications"><Button type="text" size="small">全部消息</Button></Link>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {todos.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderRadius: 10, border: '1px solid var(--line)',
                    background: t.level === 'urgent' ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {t.level === 'urgent' && <span style={{ color: 'var(--clay-hover)', marginRight: 6 }}>●</span>}
                      {t.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{t.desc}</div>
                  </div>
                  {t.link && <Link to={t.link}><Button size="small">{t.linkLabel ?? '处理'}</Button></Link>}
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        <Col span={9}>
          {/* 职级结构 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={<Space><TeamOutlined />团队职级结构</Space>}
            extra={<Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>哑铃型</Tag>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {Object.entries(gradeDist).sort().map(([g, n]) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, fontSize: 12, color: 'var(--ink-2)' }}>{g}</span>
                  <div style={{ flex: 1, height: 14, background: 'var(--surface-sunken)', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${(n / team.length) * 100}%`, height: '100%', background: g === 'P4' || g === 'M2' ? 'var(--clay)' : 'var(--teal)', borderRadius: 7 }} />
                  </div>
                  <span className="num" style={{ width: 18, fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>{n}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--ink-3)', paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
                <WarningOutlined style={{ color: 'var(--ochre)', marginRight: 6 }} />
                新人（P2）与高级（P4）占比偏高，中坚 P3 层厚度不足——哑铃型结构，建议加速 P2→P3 认证。
              </div>
            </Space>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="管理快捷入口" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {[
                { key: 'talent-profile', label: '团队七维画像', desc: '逐人查看雷达与摘要' },
                { key: 'roster', label: '团队花名册', desc: '数据范围自动过滤' },
                { key: 'gap-board', label: '人岗差距看板', desc: '批次 5 交付' },
                { key: 'nine-grid', label: '九宫格校准', desc: '批次 4 交付' },
              ].map((q) => (
                <Link key={q.key} to={`/app/${q.key}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{q.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{q.desc}</div>
                    </div>
                    <span style={{ color: 'var(--ink-4)' }}>›</span>
                  </div>
                </Link>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
