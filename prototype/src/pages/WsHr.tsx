import { Link } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Space, Tag } from 'antd';
import { FileDoneOutlined, NotificationOutlined, RobotOutlined, ScheduleOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { certifications, CERT_STAGE_LABEL, CERT_MAIN_CHAIN } from '@/mock/certifications';
import { standards } from '@/mock/standards';
import { employees } from '@/mock/people';
import { profiles } from '@/mock/profiles';
import { todosOf } from '@/mock/notifications';

export function WsHr() {
  const persona = useAuth((s) => s.persona);
  const todos = persona ? todosOf(persona.id) : [];

  const inFlight = certifications.filter((c) => !['passed', 'terminated', 'withdrawn'].includes(c.stage));
  const stageCounts = CERT_MAIN_CHAIN.map((st) => ({
    stage: st,
    count: inFlight.filter((c) => c.stage === st).length,
  }));
  const profiled = new Set(profiles.map((p) => p.employeeId)).size;

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">HR 运营工作台</h1>
          <div className="page-subtitle">华砺精工 · 标准库、认证管道与盘点筹备</div>
        </div>
        <Space>
          <Link to="/app/standard-versions"><Button icon={<FileDoneOutlined />}>版本与发布</Button></Link>
          <Link to="/app/talent-profile"><Button type="primary" style={{ background: 'var(--charcoal)' }}>画像库</Button></Link>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '标准库序列', value: standards.length, sub: `生效 ${standards.filter((s) => s.status === '生效').length} · 评审中 ${standards.filter((s) => s.status === '评审中').length} · 草稿 ${standards.filter((s) => s.status === '草稿').length}` },
          { label: '认证在途', value: inFlight.length, sub: '晋升 4 · 终止 1（本季）' },
          { label: '画像覆盖', value: `${profiled}/${employees.length}`, sub: '初排引擎已兜底' },
          { label: '下次盘点启动', value: '10-15', sub: '数据补齐倒计时 18 天' },
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
          {/* 认证管道 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={<Space><ScheduleOutlined />认证管道（按环节）</Space>}
            extra={<Link to="/app/cert-review"><Button type="text" size="small">进审核台</Button></Link>}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              {stageCounts.map((s) => (
                <div key={s.stage} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, color: s.count > 0 ? 'var(--clay)' : 'var(--ink-4)' }}>{s.count}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{CERT_STAGE_LABEL[s.stage]}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {inFlight.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                  <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'var(--line)', background: 'var(--surface-sunken)', color: 'var(--ink-3)' }}>{c.id}</Tag>
                  <span style={{ fontWeight: 600, minWidth: 56 }}>{employees.find((e) => e.id === c.employeeId)?.name}</span>
                  <span style={{ color: 'var(--ink-3)' }}>{c.sequence}-{c.fromGrade}→{c.toGrade}</span>
                  <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', marginLeft: 'auto' }}>{CERT_STAGE_LABEL[c.stage]}</Tag>
                </div>
              ))}
            </div>
          </Card>

          {/* 待办 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`待我处理（${todos.length}）`}
            extra={<Link to="/app/notifications"><Button type="text" size="small">全部消息</Button></Link>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {todos.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: t.level === 'urgent' ? 'var(--clay-soft)' : 'var(--surface-sunken)' }}>
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
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={<Space><RobotOutlined />AI 服务状态</Space>}
            size="small"
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--ink-2)' }}>本月 AI 用量</span>
                  <span className="num" style={{ color: 'var(--ochre)' }}>80% · 配额预警</span>
                </div>
                <Progress percent={80} strokeColor="var(--ochre)" showInfo={false} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.9 }}>
                <div><span className="ai-badge" style={{ marginRight: 6 }}>AI 出题</span>12 份组卷待人工审核后发布</div>
                <div><span className="ai-badge" style={{ marginRight: 6 }}>AI 预审</span>认证举证预检通过率 82%</div>
                <div><span className="ai-badge" style={{ marginRight: 6 }}>AI 画像</span>画像摘要生成 · 已回写 43 人</div>
              </div>
              <Link to="/app/exam-review"><Button size="small" block>去审核 AI 组卷</Button></Link>
            </Space>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title={<Space><NotificationOutlined />运营快捷入口</Space>} size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {[
                { key: 'standards-list', label: '标准库维护', desc: '5 序列 · 岗位绑定率 100%' },
                { key: 'inv-batches', label: '盘点批次筹备', desc: '10-15 启动 · 批次 4 交付' },
                { key: 'cert-vote', label: '管委会终审', desc: '汪漾 P3→P4 待表决' },
                { key: 'ai-usage', label: 'AI 用量报表', desc: '批次 8 交付' },
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
