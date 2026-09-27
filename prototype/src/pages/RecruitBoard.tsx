import { useMemo } from 'react';
import { Button, Card, Col, Modal, Progress, Row, Space, Table, Tag, Tooltip, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { aiJd, candidates, CAND_STAGE_LABEL, CandStage, requisitions } from '@/mock/recruit';

const matchColor = (s: number) => (s >= 85 ? 'var(--sage)' : s >= 70 ? 'var(--ochre)' : 'var(--danger)');

/** 候选人卡片 */
function CandCard({ c }: { c: (typeof candidates)[number] }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '8px 10px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
        <Tooltip title="与目标岗位画像匹配度">
          <span className="num" style={{ fontWeight: 700, color: matchColor(c.matchScore), fontSize: 13 }}>{c.matchScore}</span>
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
        {c.lastTitle} · {c.years > 0 ? c.years + ' 年经验' : '应届生'} · {c.source}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {c.tags.slice(0, 2).map((t) => (
          <Tag key={t} style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--ink-2)', borderColor: 'var(--line)' }}>
            {t}
          </Tag>
        ))}
        {c.rating && (
          <Tag style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
            面试 {c.rating}
          </Tag>
        )}
      </div>
    </div>
  );
}

const FUNNEL_LABEL = ['简历', '初筛', '初试', '复试', 'Offer'];

export function RecruitBoard() {
  const activeStages: CandStage[] = ['screen', 'first', 'final', 'offer'];

  const funnel = useMemo(
    () => FUNNEL_LABEL.map((_, i) => requisitions.reduce((s, r) => s + r.funnel[i], 0)),
    [],
  );
  const maxF = funnel[0];

  const openJd = () => {
    Modal.info({
      title: <span className="font-serif">AI 生成 JD · {aiJd.position}</span>,
      width: 620,
      content: (
        <div style={{ marginTop: 12 }}>
          {aiJd.sections.map((s) => (
            <div key={s.h} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.h}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface-sunken)', borderRadius: 6, padding: 8 }}>
            <RobotOutlined /> {aiJd.basis}
          </div>
        </div>
      ),
      okText: '采用此 JD',
      onOk: () => message.success('JD 已同步至在招需求（模拟）'),
    });
  };

  return (
    <div className="page" style={{ maxWidth: 1320 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">招聘工作台</h1>
          <div className="page-subtitle">需求漏斗 · 候选人画像匹配 · 履职表即题库 · AI 生成 JD 与面试题</div>
        </div>
        <Button type="primary" icon={<RobotOutlined />} style={{ background: 'var(--charcoal)' }} onClick={openJd}>
          AI 生成 JD
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '在招需求', value: requisitions.length, sub: `急招 ${requisitions.filter((r) => r.priority === 'high').length} 个岗位`, color: 'var(--ink)' },
          { label: '管道候选人', value: candidates.filter((c) => !['rejected', 'onboard'].includes(c.stage)).length, sub: '不含已淘汰', color: 'var(--clay)' },
          { label: '待安排面试', value: candidates.filter((c) => c.stage === 'screen').length, sub: '简历初筛中', color: 'var(--ochre)' },
          { label: 'Offer / 已入职', value: `${candidates.filter((c) => c.stage === 'offer').length} / ${candidates.filter((c) => c.stage === 'onboard').length}`, sub: '本季转化', color: 'var(--sage)' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* 左：总漏斗 + 需求表 */}
        <Col span={9}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="招聘漏斗（全部需求合计）">
            {funnel.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 40, fontSize: 12, color: 'var(--ink-2)' }}>{FUNNEL_LABEL[i]}</span>
                <div
                  style={{
                    width: `${Math.max(6, (v / maxF) * 100)}%`,
                    height: 20,
                    borderRadius: 5,
                    background: `color-mix(in srgb, var(--clay) ${85 - i * 15}%, var(--clay-soft))`,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 8,
                  }}
                >
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, color: i >= 3 ? 'var(--ink)' : 'var(--ink)' }}>{v}</span>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>简历 → Offer 转化率 {Math.round((funnel[4] / funnel[0]) * 100)}%，高于行业均值 2.1pct</div>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="在招需求">
            <Table
              rowKey="id"
              dataSource={requisitions}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '岗位',
                  render: (_: unknown, r) => (
                    <Space direction="vertical" size={0}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{r.position}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.dept} · {r.grade} · 招 {r.headcount}</span>
                    </Space>
                  ),
                },
                {
                  title: '进度',
                  render: (_: unknown, r) => {
                    const p = Math.min(100, Math.round((r.funnel[4] / r.headcount) * 100));
                    return <Progress type="circle" size={34} percent={p} strokeColor="var(--clay)" trailColor="var(--line)" />;
                  },
                },
                {
                  title: '优先级',
                  width: 64,
                  render: (_: unknown, r) =>
                    r.priority === 'high' ? (
                      <Tag color="red" style={{ borderRadius: 4, margin: 0 }}>急招</Tag>
                    ) : (
                      <Tag style={{ borderRadius: 4, margin: 0 }}>常规</Tag>
                    ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* 右：候选人看板 */}
        <Col span={15}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="候选人看板（按阶段，卡片可点击查看画像比对）">
            <Row gutter={10}>
              {activeStages.map((st) => {
                const list = candidates.filter((c) => c.stage === st);
                return (
                  <Col span={6} key={st}>
                    <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 8, minHeight: 200 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{CAND_STAGE_LABEL[st]}</span>
                        <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{list.length}</span>
                      </div>
                      {list.map((c) => <CandCard key={c.id} c={c} />)}
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
