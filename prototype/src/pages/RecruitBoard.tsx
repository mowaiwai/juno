import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Modal, Progress, Row, Space, Table, Tag, Tooltip, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import {
  aiJdData,
  candidateApi,
  CandidateOut,
  DEPT_NAME_MAP,
  requisitionApi,
  RequisitionOut,
} from '@/api/recruit';

const matchColor = (s: number) => (s >= 85 ? 'var(--sage)' : s >= 70 ? 'var(--ochre)' : 'var(--danger)');
const FUNNEL_LABEL = ['简历', '初筛', '初试', '复试', 'Offer'];
const ACTIVE_STAGES = ['screen', 'first', 'final', 'offer'] as const;
const STAGE_LABEL: Record<string, string> = {
  screen: '简历初筛', first: '初试', final: '复试', offer: 'Offer',
  onboard: '已入职', rejected: '已淘汰',
};

function CandCard({ c }: { c: CandidateOut }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
        <Tooltip title="与目标岗位画像匹配度">
          <span className="num" style={{ fontWeight: 700, color: matchColor(c.match_score), fontSize: 13 }}>{c.match_score}</span>
        </Tooltip>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
        {c.last_title} · {c.years > 0 ? c.years + ' 年经验' : '应届生'} · {c.source}
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {c.tags.slice(0, 2).map((t) => (
          <Tag key={t} style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--ink-2)', borderColor: 'var(--line)' }}>{t}</Tag>
        ))}
        {c.rating && (
          <Tag style={{ fontSize: 11, margin: 0, borderRadius: 4, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>面试 {c.rating}</Tag>
        )}
      </div>
    </div>
  );
}

export function RecruitBoard() {
  const [reqs, setReqs] = useState<RequisitionOut[]>([]);
  const [cands, setCands] = useState<CandidateOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      requisitionApi.list().catch(() => { message.error('在招需求加载失败'); return []; }),
      candidateApi.list().catch(() => { message.error('候选人加载失败'); return []; }),
    ]).then(([r, c]) => {
      setReqs(r);
      setCands(c);
      setLoading(false);
    });
  }, []);

  const funnel = useMemo(() => FUNNEL_LABEL.map((_, i) => reqs.reduce((s, r) => s + (r.funnel[i] ?? 0), 0)), [reqs]);
  const maxF = funnel[0] || 1;

  const openJd = () => {
    Modal.info({
      title: <span className="font-serif">AI 生成 JD · {aiJdData.position}</span>,
      width: 620,
      content: (
        <div style={{ marginTop: 12 }}>
          {aiJdData.sections.map((s) => (
            <div key={s.h} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.h}</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
          <div style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--surface-sunken)', borderRadius: 6, padding: 8 }}>
            <RobotOutlined /> {aiJdData.basis}
          </div>
        </div>
      ),
      okText: '采用此 JD',
      onOk: () => message.success('JD 已同步至在招需求（模拟）'),
    });
  };

  if (loading) return null;

  return (
    <div className="page" style={{ maxWidth: 1320 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">招聘工作台</h1>
          <div className="page-subtitle">需求漏斗 · 候选人画像匹配 · 履职表即题库 · AI 生成 JD 与面试题</div>
        </div>
        <Button type="primary" icon={<RobotOutlined />} style={{ background: 'var(--charcoal)' }} onClick={openJd}>AI 生成 JD</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '在招需求', value: reqs.length, sub: `急招 ${reqs.filter((r) => r.priority === 'high').length} 个岗位`, color: 'var(--ink)' },
          { label: '管道候选人', value: cands.filter((c) => !['rejected', 'onboard'].includes(c.stage)).length, sub: '不含已淘汰', color: 'var(--clay)' },
          { label: '待安排面试', value: cands.filter((c) => c.stage === 'screen').length, sub: '简历初筛中', color: 'var(--ochre)' },
          { label: 'Offer / 已入职', value: `${cands.filter((c) => c.stage === 'offer').length} / ${cands.filter((c) => c.stage === 'onboard').length}`, sub: '本季转化', color: 'var(--sage)' },
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

      {reqs.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="暂无在招需求" />
        </Card>
      ) : (
        <Row gutter={16}>
          <Col span={9}>
            <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="招聘漏斗（全部需求合计）">
              {funnel.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 40, fontSize: 12, color: 'var(--ink-2)' }}>{FUNNEL_LABEL[i]}</span>
                  <div style={{ width: `${Math.max(6, (v / maxF) * 100)}%`, height: 20, borderRadius: 5, background: `color-mix(in srgb, var(--clay) ${85 - i * 15}%, var(--clay-soft))`, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                    <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{v}</span>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                简历 → Offer 转化率 {maxF > 0 ? Math.round((funnel[4] / maxF) * 100) : 0}%
              </div>
            </Card>

            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="在招需求">
              <Table
                rowKey="id"
                dataSource={reqs}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '岗位',
                    render: (_: unknown, r: RequisitionOut) => (
                      <Space direction="vertical" size={0}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{r.position}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{DEPT_NAME_MAP[r.dept_id] ?? r.dept_id} · {r.grade} · 招 {r.headcount}</span>
                      </Space>
                    ),
                  },
                  {
                    title: '进度',
                    render: (_: unknown, r: RequisitionOut) => {
                      const p = Math.min(100, Math.round(((r.funnel[4] ?? 0) / r.headcount) * 100));
                      return <Progress type="circle" size={34} percent={p} strokeColor="var(--clay)" trailColor="var(--line)" />;
                    },
                  },
                  {
                    title: '优先级',
                    width: 64,
                    render: (_: unknown, r: RequisitionOut) =>
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

          <Col span={15}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="候选人看板（按阶段）">
              <Row gutter={10}>
                {ACTIVE_STAGES.map((st) => {
                  const list = cands.filter((c) => c.stage === st);
                  return (
                    <Col span={6} key={st}>
                      <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: 8, minHeight: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{STAGE_LABEL[st]}</span>
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
      )}
    </div>
  );
}
