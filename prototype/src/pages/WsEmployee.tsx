import { Link } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Space, Tag } from 'antd';
import {
  ArrowRightOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import { deptName } from '@/mock/org';
import { latestProfile } from '@/mock/profiles';
import { certByEmployee, CERT_MAIN_CHAIN, CERT_STAGE_LABEL } from '@/mock/certifications';
import { todosOf } from '@/mock/notifications';
import { RadarChart } from '@/components/RadarChart';
import { PROFILE_DIMENSIONS } from '@/mock/profiles';

const QUICK_LINKS = [
  { key: 'my-channel', title: '我的通道', desc: '职级地图与晋升规则', icon: <ThunderboltOutlined /> },
  { key: 'my-gap', title: '我的差距', desc: '对照标准逐条达标', icon: <BookOutlined /> },
  { key: 'cert-apply', title: '认证举证', desc: '材料提交与预审', icon: <SafetyCertificateOutlined /> },
  { key: 'my-profile', title: '我的画像', desc: '七维画像与版本', icon: <UserOutlined /> },
];

export function WsEmployee() {
  const persona = useAuth((s) => s.persona);
  const emp = employeeById(persona?.employeeId);
  const profile = emp ? latestProfile(emp.id) : undefined;
  const cert = emp ? certByEmployee(emp.id).find((c) => c.stage !== 'terminated') : undefined;
  const todos = persona ? todosOf(persona.id) : [];

  const stageIdx = cert ? CERT_MAIN_CHAIN.indexOf(cert.stage) : -1;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      {/* 问候区 */}
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">下午好，{persona?.name}</h1>
          <div className="page-subtitle">
            {emp ? `${deptName(emp.deptId)} · ${emp.position} · ${emp.grade}` : ''}
            {emp?.tags.map((t) => (
              <Tag key={t} style={{ borderRadius: 6, marginLeft: 8, background: 'var(--clay-soft)', color: 'var(--clay-hover)', borderColor: 'transparent', fontSize: 12 }}>
                {t}
              </Tag>
            ))}
          </div>
        </div>
        <Link to="/app/my-cert">
          <Button>我的认证记录</Button>
        </Link>
      </div>

      <Row gutter={16}>
        {/* 认证进度卡 */}
        <Col span={16}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: 'var(--clay)' }} />
                <span>SW-{cert?.toGrade} 晋升认证进行中</span>
                <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                  {cert ? `当前环节：${CERT_STAGE_LABEL[cert.stage]}` : ''}
                </Tag>
              </Space>
            }
            extra={
              <Link to="/app/cert-apply">
                <Button type="primary" icon={<ArrowRightOutlined />} style={{ background: 'var(--charcoal)' }}>
                  继续举证
                </Button>
              </Link>
            }
          >
            <Progress percent={cert?.progress ?? 0} strokeColor="var(--clay)" size={['100%', 12] as never} />
            <div style={{ display: 'flex', gap: 0, marginTop: 14, flexWrap: 'wrap' }}>
              {CERT_MAIN_CHAIN.map((st, i) => (
                <div key={st} style={{ flex: 1, minWidth: 86, textAlign: 'center', position: 'relative' }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      margin: '0 auto 6px',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      background: i < stageIdx ? 'var(--sage-soft)' : i === stageIdx ? 'var(--clay)' : 'var(--surface-sunken)',
                      color: i < stageIdx ? 'var(--sage)' : i === stageIdx ? '#fff' : 'var(--ink-4)',
                      border: i === stageIdx ? '2px solid var(--clay-soft)' : '1px solid var(--line)',
                    }}
                  >
                    {i < stageIdx ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 12, color: i <= stageIdx ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                    {CERT_STAGE_LABEL[st]}
                  </div>
                </div>
              ))}
            </div>
            {cert?.examScore !== undefined && (
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-3)' }}>
                知识测验 <span className="num" style={{ color: 'var(--sage)', fontWeight: 600 }}>{cert.examScore} 分</span>
                （合格线 80）· <span className="ai-badge">AI 组卷</span> 成绩已回写画像
              </div>
            )}
          </Card>

          {/* 待办 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`我的待办（${todos.length}）`}
            extra={<Link to="/app/notifications"><Button type="text" size="small">全部消息</Button></Link>}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {todos.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
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
                  {t.link && (
                    <Link to={t.link}>
                      <Button size="small">{t.linkLabel ?? '处理'}</Button>
                    </Link>
                  )}
                </div>
              ))}
              {todos.length === 0 && <span style={{ color: 'var(--ink-3)' }}>暂无待办</span>}
            </Space>
          </Card>
        </Col>

        {/* 右列 */}
        <Col span={8}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title="我的画像"
            extra={<Link to="/app/my-profile"><Button type="text" size="small">详情</Button></Link>}
          >
            {profile && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                  <span className="num" style={{ fontSize: 30, fontWeight: 700, color: 'var(--clay)' }}>
                    {profile.overall}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 6 }}>综合分 · {profile.version}</span>
                </div>
                <RadarChart
                  height={210}
                  series={[{ name: 'v2025Q3', values: PROFILE_DIMENSIONS.map((d) => profile.dims[d.key].score), color: '#d96a8e' }]}
                />
              </>
            )}
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="快捷入口" size="small">
            <Row gutter={[8, 8]}>
              {QUICK_LINKS.map((q) => (
                <Col span={12} key={q.key}>
                  <Link to={`/app/${q.key}`}>
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-sunken)',
                        height: 74,
                      }}
                    >
                      <div style={{ color: 'var(--clay)', fontSize: 15 }}>{q.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{q.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{q.desc}</div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
