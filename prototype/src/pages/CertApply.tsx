import { useState } from 'react';
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Steps, Tag, Timeline, Tooltip, message } from 'antd';
import { FileTextOutlined, RobotOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { certByEmployee, CERT_MAIN_CHAIN, CERT_ROUTER_LABEL, CERT_STAGE_LABEL, type EvidenceStatus } from '@/mock/certifications';
import { employeeById } from '@/mock/people';

const EVIDENCE_STATUS: Record<EvidenceStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '未开始', color: 'var(--ink-3)', bg: 'var(--surface-sunken)' },
  submitted: { label: '已提交 · 预审中', color: 'var(--ochre)', bg: 'var(--ochre-soft)' },
  rejected: { label: '被驳回 · 已补交', color: 'var(--danger)', bg: 'var(--danger-soft)' },
  approved: { label: '预审通过', color: 'var(--sage)', bg: 'var(--sage-soft)' },
};

export function CertApply() {
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
