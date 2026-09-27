import { useMemo, useState } from 'react';
import { Button, Card, Col, Progress, Row, Select, Space, Tag, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { positions } from '@/mock/org';
import { corePositions, successionCandidates, WILLINGNESS_LABEL, READINESS_LABEL } from '@/mock/succession';

const WILLINGNESS_COLOR = { unconfirmed: 'var(--ink-4)', willing: 'var(--sage)', unwilling: 'var(--danger)' };
const READINESS_COLOR = { ready: 'var(--sage)', '6m': 'var(--teal)', '1y': 'var(--ochre)', '2y': 'var(--ink-4)' };

export function SuccessionMatrix() {
  const [params] = useSearchParams();
  const cores = useMemo(() => corePositions(), []);
  const [posId, setPosId] = useState(params.get('id') ?? cores[0]?.id);
  const pos = positions.find((p) => p.id === posId);
  const core = cores.find((c) => c.id === posId);
  const candidates = useMemo(() => successionCandidates(posId ?? ''), [posId]);

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">继任矩阵图谱</h1>
          <div className="page-subtitle">核心岗位 × 候选人匹配矩阵 · 匹配度/意愿/就绪度</div>
        </div>
        <Select
          value={posId}
          onChange={setPosId}
          style={{ width: 280 }}
          options={cores.map((c) => ({ value: c.id, label: `${c.name} · ${c.deptName}` }))}
        />
      </div>

      {pos && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
          <Row gutter={24}>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>岗位</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{pos.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{pos.grade} · 编制 {pos.headcount}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>在岗人</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{core?.incumbentName ?? '空缺'}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>候选人数</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{candidates.length}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>继任覆盖率</div>
              <Progress percent={Math.round((core?.coverage ?? 0) * 100)} strokeColor="var(--sage)" showInfo={false} />
            </Col>
          </Row>
        </Card>
      )}

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="候选人匹配矩阵" size="small">
        {candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
            暂无合格候选人，建议启动外部招聘或扩大候选池
            <div style={{ marginTop: 12 }}>
              <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.info('已发起外部招聘需求')}>外部招聘</Button>
            </div>
          </div>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {candidates.map((c, i) => (
              <div
                key={c.employeeId}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: i === 0 ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                  border: i === 0 ? '1px solid var(--clay)' : '1px solid var(--line)',
                }}
              >
                <Row gutter={12} align="middle">
                  <Col span={6}>
                    <Space size={10}>
                      <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{c.name[0]}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.name} {i === 0 && <Tag color="red" style={{ borderRadius: 6, marginInlineStart: 4 }}>首选</Tag>}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.position}</div>
                      </div>
                    </Space>
                  </Col>
                  <Col span={5}>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>匹配度</div>
                    <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{c.matchScore}</div>
                    <Progress percent={c.matchScore} size="small" strokeColor="var(--clay)" showInfo={false} />
                  </Col>
                  <Col span={5}>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>意愿</div>
                    <Tag style={{ borderRadius: 6, background: WILLINGNESS_COLOR[c.willingness] + '22', color: WILLINGNESS_COLOR[c.willingness], borderColor: 'transparent' }}>
                      {WILLINGNESS_LABEL[c.willingness]}
                    </Tag>
                  </Col>
                  <Col span={5}>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>就绪度</div>
                    <Tag style={{ borderRadius: 6, background: READINESS_COLOR[c.readiness] + '22', color: READINESS_COLOR[c.readiness], borderColor: 'transparent' }}>
                      {READINESS_LABEL[c.readiness]}
                    </Tag>
                  </Col>
                  <Col span={3} style={{ textAlign: 'right' }}>
                    <Space>
                      <Button size="small" onClick={() => message.success('已发送意愿确认邀请')}>确认意愿</Button>
                    </Space>
                  </Col>
                </Row>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>匹配依据：{c.matchSummary}</div>
              </div>
            ))}
          </Space>
        )}
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="补位规则" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
          <li>关键岗位 7–15 条能力模型，半年盘点一次</li>
          <li>候选人需通过知识考试 + 意愿确认方可正式入池</li>
          <li>高风险岗位启动「72 小时补位」机制</li>
          <li>首选候选人匹配度 ≥ 80 且愿意且就绪度 ready/6m</li>
        </ul>
      </Card>
    </div>
  );
}
