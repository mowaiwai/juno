import { useState } from 'react';
import { Card, Col, Empty, Input, message, Modal, Progress, Row, Space, Statistic, Table, Tag, Button } from 'antd';
import { useAuth } from '@/store/auth';
import { certifications, CERT_MAIN_CHAIN, CERT_ROUTER_LABEL, CERT_STAGE_LABEL, type CertRecord, type VoteItem } from '@/mock/certifications';
import { employeeById } from '@/mock/people';
import { deptName } from '@/mock/org';

/** 表决进度：x/y 已表决 */
function voteStats(votes: VoteItem[]) {
  const done = votes.filter((v) => v.choice !== null);
  return {
    done: done.length,
    total: votes.length,
    agree: done.filter((v) => v.choice === 'agree').length,
    disagree: done.filter((v) => v.choice === 'disagree').length,
  };
}

export function CertVote() {
  const activeRole = useAuth((s) => s.activeRole);
  const persona = useAuth((s) => s.persona);
  const isCommittee = activeRole === 'committee';

  /** 本地表决状态：recordId → votes（mock 交互） */
  const [votesById, setVotesById] = useState<Record<string, VoteItem[]>>(
    Object.fromEntries(certifications.map((c) => [c.id, c.votes ?? []])),
  );
  const [finalized, setFinalized] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<'agree' | 'disagree' | null>(null);
  const [pendingRec, setPendingRec] = useState<CertRecord | null>(null);

  const empName = (id: string) => employeeById(id)?.name ?? id;

  /** 当前 persona 在某单中的表决位（原型简化：按成员名匹配 persona.name） */
  const myVoteIndex = (rec: CertRecord) =>
    (votesById[rec.id] ?? []).findIndex((v) => v.member === persona?.name && v.choice === null);

  const defenseRecords = certifications.filter(
    (c) => c.stage === 'defense' && (isCommittee ? c.router === 3 : c.router === 2),
  );

  const historyRows = Object.entries(votesById)
    .flatMap(([recId, votes]) => {
      const rec = certifications.find((c) => c.id === recId);
      if (!rec) return [];
      return votes.filter((v) => v.choice !== null && v.member === persona?.name).map((v) => ({ ...v, rec }));
    });

  const castVote = () => {
    if (!pendingRec || !pendingChoice) return;
    if (pendingChoice === 'disagree' && !comment.trim()) {
      message.warning('不同意必须填写表决意见（留痕可审计）');
      return;
    }
    setVotesById((prev) => ({
      ...prev,
      [pendingRec.id]: prev[pendingRec.id].map((v) =>
        v.member === persona?.name && v.choice === null ? { ...v, choice: pendingChoice, comment: comment || undefined } : v,
      ),
    }));
    setCommentOpen(false);
    setComment('');
    message.success('表决已提交，结果留痕（仅管委会终审可落库）');
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">{isCommittee ? '管委会终审 · 答辩表决' : '认证小组 · 答辩表决'}</h1>
          <div className="page-subtitle">
            {isCommittee
              ? 'P3→P4 / P4→P5 由管委会评审终审，表决结果留痕、终审落库生效'
              : 'P2→P3 由认证小组（3–5 位相关部门经理）评审表决，只评审不落库'}
          </div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title={isCommittee ? '待终审' : '待我表决'} value={defenseRecords.filter((r) => myVoteIndex(r) >= 0).length} valueStyle={{ color: 'var(--clay)' }} /></Card></Col>
        <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="本季已表决" value={historyRows.length} /></Card></Col>
        <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="已终审落库" value={finalized.length} valueStyle={{ color: 'var(--sage)' }} /></Card></Col>
        <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="流程环节" value="答辩表决" suffix={`/ ${CERT_MAIN_CHAIN.length}`} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col span={15}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {defenseRecords.length === 0 && <Card variant="borderless" style={{ background: 'var(--surface)' }}><Empty description="当前没有待表决的答辩" /></Card>}
            {defenseRecords.map((rec) => {
              const votes = votesById[rec.id];
              const stats = voteStats(votes);
              const myIdx = myVoteIndex(rec);
              const emp = employeeById(rec.employeeId);
              return (
                <Card
                  key={rec.id}
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title={
                    <Space wrap>
                      <span style={{ fontWeight: 700 }}>{empName(rec.employeeId)}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                        {emp && deptName(emp.deptId)} · {rec.sequence}-{rec.fromGrade}→{rec.toGrade} · {rec.certType}
                      </span>
                      <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                        {CERT_STAGE_LABEL[rec.stage]} · {CERT_ROUTER_LABEL[rec.router]}
                      </Tag>
                    </Space>
                  }
                  extra={<Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'transparent', background: 'var(--surface-sunken)', color: 'var(--ink-3)' }}>{rec.id}</Tag>}
                >
                  {/* 举证与测验摘要 */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 260, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>举证摘要（全部预审通过）</div>
                      {rec.evidences.map((ev) => (
                        <div key={ev.name} style={{ fontSize: 12.5, lineHeight: 2 }}>
                          ✓ <b>{ev.name}</b> — {ev.note ?? ev.task}
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 10, background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>知识测验</div>
                      <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{rec.examScore}<span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400 }}> 分</span></div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>合格线 80 · AI 组卷</div>
                    </div>
                  </div>

                  {/* 答辩记录 */}
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--ochre-soft)', marginBottom: 14, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.9 }}>
                    <b>答辩记录（{rec.initiatedAt.slice(0, 4)}-{rec.id.slice(-4)} 场次）：</b>
                    能力素质以关键行为举证 + 答辩评估；原则不以能力卡人，仅存在负面行为时不通过。
                    {rec.employeeId === 'E10091' && ' 本场答辩：候选人完整陈述模块设计取舍，对「高并发场景」追问回答层次清晰，但分布式纵深偏弱。'}
                    {rec.employeeId === 'E10104' && ' 本场答辩：降本专项数据链完整，试产问题闭环方法论有可迁移价值，委员会问询均正面回应。'}
                  </div>

                  {/* 实时票型 */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--ink-3)' }}>实时票型 · {stats.done}/{stats.total} 已表决</span>
                      <span className="num" style={{ color: 'var(--sage)' }}>同意 {stats.agree} · 反对 {stats.disagree}</span>
                    </div>
                    <Progress
                      percent={(stats.agree / Math.max(1, stats.total)) * 100}
                      success={{ percent: (stats.agree / Math.max(1, stats.total)) * 100, strokeColor: 'var(--sage)' }}
                      strokeColor="var(--danger)"
                      showInfo={false}
                      size={['100%', 10] as never}
                    />
                  </div>

                  {/* 成员表决格 */}
                  <Row gutter={[8, 8]}>
                    {votes.map((v) => (
                      <Col span={8} key={v.member}>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: v.choice === null ? '1px dashed var(--line-strong)' : v.choice === 'agree' ? '1px solid var(--sage)' : '1px solid var(--danger)',
                            background: v.choice === null ? 'var(--surface-sunken)' : v.choice === 'agree' ? 'var(--sage-soft)' : 'var(--danger-soft)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <b>{v.member}</b>
                            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v.memberTitle}</span>
                          </div>
                          <div style={{ fontSize: 12, marginTop: 4, color: v.choice === 'agree' ? 'var(--sage)' : v.choice === 'disagree' ? 'var(--danger)' : 'var(--ink-4)' }}>
                            {v.choice === 'agree' ? '✓ 同意' : v.choice === 'disagree' ? '✗ 不同意' : '待表决'}
                          </div>
                          {v.comment && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{v.comment}</div>}
                        </div>
                      </Col>
                    ))}
                  </Row>

                  {/* 我的表决 / 终审落库 */}
                  <div style={{ marginTop: 16, borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
                    {myIdx >= 0 ? (
                      <Space>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>我的表决：</span>
                        <Button type="primary" style={{ background: 'var(--sage)', borderColor: 'var(--sage)' }} onClick={() => { setPendingRec(rec); setPendingChoice('agree'); setCommentOpen(true); }}>
                          同意通过
                        </Button>
                        <Button danger onClick={() => { setPendingRec(rec); setPendingChoice('disagree'); setCommentOpen(true); }}>
                          不同意
                        </Button>
                      </Space>
                    ) : finalized.includes(rec.id) ? (
                      <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>管委会终审通过 · 已落库生效，职级与薪酬联动回写画像</Tag>
                    ) : stats.done === stats.total ? (
                      isCommittee ? (
                        <Space>
                          <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>表决完成：{stats.agree}/{stats.total} 同意</Tag>
                          <Button
                            type="primary"
                            style={{ background: 'var(--charcoal)' }}
                            onClick={() => { setFinalized((p) => [...p, rec.id]); message.success('终审落库：认证记录写入，画像职级联动更新，进入公示'); }}
                          >
                            终审落库生效
                          </Button>
                        </Space>
                      ) : (
                        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
                          表决完成：{stats.agree}/{stats.total} 同意 · 结果已提交 HR，仅管委会终审可落库
                        </Tag>
                      )
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>等待其他成员表决中…（你的表决已完成）</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </Space>
        </Col>

        <Col span={9}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="路由规则" size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {[
                { level: 'P1→P2', who: '部门经理单审', color: 'var(--teal)' },
                { level: 'P2→P3', who: '认证小组（3–5 位部门经理）表决', color: 'var(--ochre)' },
                { level: 'P3→P4 / P4→P5', who: '任职资格管理委员会终审', color: 'var(--clay)' },
              ].map((r) => (
                <div key={r.level} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                  <span className="num" style={{ fontWeight: 700, color: r.color, marginRight: 10 }}>{r.level}</span>
                  <span style={{ fontSize: 12.5 }}>{r.who}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 2 }}>
                评审角色与审批角色分离；表决结果留痕但仅管委会终审可落库生效。通过后更新画像职级与认证记录。
              </div>
            </Space>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="我的表决历史（留痕）" size="small">
            <Table
              size="small"
              rowKey={(r) => `${r.rec.id}-${r.member}`}
              dataSource={historyRows}
              pagination={false}
              locale={{ emptyText: '暂无表决记录' }}
              columns={[
                { title: '认证单', render: (_: unknown, r) => <span style={{ fontSize: 12 }}>{r.rec.id.slice(-4)} · {empName(r.rec.employeeId)}</span> },
                { title: '结论', render: (_: unknown, r) => <Tag style={{ borderRadius: 6, fontSize: 11, borderColor: 'transparent', background: r.choice === 'agree' ? 'var(--sage-soft)' : 'var(--danger-soft)', color: r.choice === 'agree' ? 'var(--sage)' : 'var(--danger)' }}>{r.choice === 'agree' ? '同意' : '反对'}</Tag> },
                { title: '意见', dataIndex: 'comment', render: (c?: string) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c ?? '—'}</span> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={`确认表决：${pendingChoice === 'agree' ? '同意通过' : '不同意'}`}
        open={commentOpen}
        onCancel={() => setCommentOpen(false)}
        onOk={castVote}
        okText="提交表决"
      >
        <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--ink-2)' }}>
          {pendingRec && <>对 {empName(pendingRec.employeeId)} 的 {pendingRec.sequence}-{pendingRec.fromGrade}→{pendingRec.toGrade} 认证答辩表决。</>}
          {pendingChoice === 'disagree' && <span style={{ color: 'var(--danger)' }}> 不同意必须填写改进意见，将回写员工画像。</span>}
        </div>
        <Input.TextArea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={pendingChoice === 'agree' ? '表决意见（选填）' : '改进意见（必填）'}
        />
      </Modal>
    </div>
  );
}
