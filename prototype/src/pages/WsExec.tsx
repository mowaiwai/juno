import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Space, Tag } from 'antd';
import { CommentOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { employees } from '@/mock/people';
import { certifications } from '@/mock/certifications';
import { todosOf } from '@/mock/notifications';

export function WsExec() {
  const persona = useAuth((s) => s.persona);
  const todos = persona ? todosOf(persona.id) : [];

  const total = employees.length;
  const core = employees.filter((e) => e.isCorePosition).length;
  const highPot = employees.filter((e) => e.potential === 'HIGH').length;
  const risk = employees.filter((e) => e.risk === 'HIGH').length;
  const topGrid = employees.filter((e) => e.grid === '9A1').length;
  const certs = certifications.filter((c) => c.stage === 'defense').length;

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">高管工作台</h1>
          <div className="page-subtitle">华砺精工 · 人才大盘与关键决策入口</div>
        </div>
        <Link to="/app/three-charts">
          <Button type="primary" icon={<RiseOutlined />} style={{ background: 'var(--charcoal)' }}>三张图驾驶舱</Button>
        </Link>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '在册人才', value: total, sub: '650 人编制 · 原型演示 43 人' },
          { label: '核心岗位在岗', value: core, sub: '继任覆盖率 62%（批次 6）' },
          { label: '高潜人才', value: highPot, sub: `明星格 9A1：${topGrid} 人` },
          { label: '高风险预警', value: risk, sub: '离职风险 HIGH' },
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
          {/* 待审批 / 待办 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={`待我决策（${todos.length}）`}
            extra={<Link to="/app/notifications"><Button type="text" size="small">全部消息</Button></Link>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {todos.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--line)', background: t.level === 'urgent' ? 'var(--clay-soft)' : 'var(--surface-sunken)' }}>
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

          {/* 人才决策速览 */}
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title={<Space><TeamOutlined />本季人才决策速览</Space>}>
            <Row gutter={12}>
              <Col span={8}>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)' }}>{certs}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高等级认证答辩在审</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ochre)' }}>1</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>哑铃型结构部门（软件研发部）</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>23</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>调薪引擎入围（10-08 窗口）</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={9}>
          {/* AI 驾驶舱问答 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={<Space><CommentOutlined />驾驶舱问答</Space>}
            size="small"
            extra={<Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>可溯源</Tag>}
          >
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 }}>
              试试问：
              <div>· 「软件研发部为何是哑铃型？」</div>
              <div>· 「高潜人才近两年流失了多少？」</div>
              <div>· 「哪些核心岗位继任空缺？」</div>
            </div>
            <Link to="/app/cockpit-qa">
              <Button block style={{ marginTop: 12 }}>进入问答（批次 4 交付）</Button>
            </Link>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="决策快捷入口" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {[
                { key: 'nine-grid', label: '九宫格确认', desc: '盘点终审 · 批次 4' },
                { key: 'talent-profile', label: '人才画像库', desc: '全公司可看（含薪酬）' },
                { key: 'salary-plan', label: '调薪方案审批', desc: '批次 7 交付' },
                { key: 'succession-matrix', label: '继任矩阵', desc: '批次 6 交付' },
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
