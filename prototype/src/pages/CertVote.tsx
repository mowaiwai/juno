import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Radio,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { certifications, type CertRecord, type VoteItem } from '@/mock/certifications';
import { employeeById } from '@/mock/people';
import { deptName } from '@/mock/org';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import { reviewApi, type ReviewTaskDTO } from '@/api/review';
import { leadApi } from '@/api/finalize';
import {
  applicationsApi,
  type ApplicationDetailDTO,
} from '@/api/applications';
import { ApplicationMaterial } from '@/components/ApplicationMaterial';

// ============ Mock 原型页 ============

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

function MockCertVote() {
  const activeRole = useAuth((s) => s.activeRole);
  const persona = useAuth((s) => s.persona);
  const isCommittee = activeRole === 'committee';

  /** 本地表决状态：recordId → votes（mock 交互） */
  const [votesById, setVotesById] = useState<Record<string, VoteItem[]>>(
    Object.fromEntries(certifications.map((c) => [c.id, c.votes ?? []])),
  );
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
    message.success('表决已提交，结果留痕');
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">认证小组 · 答辩表决</h1>
          <div className="page-subtitle">原型 mock 模式：模拟小组评审表决流程</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="待表决" value={defenseRecords.filter((r) => myVoteIndex(r) >= 0).length} /></Card></Col>
        <Col span={8}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="已表决" value={historyRows.length} /></Card></Col>
        <Col span={8}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="已终审落库" value={0} valueStyle={{ color: 'var(--sage)' }} /></Card></Col>
      </Row>

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
                    {emp && deptName(emp.deptId)} · {rec.sequence}-{rec.fromGrade}→{rec.toGrade}
                  </span>
                </Space>
              }
            >
              <div style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
                实时票型 · {stats.done}/{stats.total} 已表决 · 同意 {stats.agree} · 反对 {stats.disagree}
              </div>
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
                    </div>
                  </Col>
                ))}
              </Row>

              <div style={{ marginTop: 16, borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
                {myIdx >= 0 ? (
                  <Space>
                    <Button type="primary" style={{ background: 'var(--sage)', borderColor: 'var(--sage)' }} onClick={() => { setPendingRec(rec); setPendingChoice('agree'); setCommentOpen(true); }}>
                      同意通过
                    </Button>
                    <Button danger onClick={() => { setPendingRec(rec); setPendingChoice('disagree'); setCommentOpen(true); }}>
                      不同意
                    </Button>
                  </Space>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>等待其他成员表决中…</span>
                )}
              </div>
            </Card>
          );
        })}
      </Space>

      <Input.TextArea
        style={{ display: 'none' }}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {commentOpen && (
        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>{pendingChoice === 'agree' ? '确认同意通过' : '确认不同意'}</div>
            <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="表决意见" />
            <Space>
              <Button onClick={() => setCommentOpen(false)}>取消</Button>
              <Button type="primary" onClick={castVote}>提交表决</Button>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
}

// ============ 真实 API：评委意见 + 组长终裁 ============

interface PanelWorkspace {
  task: ReviewTaskDTO;
  detail: ApplicationDetailDTO;
}

function ReviewWorkspaceCard({
  workspace,
  myEmployeeId,
  onChanged,
}: {
  workspace: PanelWorkspace;
  myEmployeeId: string;
  onChanged: () => Promise<void>;
}) {
  const { task, detail } = workspace;
  const [opinionText, setOpinionText] = useState(task.opinion ?? '');
  const [busy, setBusy] = useState(false);

  const iHoldLock = task.locked_by === myEmployeeId;
  const lockHeldElse = task.locked_by !== null && !iHoldLock;

  const errMsg = (e: unknown, fallback: string) =>
    e instanceof ApiError ? e.message : fallback;

  const claim = async () => {
    setBusy(true);
    try {
      await reviewApi.claim(task.id);
      message.success('已认领，申请已被你锁定（默认 30 分钟）');
      await onChanged();
    } catch (e) {
      message.error(errMsg(e, '认领失败'));
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      await reviewApi.release(task.id);
      message.success('已释放锁');
      await onChanged();
    } catch (e) {
      message.error(errMsg(e, '释放失败'));
    } finally {
      setBusy(false);
    }
  };

  const submitOpinion = async () => {
    const text = opinionText.trim();
    if (!text) {
      message.warning('评审意见不能为空');
      return;
    }
    setBusy(true);
    try {
      await reviewApi.submitOpinion(task.id, text);
      message.success('评审意见已提交，不可修改，锁已释放');
      await onChanged();
    } catch (e) {
      message.error(errMsg(e, '意见提交失败'));
    } finally {
      setBusy(false);
    }
  };

  let lockBanner: React.ReactNode;
  if (task.submitted_at) {
    lockBanner = (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        style={{ marginBottom: 14 }}
        message="评审意见已提交（不可修改）"
      />
    );
  } else if (iHoldLock) {
    lockBanner = (
      <Alert
        type="warning"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 14 }}
        message="你已持锁，可开始评审"
        description="提交意见后自动释放锁；也可手动释放供他人认领。"
      />
    );
  } else if (lockHeldElse) {
    lockBanner = (
      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 14 }}
        message="申请正由其他成员评审（申请级锁）"
        description={
          task.locked_until
            ? `锁至 ${task.locked_until.slice(0, 16).replace('T', ' ')}，超时自动释放`
            : '请稍后再试'
        }
      />
    );
  } else {
    lockBanner = (
      <Alert
        type="info"
        showIcon
        icon={<UnlockOutlined />}
        style={{ marginBottom: 14 }}
        message="申请当前未锁定"
        action={
          <Button size="small" type="primary" loading={busy} onClick={() => void claim()}>
            开始评审（认领）
          </Button>
        }
      />
    );
  }

  const canEdit = !task.submitted_at && iHoldLock;

  return (
    <Card
      variant="borderless"
      style={{ background: 'var(--surface)' }}
      title={
        <Space wrap>
          <Tag
            style={{
              borderRadius: 6,
              background:
                task.role === 'lead' ? 'var(--clay-soft)' : 'var(--ochre-soft)',
              color: task.role === 'lead' ? 'var(--clay)' : 'var(--ochre)',
              borderColor: 'transparent',
            }}
          >
            {task.role === 'lead' ? '评审组长' : '评审委员'}
          </Tag>
          <span style={{ fontWeight: 650 }}>
            {detail.target_sequence} 序列 · 目标职级 {detail.target_grade}
          </span>
        </Space>
      }
    >
      {lockBanner}

      <ApplicationMaterial detail={detail} />

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px dashed var(--line)',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
          我的评审意见（提交后不可修改）
        </div>
        <Input.TextArea
          rows={4}
          maxLength={2000}
          showCount
          disabled={!canEdit}
          value={opinionText}
          onChange={(e) => setOpinionText(e.target.value)}
          placeholder="结合标准项自评与举证给出独立评审意见；意见对员工不可见，仅评审组内可见"
        />
        <Space style={{ marginTop: 10 }}>
          {canEdit && (
            <>
              <Button
                type="primary"
                loading={busy}
                onClick={() => void submitOpinion()}
              >
                提交评审意见
              </Button>
              <Button loading={busy} onClick={() => void release()}>
                释放锁
              </Button>
            </>
          )}
        </Space>
      </div>
    </Card>
  );
}

