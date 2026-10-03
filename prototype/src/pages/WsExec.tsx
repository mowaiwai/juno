import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Space, Spin, Tag, message } from 'antd';
import { CommentOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { USE_MOCK } from '@/api/config';
import { notificationsApi } from '@/api/notifications';
import type { NoticeItem } from '@/mock/notifications';
import { hrApplicationsApi } from '@/api/finalize';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { APPLICATION_STATUS_META, type ApplicationListItemDTO } from '@/api/applications';
import { employees } from '@/mock/people';
import { certifications } from '@/mock/certifications';
import { todosOf } from '@/mock/notifications';

function MockWsExec() {
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

// ============ 真实 API 模式 ============

function RealWsExec() {
  const persona = useAuth((s) => s.persona);
  const [apps, setApps] = useState<ApplicationListItemDTO[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[] | null>(null);
  const [todos, setTodos] = useState<NoticeItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e, n] = await Promise.all([
        hrApplicationsApi.list().catch(() => [] as ApplicationListItemDTO[]),
        employeesApi.list().catch(() => [] as EmployeeDirectoryItem[]),
        notificationsApi.list().catch(() => [] as NoticeItem[]),
      ]);
      setApps(a);
      setEmployees(e);
      setTodos(n);
    } catch {
      message.error('工作台数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todoItems = (todos ?? []).filter((n) => n.kind === 'todo' && !n.doneAt);

  const certStats = {
    inReview: apps?.filter((a) => a.status === 'in_committee_review').length ?? 0,
    approved: apps?.filter((a) => a.status === 'approved').length ?? 0,
    published: apps?.filter((a) => a.status === 'published').length ?? 0,
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">高管工作台</h1>
          <div className="page-subtitle">{persona?.tenantName ?? ''} · 人才大盘与关键决策入口</div>
        </div>
        <Link to="/app/three-charts">
          <Button type="primary" icon={<RiseOutlined />} style={{ background: 'var(--charcoal)' }}>三张图驾驶舱</Button>
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {[
              { label: '在册人才', value: employees?.length ?? 0, sub: '全租户编制' },
              { label: '认证评审中', value: certStats.inReview, sub: '委员会评审' },
              { label: '终审通过', value: certStats.approved, sub: '待 HR 发布' },
              { label: '已发布认证', value: certStats.published, sub: '本季完成' },
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
              <Card
                variant="borderless"
                style={{ background: 'var(--surface)', marginBottom: 16 }}
                title={`待我决策（${todoItems.length}）`}
                extra={<Link to="/app/notifications"><Button type="text" size="small">全部消息</Button></Link>}
              >
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {todoItems.map((t) => (
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
                  {todoItems.length === 0 && <span style={{ color: 'var(--ink-3)' }}>暂无待办</span>}
                </Space>
              </Card>

              <Card variant="borderless" style={{ background: 'var(--surface)' }} title={<Space><TeamOutlined />认证管道速览</Space>}>
                <Row gutter={12}>
                  {(['submitted', 'in_manager_review', 'in_committee_review', 'approved', 'published'] as const).map((st) => (
                    <Col span={4} key={st}>
                      <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)', textAlign: 'center' }}>
                        <div className="num" style={{ fontSize: 22, fontWeight: 700, color: APPLICATION_STATUS_META[st]?.color ?? 'var(--ink-3)' }}>
                          {apps?.filter((a) => a.status === st).length ?? 0}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {APPLICATION_STATUS_META[st]?.label ?? st}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>

            <Col span={9}>
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
        </>
      )}
    </div>
  );
}

export function WsExec() {
  return USE_MOCK ? <MockWsExec /> : <RealWsExec />;
}
