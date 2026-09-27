import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Input, Modal, Row, Space, Statistic, Table, Tag, message } from 'antd';
import { AuditOutlined, RobotOutlined } from '@ant-design/icons';
import { useAuth, useDataScope } from '@/store/auth';
import { certifications, CERT_ROUTER_LABEL, CERT_STAGE_LABEL, type CertRecord } from '@/mock/certifications';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';

export function CertReview() {
  const activeRole = useAuth((s) => s.activeRole);
  const scope = useDataScope();
  const isHr = activeRole === 'hr';

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approved, setApproved] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  const myQueue = scope(certifications).filter(
    (c) => c.stage === 'pre_review' || c.stage === 'evidence',
  );
  const allInFlight = certifications.filter((c) => !['passed', 'terminated', 'withdrawn'].includes(c.stage));

  const empName = (id: string) => allEmployees.find((e) => e.id === id)?.name ?? id;

  const openReject = () => {
    setRejectReason('');
    setRejectOpen(true);
  };

  const confirmReject = (rec: CertRecord) => {
    if (!rejectReason.trim()) {
      message.warning('驳回原因必填（留痕可审计）');
      return;
    }
    setRejected((p) => [...p, rec.id]);
    setRejectOpen(false);
    message.success('已驳回并通知员工补充材料，驳回原因已留痕');
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">认证审核台</h1>
          <div className="page-subtitle">
            {isHr
              ? 'HR 视角：全公司在途认证总表与管道健康度'
              : '部门经理视角：本部门举证材料预审（P2→P3 路由的初审环节）'}
          </div>
        </div>
      </div>

      {isHr ? (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="在途认证" value={allInFlight.length} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="材料预审中" value={allInFlight.filter((c) => c.stage === 'pre_review').length} valueStyle={{ color: 'var(--ochre)' }} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="评审/表决中" value={allInFlight.filter((c) => ['routed_review', 'defense'].includes(c.stage)).length} valueStyle={{ color: 'var(--clay)' }} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="本季终止" value={certifications.filter((c) => c.stage === 'terminated').length} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
        </Row>
      ) : (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="待我预审" value={myQueue.filter((c) => c.stage === 'pre_review' && !approved.includes(c.id) && !rejected.includes(c.id)).length} valueStyle={{ color: 'var(--clay)' }} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="本季已预审" value={approved.length + rejected.length} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="本季驳回" value={rejected.length} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
          <Col span={6}><Card variant="borderless" style={{ background: 'var(--surface)' }}><Statistic title="团队在途认证" value={myQueue.length} /></Card></Col>
        </Row>
      )}

      <Row gutter={16}>
        <Col span={15}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title={isHr ? '全公司在途认证' : '部门预审队列'}
            extra={isHr ? <Link to="/app/cert-vote"><Button type="text" size="small">评审 / 表决 →</Button></Link> : undefined}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={isHr ? allInFlight : myQueue}
              pagination={false}
              columns={[
                { title: '认证单', dataIndex: 'id', width: 150 },
                {
                  title: '员工',
                  render: (_: unknown, r) => (
                    <Space size={6}>
                      <span style={{ fontWeight: 600 }}>{empName(r.employeeId)}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{deptName(allEmployees.find((e) => e.id === r.employeeId)?.deptId ?? '')}</span>
                    </Space>
                  ),
                },
                { title: '目标', render: (_: unknown, r) => `${r.sequence}-${r.fromGrade}→${r.toGrade}` },
                { title: '环节', render: (_: unknown, r) => <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>{CERT_STAGE_LABEL[r.stage]}</Tag> },
                { title: '路由', render: (_: unknown, r) => <span style={{ fontSize: 12 }}>{CERT_ROUTER_LABEL[r.router]}</span> },
                {
                  title: isHr ? '进度' : '操作',
                  render: (_: unknown, r) =>
                    isHr ? (
                      <span className="num" style={{ fontSize: 12 }}>{r.progress}%</span>
                    ) : approved.includes(r.id) ? (
                      <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>预审通过 ✓</Tag>
                    ) : rejected.includes(r.id) ? (
                      <Tag style={{ borderRadius: 6, background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }}>已驳回 · 待补交</Tag>
                    ) : (
                      <Space size={6}>
                        <Button size="small" type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => { setApproved((p) => [...p, r.id]); message.success('预审通过，进入认证小组表决队列'); }}>
                          通过
                        </Button>
                        <Button size="small" danger onClick={openReject}>驳回</Button>
                      </Space>
                    ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={9}>
          {/* 预审详情：默认取第一条 pre_review */}
          {(() => {
            const rec = myQueue.find((c) => c.stage === 'pre_review' && !approved.includes(c.id) && !rejected.includes(c.id)) ?? myQueue[0];
            if (!rec) return null;
            return (
              <Card
                variant="borderless"
                style={{ background: 'var(--surface)', marginBottom: 16 }}
                title={<Space><AuditOutlined />预审详情 · {empName(rec.employeeId)}</Space>}
                extra={<span className="ai-badge"><RobotOutlined /> AI 预检意见</span>}
              >
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {rec.evidences.map((ev) => (
                    <div key={ev.name} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {ev.name}
                        {ev.status === 'approved' && <Tag style={{ borderRadius: 6, marginLeft: 8, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', fontSize: 11 }}>AI 预检通过</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{ev.materials.join(' / ') || '暂无材料'}</div>
                      {ev.aiTip && <div style={{ fontSize: 12, color: 'var(--ochre)', marginTop: 6 }}>{ev.aiTip}</div>}
                    </div>
                  ))}
                  {rec.examScore !== undefined && (
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      知识测验：<b className="num">{rec.examScore} 分</b>
                      {rec.timeline.some((t) => t.result === 'fail' && t.stage === 'exam') && '（补考通过，建议复核知识短板 IDP）'}
                    </div>
                  )}
                  {!isHr && (
                    <Space style={{ marginTop: 4 }}>
                      <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => { setApproved((p) => [...p, rec.id]); message.success('预审通过，进入认证小组表决队列'); }}>预审通过</Button>
                      <Button danger onClick={openReject}>驳回</Button>
                    </Space>
                  )}
                </Space>
              </Card>
            );
          })()}

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="预审规则" size="small">
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 2.1 }}>
              · 预审仅校验材料完整性与标准匹配度，不做能力判断。
              <br />· 驳回原因必填并留痕，员工可多次重提（次数租户可配）。
              <br />· 补考通过者需重点复核知识维举证。
              <br />· 预审通过后进入对应路由：小组表决 / 管委会终审。
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="驳回举证材料"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => {
          const rec = myQueue.find((c) => c.stage === 'pre_review');
          if (rec) confirmReject(rec);
        }}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--ink-2)' }}>
          驳回原因将通知员工并写入审计日志（留痕可反查）。
        </div>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="例如：缺根因分析章节 / 材料与标准条目不匹配 / 佐证数据未经复核…"
        />
      </Modal>
    </div>
  );
}