function LeadDecisionCard({
  workspace,
  myEmployeeId,
  onChanged,
}: {
  workspace: PanelWorkspace;
  myEmployeeId: string;
  onChanged: () => Promise<void>;
}) {
  const { task, detail } = workspace;
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const iHoldLock = task.locked_by === myEmployeeId;
  const lockHeldElse = task.locked_by !== null && !iHoldLock;

  const claim = async () => {
    setBusy(true);
    try {
      await reviewApi.claim(task.id);
      message.success('已认领，申请已被你锁定');
      await onChanged();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '认领失败');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      await reviewApi.release(task.id);
      message.success('已释放锁');
      await onChanged();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '释放失败');
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async () => {
    if (!comment.trim()) {
      message.warning('终裁必须填写意见说明');
      return;
    }
    setBusy(true);
    try {
      await leadApi.decide(detail.id, {
        decision,
        comment: comment.trim(),
        interview_notes: interviewNotes.trim() || null,
      });
      message.success(
        decision === 'approved'
          ? '终裁通过，等待 HR 发布'
          : '终裁驳回，已通知员工',
      );
      await onChanged();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '终裁失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      variant="borderless"
      style={{ background: 'var(--surface)' }}
      title={
        <Space>
          <Tag
            style={{
              borderRadius: 6,
              background: 'var(--clay-soft)',
              color: 'var(--clay)',
              borderColor: 'transparent',
            }}
          >
            组长终裁
          </Tag>
          <span style={{ fontWeight: 650 }}>
            {detail.target_sequence} → {detail.target_grade}
          </span>
        </Space>
      }
    >
      {task.submitted_at && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 14 }}
          message="你已提交过评审意见（不可修改）"
        />
      )}

      {iHoldLock ? (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 14 }}
          message="你已持锁，可进行终裁"
          description="终裁提交后流程结束（通过则等 HR 发布），锁自动释放。"
        />
      ) : lockHeldElse ? (
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 14 }}
          message="申请正由其他成员评审，请等待锁释放"
        />
      ) : (
        <Alert
          type="info"
          showIcon
          icon={<UnlockOutlined />}
          style={{ marginBottom: 14 }}
          message="终裁需先认领带锁"
          action={
            <Button size="small" type="primary" loading={busy} onClick={() => void claim()}>
              认领并开始终裁
            </Button>
          }
        />
      )}

      <ApplicationMaterial detail={detail} />

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px dashed var(--line)',
        }}
      >
        <Radio.Group
          value={decision}
          disabled={!iHoldLock}
          onChange={(e) => setDecision(e.target.value)}
          style={{ marginBottom: 12 }}
          options={[
            { label: '终裁通过', value: 'approved' },
            { label: '终裁驳回', value: 'rejected' },
          ]}
          optionType="button"
          buttonStyle="solid"
        />
        <Input.TextArea
          rows={3}
          maxLength={2000}
          showCount
          disabled={!iHoldLock}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="终裁意见（必填）：综合举证与评审情况说明结论依据；提交后对员工仅可见结果值"
        />
        <Input.TextArea
          rows={2}
          maxLength={2000}
          style={{ marginTop: 10 }}
          disabled={!iHoldLock}
          value={interviewNotes}
          onChange={(e) => setInterviewNotes(e.target.value)}
          placeholder="面试 / 答辩记录（选填，仅内部留档）"
        />
        <Space style={{ marginTop: 12 }}>
          {iHoldLock && (
            <>
              <Button type="primary" loading={busy} onClick={() => void submitDecision()}>
                提交终裁
              </Button>
              <Button loading={busy} onClick={() => void release()}>
                释放锁
              </Button>
            </>
          )}
        </Space>
      </div>
    </Card>
  );
}

