import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Tooltip,
  message,
} from 'antd';
import {
  DeleteOutlined,
  FileTextOutlined,
  RobotOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { ApiError } from '@/api/client';
import { USE_MOCK } from '@/api/config';
import {
  APPLICATION_STATUS_META,
  SELF_LEVEL_META,
  applicationsApi,
  type ApplicationDetailDTO,
  type SelfLevelValue,
} from '@/api/applications';
import { useAuth } from '@/store/auth';
import { certByEmployee, CERT_MAIN_CHAIN, CERT_ROUTER_LABEL, CERT_STAGE_LABEL, type EvidenceStatus } from '@/mock/certifications';
import { employeeById } from '@/mock/people';

// ============ Mock 原型页（VITE_USE_MOCK=true 时保留） ============

const EVIDENCE_STATUS: Record<EvidenceStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '未开始', color: 'var(--ink-3)', bg: 'var(--surface-sunken)' },
  submitted: { label: '已提交 · 预审中', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  rejected: { label: '被驳回 · 已补交', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  approved: { label: '预审通过', color: 'var(--sage)', bg: 'var(--sage-soft)' },
};

function MockCertApply() {
  const persona = useAuth((s) => s.persona);
  const emp = employeeById(persona?.employeeId);
  const cert = emp ? certByEmployee(emp.id)[0] : undefined;
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus[]>(
    cert ? cert.evidences.map((e) => e.status) : [],
  );

  if (!cert || !emp) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Empty description="当前没有进行中的认证申请" />
      </div>
    );
  }

  const stageIdx = CERT_MAIN_CHAIN.indexOf(cert.stage);
  const doneCount = evidenceStatus.filter((s) => s === 'approved').length;

  const submit = (i: number) => {
    setEvidenceStatus((prev) => prev.map((s, idx) => (idx === i ? 'submitted' : s)));
    message.success('材料已提交，进入 AI 预检 + HR 预审队列');
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">认证申请与举证</h1>
          <div className="page-subtitle">
            {cert.id} · {cert.sequenceName} {cert.fromGrade} → {cert.toGrade} · 举证截止 {cert.deadline}
          </div>
        </div>
      </div>

      {/* 路由提示 */}
      <Alert
        style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}
        type="info"
        showIcon
        message={
          <span style={{ fontSize: 13 }}>
            评审路由：{cert.fromGrade}→{cert.toGrade} 由 <b>{CERT_ROUTER_LABEL[cert.router]}</b> 终审 ·
            述职答辩为最后一关：能力素质以关键行为举证 + 答辩评估，不以能力卡人
          </span>
        }
      />

      {/* 状态机步骤条 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <Steps
          size="small"
          current={stageIdx}
          percent={cert.stage === 'evidence' ? Math.round((doneCount / cert.evidences.length) * 100) : undefined}
          items={CERT_MAIN_CHAIN.map((st) => ({
            title: CERT_STAGE_LABEL[st],
            description:
              st === 'basic_check'
                ? '2026-09-03 通过'
                : st === 'exam'
                  ? `86 分（合格线 80）`
                  : st === 'routed_review'
                    ? CERT_ROUTER_LABEL[cert.router]
                    : undefined,
          }))}
        />
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          {/* 举证清单 */}
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={`履职举证（${doneCount}/${cert.evidences.length} 通过预审）`}
            extra={<span className="ai-badge"><RobotOutlined /> AI 预审已开启</span>}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {cert.evidences.map((ev, i) => {
                const st = EVIDENCE_STATUS[evidenceStatus[i]];
                return (
                  <div key={ev.name} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileTextOutlined style={{ color: 'var(--clay)' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{ev.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ev.task}</span>
                      <Tag style={{ borderRadius: 6, marginLeft: 'auto', borderColor: 'transparent', background: st.bg, color: st.color }}>{st.label}</Tag>
                      {evidenceStatus[i] === 'pending' && (
                        <Button size="small" icon={<UploadOutlined />} onClick={() => submit(i)}>
                          提交举证
                        </Button>
                      )}
                    </div>
                    {ev.materials.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ev.materials.map((m) => (
                          <Tooltip key={m} title="点击预览（原型模拟）">
                            <Tag style={{ borderRadius: 6, cursor: 'pointer', borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--ink-2)' }}>
                              <FileTextOutlined /> {m}
                            </Tag>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                    {ev.note && (
                      <div style={{ marginTop: 8, fontSize: 12, color: evidenceStatus[i] === 'rejected' ? 'var(--danger)' : 'var(--ink-3)' }}>
                        {ev.note}
                      </div>
                    )}
                    {ev.aiTip && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ochre)', background: 'var(--ochre-soft)', padding: '6px 10px', borderRadius: 8, display: 'inline-block' }}>
                        <RobotOutlined /> {ev.aiTip}
                      </div>
                    )}
                  </div>
                );
              })}
            </Space>
          </Card>

          {/* 驳回留痕 */}
          {cert.rejectHistory && cert.rejectHistory.length > 0 && (
            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="驳回与重提记录（留痕可审计）" size="small">
              <Timeline
                items={cert.rejectHistory.map((r) => ({
                  color: 'var(--danger)',
                  children: (
                    <>
                      <div style={{ fontSize: 13 }}>{r.reason}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.time} · {r.by} · 驳回原因必填并留痕</div>
                    </>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>

        <Col span={8}>
          {/* 测验成绩卡 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="知识测验" size="small">
            <div style={{ textAlign: 'center' }}>
              <div className="num" style={{ fontSize: 40, fontWeight: 700, color: 'var(--sage)' }}>{cert.examScore}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>合格线 80 · AI 组卷 40 题 · 一次通过</div>
              <Progress percent={cert.examScore} strokeColor="var(--sage)" showInfo={false} style={{ marginTop: 10 }} />
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10, textAlign: 'left', lineHeight: 2 }}>
                薄弱项：分布式系统基础（M1）——已自动生成 IDP 知识提升计划。
              </div>
            </div>
          </Card>

          {/* 基本条件校验结果 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="基本条件校验（规则引擎）" size="small">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {[
                ['学历：本科', true],
                ['司龄 4 年（要求满 1 年）', true],
                ['近一年绩效 B（要求 B 以上）', true],
                ['近两年含 A（P3→P4 附加）', true],
              ].map(([label]) => (
                <div key={String(label)} style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-2)' }}>{label}</span>
                  <span style={{ color: 'var(--sage)', fontWeight: 600 }}>✓</span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                硬校验由规则引擎执行，未达标将直接终止且不产生评审成本。
              </div>
            </Space>
          </Card>

          {/* 流程时间线 */}
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="流程留痕" size="small">
            <Timeline
              items={cert.timeline.map((t) => ({
                color: t.result === 'pass' ? 'var(--sage)' : t.result === 'doing' ? 'var(--clay)' : t.result === 'fail' ? 'var(--danger)' : 'var(--ink-4)',
                dot: t.result === 'doing' ? <span style={{ display: 'block', width: 10, height: 10, borderRadius: 5, background: 'var(--clay)' }} /> : undefined,
                children: (
                  <>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{CERT_STAGE_LABEL[t.stage]}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.8 }}>{t.note}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.time}</div>
                  </>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ============ 真实 API 模式 ============

const SELF_LEVEL_OPTIONS: Array<{ label: string; value: SelfLevelValue }> = [
  { label: '达到', value: 'met' },
  { label: '部分达到', value: 'partially_met' },
  { label: '未达到', value: 'not_met' },
];

const REJECT_CATEGORY_LABEL: Record<string, string> = {
  evidence_insufficient: '举证不足',
  self_assessment_mismatch: '自评与实际明显不符',
  ability_gap: '能力差距较大',
  tenure_not_ready: '历练不足',
  other: '其他',
};

const STEP_ITEMS = [
  { title: '填写履职表' },
  { title: '提交申请' },
  { title: '经理初审' },
  { title: '评审委员会' },
  { title: '终裁' },
  { title: 'HR 发布' },
];

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** 发起新申请：选序列与目标职级，后端做硬门槛校验 */
function ApplicationStarter() {
  const navigate = useNavigate();
  const [sequence, setSequence] = useState('SW');
  const [grade, setGrade] = useState('P3');
  const [loading, setLoading] = useState(false);
  const [fail, setFail] = useState<{ msg: string; details: unknown } | null>(null);

  const start = async () => {
    setLoading(true);
    setFail(null);
    try {
      const d = await applicationsApi.create(sequence, grade);
      message.success('已创建草稿，请逐项完成自评与举证');
      navigate(`/app/cert-apply?app=${d.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setFail({ msg: e.message, details: e.details });
      } else {
        throw e;
      }
    } finally {
      setLoading(false);
    }
  };

  const eligibilityRows = Array.isArray(fail?.details)
    ? (fail!.details as Array<{ rule: string; required: unknown; actual: unknown }>)
    : [];

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">发起认证申请</h1>
          <div className="page-subtitle">
            先过硬门槛，再填履职表与举证 · 提交时锁定整版标准快照
          </div>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
              认证序列
            </div>
            <Select
              value={sequence}
              onChange={setSequence}
              style={{ width: '100%' }}
              options={[{ value: 'SW', label: 'SW · 软件研发序列' }]}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
              目标职级
            </div>
            <Select
              value={grade}
              onChange={setGrade}
              style={{ width: '100%' }}
              options={[
                { value: 'P3', label: 'P3 · 经验层' },
                { value: 'P4', label: 'P4 · 骨干层' },
              ]}
            />
          </div>

          {fail && (
            <Alert
              type="error"
              showIcon
              message={fail.msg}
              description={
                eligibilityRows.length > 0 ? (
                  <Space direction="vertical" size={4}>
                    {eligibilityRows.map((r) => (
                      <span key={r.rule} style={{ fontSize: 12.5 }}>
                        {r.rule === 'min_years_in_grade'
                          ? `现职级任职年限不足：要求满 ${r.required} 年，实际约 ${r.actual} 年`
                          : r.rule === 'min_perf_grade'
                            ? `近一年绩效未达标：要求不低于 ${r.required}，实际为 ${r.actual}`
                            : `${r.rule}（要求 ${r.required}，实际 ${r.actual}）`}
                      </span>
                    ))}
                  </Space>
                ) : undefined
              }
            />
          )}

          <Button type="primary" loading={loading} onClick={start} block>
            创建申请草稿
          </Button>
          <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
            草稿不会通知任何人；提交后进入直属经理初审，评审开始前可撤回。
          </div>
        </Space>
      </Card>
    </div>
  );
}

interface FormRow {
  level?: SelfLevelValue;
  comment?: string;
}

function ApplicationEditor({ id }: { id: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ApplicationDetailDTO | null>(null);
  const [form, setForm] = useState<Record<string, FormRow>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [working, setWorking] = useState(false);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const d = await applicationsApi.get(id);
    setDetail(d);
    setForm(
      Object.fromEntries(
        d.self_assessments.map((a) => [
          a.standard_item_code,
          { level: a.self_level, comment: a.self_comment ?? '' },
        ]),
      ),
    );
  }, [id]);

  useEffect(() => {
    setLoadError(null);
    reload().catch((e: unknown) => {
      setLoadError(e instanceof ApiError ? e.message : '申请单加载失败');
    });
  }, [reload]);

  if (loadError) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert type="error" showIcon message="无法打开申请单" description={loadError} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  const meta = APPLICATION_STATUS_META[detail.status];
  const isDraft = detail.status === 'draft';
  const evidencesByCode = (code: string) =>
    detail.evidences.filter((e) => e.standard_item_code === code);

  const patchForm = (code: string, patch: FormRow) =>
    setForm((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const saveAssessments = async () => {
    const items = detail.standard_items
      .filter((i) => form[i.code]?.level)
      .map((i) => ({
        standard_item_code: i.code,
        self_level: form[i.code].level as SelfLevelValue,
        self_comment: form[i.code].comment?.trim() || null,
      }));
    if (items.length === 0) {
      message.warning('请先为至少一个标准项选择自评等级');
      return;
    }
    setSaving(true);
    try {
      await applicationsApi.saveAssessments(id, items);
      message.success('履职表已保存');
      await reload();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const missing = detail.standard_items
      .filter((i) => !form[i.code]?.level)
      .map((i) => i.code);
    if (missing.length > 0) {
      message.warning(`尚有 ${missing.length} 个标准项未完成自评：${missing.join('、')}`);
      return;
    }
    setSubmitting(true);
    try {
      // 提交前先保存最新自评，避免评语丢失
      await applicationsApi.saveAssessments(
        id,
        detail.standard_items.map((i) => ({
          standard_item_code: i.code,
          self_level: form[i.code].level as SelfLevelValue,
          self_comment: form[i.code].comment?.trim() || null,
        })),
      );
      await applicationsApi.submit(id);
      message.success('申请已提交，等待直属经理初审');
      await reload();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = async (code: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      message.error('单文件不得超过 10MB');
      return;
    }
    setUploadingCode(code);
    try {
      await applicationsApi.uploadEvidence(id, code, file);
      message.success('举证材料已上传');
      await reload();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    } finally {
      setUploadingCode(null);
    }
  };

  const removeEvidence = async (evidenceId: string) => {
    setWorking(true);
    try {
      await applicationsApi.deleteEvidence(evidenceId);
      message.success('已删除');
      await reload();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const withdraw = async () => {
    setWorking(true);
    try {
      await applicationsApi.withdraw(id);
      message.success('申请已撤回，可继续编辑后重新提交');
      await reload();
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
    } finally {
      setWorking(false);
    }
  };

  const resubmit = async () => {
    setWorking(true);
    try {
      const d = await applicationsApi.resubmit(id);
      message.success('已基于最新标准生成新申请，材料已复制');
      navigate(`/app/cert-apply?app=${d.id}`);
    } catch (e) {
      if (e instanceof ApiError) message.error(e.message);
      setWorking(false);
    }
  };

  const statusAlert = (() => {
    switch (detail.status) {
      case 'submitted':
        return (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="已提交，等待直属经理初审"
            description="初审开始前（状态仍为「已提交」）可以撤回申请；撤回不计入提交次数。"
          />
        );
      case 'in_manager_review':
        return (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="直属经理初审中"
            description="初审时限 7 天，进入评审后不可撤回。"
          />
        );
      case 'in_committee_review':
        return (
          <Alert
            type="info" showIcon style={{ marginBottom: 16 }}
            message="评审委员会评审中"
            description="1 名组长 + 2 名评委独立评审，评审意见对员工不可见。"
          />
        );
      case 'approved':
        return (
          <Alert
            type="success" showIcon style={{ marginBottom: 16 }}
            message="终审通过 · 等待 HR 发布"
            description="HR 发布后职级正式生效。"
          />
        );
      case 'published':
        return (
          <Alert
            type="success" showIcon style={{ marginBottom: 16 }}
            message="认证已发布，职级已生效"
          />
        );
      case 'rejected': {
        const cat = detail.manager_review?.reject_category;
        return (
          <Alert
            type="error" showIcon style={{ marginBottom: 16 }}
            message={
              cat
                ? `申请未通过：${REJECT_CATEGORY_LABEL[cat] ?? cat}`
                : '申请未通过'
            }
            description={
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {detail.manager_review?.comment && (
                  <span style={{ fontSize: 12.5 }}>{detail.manager_review.comment}</span>
                )}
                <Button size="small" type="primary" ghost loading={working} onClick={resubmit}>
                  基于最新标准重新提交（自动复制材料）
                </Button>
              </Space>
            }
          />
        );
      }
      default:
        return null;
    }
  })();

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">认证申请与举证</h1>
          <div className="page-subtitle">
            {detail.target_sequence} 序列 · 目标职级 {detail.target_grade}
            {detail.submitted_at &&
              ` · 提交于 ${detail.submitted_at.slice(0, 10)}`}
          </div>
        </div>
        <Tag
          style={{
            borderRadius: 6,
            background: meta.bg,
            color: meta.color,
            borderColor: 'transparent',
          }}
        >
          {meta.label}
        </Tag>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <Steps
          size="small"
          current={meta.step}
          status={detail.status === 'rejected' ? 'error' : undefined}
          items={STEP_ITEMS}
        />
      </Card>

      {statusAlert}

      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {[...detail.standard_items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => {
            const row = form[item.code] ?? {};
            const files = evidencesByCode(item.code);
            return (
              <Card
                key={item.code}
                variant="borderless"
                style={{ background: 'var(--surface)' }}
                styles={{ body: { padding: 18 } }}
                title={
                  <Space>
                    <FileTextOutlined style={{ color: 'var(--clay)' }} />
                    <span style={{ fontSize: 14, fontWeight: 650 }}>{item.name}</span>
                    <Tag style={{ borderRadius: 6 }}>{item.code}</Tag>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      权重 {item.weight}%
                    </span>
                  </Space>
                }
              >
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.9, marginBottom: 12 }}>
                  <div>{item.description}</div>
                  <div style={{ color: 'var(--ink-3)' }}>达标要求：{item.requirement}</div>
                </div>

                <Radio.Group
                  disabled={!isDraft}
                  options={SELF_LEVEL_OPTIONS}
                  value={row.level}
                  onChange={(e) =>
                    patchForm(item.code, { level: e.target.value as SelfLevelValue })
                  }
                  optionType="button"
                  buttonStyle="solid"
                  style={{ marginBottom: 10 }}
                />
                {row.level && (
                  <Tag
                    style={{
                      marginLeft: 10,
                      borderRadius: 6,
                      borderColor: 'transparent',
                      color: SELF_LEVEL_META[row.level].color,
                      background: 'var(--surface-sunken)',
                    }}
                  >
                    自评：{SELF_LEVEL_META[row.level].label}
                  </Tag>
                )}

                <Input.TextArea
                  disabled={!isDraft}
                  rows={2}
                  maxLength={1000}
                  showCount
                  placeholder="用关键事件 / 数据说明你的达成情况（建议 STAR：情境-任务-行动-结果）"
                  value={row.comment ?? ''}
                  onChange={(e) => patchForm(item.code, { comment: e.target.value })}
                />

                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {isDraft && (
                    <label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onFile(item.code, f);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        size="small"
                        icon={<UploadOutlined />}
                        loading={uploadingCode === item.code}
                      >
                        上传举证（jpg/png/pdf）
                      </Button>
                    </label>
                  )}
                  {files.map((f) => (
                    <Tag
                      key={f.id}
                      style={{
                        borderRadius: 6,
                        borderColor: 'var(--line)',
                        background: 'var(--surface-sunken)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <FileTextOutlined /> {f.file_name} · {formatSize(f.size_bytes)}
                      {isDraft && (
                        <DeleteOutlined
                          style={{ marginLeft: 6, color: 'var(--danger)', cursor: 'pointer' }}
                          onClick={() => void removeEvidence(f.id)}
                        />
                      )}
                    </Tag>
                  ))}
                </div>
              </Card>
            );
          })}
      </Space>

      {isDraft && (
        <Card
          variant="borderless"
          style={{ background: 'var(--surface)', marginTop: 16, position: 'sticky', bottom: 16 }}
        >
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate('/app/my-cert')}>取消</Button>
            <Button loading={saving} onClick={saveAssessments}>
              保存履职表
            </Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              提交申请
            </Button>
          </Space>
        </Card>
      )}

      {detail.status === 'submitted' && (
        <Card
          variant="borderless"
          style={{ background: 'var(--surface)', marginTop: 16 }}
        >
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Popconfirm
              title="撤回该申请？"
              description="撤回后回到草稿，不计入提交次数。"
              onConfirm={withdraw}
              okButtonProps={{ loading: working }}
            >
              <Button danger loading={working}>撤回申请</Button>
            </Popconfirm>
          </Space>
        </Card>
      )}
    </div>
  );
}

function RealCertApply() {
  const [params] = useSearchParams();
  const appId = params.get('app');
  return appId ? <ApplicationEditor id={appId} /> : <ApplicationStarter />;
}

export function CertApply() {
  return USE_MOCK ? <MockCertApply /> : <RealCertApply />;
}