function RealPanelPage() {
  const persona = useAuth((s) => s.persona);
  const [tasks, setTasks] = useState<ReviewTaskDTO[] | null>(null);
  const [details, setDetails] = useState<Record<string, ApplicationDetailDTO>>({});

  const load = useCallback(async () => {
    setTasks(null);
    const list = await reviewApi.tasks();
    setTasks(list);
    const entries = await Promise.all(
      list.map(async (t) => [t.application_id, await applicationsApi.get(t.application_id)] as const),
    );
    setDetails(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load().catch((e: unknown) => {
      message.error(e instanceof ApiError ? e.message : '评审任务加载失败');
      setTasks([]);
    });
  }, [load]);

  if (!persona) return null;
  const myEmployeeId = persona.employeeId;
  if (!myEmployeeId) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="当前账号缺少员工档案，无法参与评审" />
        </Card>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="当前没有派给你的评审任务（终态单不在工作台显示）" />
        </Card>
      </div>
    );
  }

  const workspaces: PanelWorkspace[] = tasks
    .map((task) => {
      const detail = details[task.application_id];
      return detail ? { task, detail } : null;
    })
    .filter((w): w is PanelWorkspace => w !== null);

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">评审工作台</h1>
          <div className="page-subtitle">
            申请级悲观锁：认领 → 评审 / 终裁 → 提交即释放 ·
            意见提交不可修改
          </div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="我的评审任务" value={workspaces.length} />
          </Card>
        </Col>
        <Col span={12}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic
              title="其中组长终裁任务"
              value={workspaces.filter((w) => w.task.role === 'lead').length}
            />
          </Card>
        </Col>
      </Row>

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {workspaces.map((w) =>
          w.task.role === 'lead' ? (
            <LeadDecisionCard
              key={w.task.id}
              workspace={w}
              myEmployeeId={myEmployeeId}
              onChanged={load}
            />
          ) : (
            <ReviewWorkspaceCard
              key={w.task.id}
              workspace={w}
              myEmployeeId={myEmployeeId}
              onChanged={load}
            />
          ),
        )}
      </Space>
    </div>
  );
}

function RealCertVote() {
  const persona = useAuth((s) => s.persona);
  if (persona?.defaultRole !== 'cert_panel') {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="当前角色无评审任务（仅评审委员与评审组长可访问）" />
        </Card>
      </div>
    );
  }
  return <RealPanelPage />;
}

export function CertVote() {
  return USE_MOCK ? <MockCertVote /> : <RealCertVote />;
}
