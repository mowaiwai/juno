import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { AuditOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth, useDataScope } from '@/store/auth';
import { certifications, CERT_ROUTER_LABEL, CERT_STAGE_LABEL, type CertRecord } from '@/mock/certifications';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import { managerApi, REJECT_CATEGORY_OPTIONS, type RejectCategoryValue } from '@/api/manager';
import { hrApplicationsApi } from '@/api/finalize';
import {
  APPLICATION_STATUS_META,
  applicationsApi,
  type ApplicationDetailDTO,
  type ApplicationListItemDTO,
} from '@/api/applications';
import { ApplicationMaterial } from '@/components/ApplicationMaterial';

// ============ Mock 原型页 ============

function MockCertReview() {
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
              >
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {rec.evidences.map((ev) => (
                    <div key={ev.name} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {ev.name}
                        {ev.status === 'approved' && <Tag style={{ borderRadius: 6, marginLeft: 8, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', fontSize: 11 }}>通过</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{ev.materials.join(' / ') || '暂无材料'}</div>
                    </div>
                  ))}
                </Space>
              </Card>
            );
          })()}
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

// ============ 真实 API：经理初审台 ============

function ManagerReviewPage() {
  const [queue, setQueue] = useState<ApplicationListItemDTO[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCategory, setRejectCategory] =
    useState<RejectCategoryValue>('evidence_insufficient');
  const [rejectComment, setRejectComment] = useState('');

  const loadQueue = useCallback(async () => {
    setQueue(null);
    try {
      const rows = await managerApi.list('submitted');
      setQueue(rows);
      if (selectedId && !rows.some((r) => r.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (e) {
      setQueue([]);
      message.error(e instanceof ApiError ? e.message : '初审队列加载失败');
    }
  }, [selectedId]);

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openApplication = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await applicationsApi.get(id));
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '申请详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const approve = async () => {
    if (!selectedId) return;
    setWorking(true);
    try {
      await managerApi.approve(selectedId);
      message.success('初审通过，已按模板派单至评审小组，AI 题目后台生成中');
      setRejectOpen(false);
      await loadQueue();
      setSelectedId(null);
      setDetail(null);
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '操作失败');
    } finally {
      setWorking(false);
    }
  };

  const reject = async () => {
    if (!selectedId) return;
    const comment = rejectComment.trim();
    if (!comment) {
      message.warning('驳回必须填写文字说明（留痕可审计）');
      return;
    }
    setWorking(true);
    try {
      await managerApi.reject(selectedId, rejectCategory, comment);
      message.success('已驳回，员工可基于最新标准重新提交');
      setRejectOpen(false);
      setRejectComment('');
      await loadQueue();
      setSelectedId(null);
      setDetail(null);
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '操作失败');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">经理初审台</h1>
          <div className="page-subtitle">
            待初审 {queue?.length ?? '—'} 单 · 驳回必须选类别 + 填说明 ·
            通过即按模板派单
          </div>
        </div>
      </div>

      <Row gutter={16}>
        <Col span={9}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="待初审队列（提交时间先后）"
          >
            {queue === null ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : queue.length === 0 ? (
              <Empty description="暂无待初审申请" />
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {queue.map((a) => (
                  <Card
                    key={a.id}
                    size="small"
                    hoverable
                    onClick={() => void openApplication(a.id)}
                    style={{
                      background:
                        selectedId === a.id
                          ? 'var(--clay-soft)'
                          : 'var(--surface-sunken)',
                      border:
                        selectedId === a.id
                          ? '1px solid var(--clay)'
                          : '1px solid var(--line)',
                    }}
                  >
                    <div style={{ fontWeight: 650, fontSize: 13.5 }}>
                      {a.target_sequence} · 目标职级 {a.target_grade}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      提交于 {a.submitted_at?.slice(0, 10)}
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col span={15}>
          {!selectedId ? (
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <Empty description="从左侧选择申请查看履职表与举证" />
            </Card>
          ) : detailLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin />
            </div>
          ) : detail ? (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Card
                variant="borderless"
                style={{ background: 'var(--surface)' }}
                styles={{ body: { padding: '12px 16px' } }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <AuditOutlined style={{ color: 'var(--clay)' }} />
                    <span style={{ fontWeight: 650 }}>
                      {detail.target_sequence} → {detail.target_grade} 认证初审
                    </span>
                  </Space>
                  <Space>
                    <Button type="primary" loading={working} onClick={() => void approve()}>
                      初审通过
                    </Button>
                    <Button danger loading={working} onClick={() => setRejectOpen(true)}>
                      驳回
                    </Button>
                  </Space>
                </Space>
              </Card>
              <ApplicationMaterial detail={detail} />
            </Space>
          ) : null}
        </Col>
      </Row>

      <Modal
        title="驳回认证申请"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={reject}
        okText="确认驳回"
        okButtonProps={{ danger: true, loading: working }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
              驳回类别（必选，将随通知给员工）
            </div>
            <Select
              style={{ width: '100%' }}
              value={rejectCategory}
              onChange={(v) => setRejectCategory(v)}
              options={REJECT_CATEGORY_OPTIONS}
            />
          </div>
          <Input.TextArea
            rows={4}
            maxLength={2000}
            showCount
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="驳回说明必填：具体指出材料/自评的问题，便于员工补充改进（留痕可审计）"
          />
        </Space>
      </Modal>
    </div>
  );
}

// ============ 真实 API：HR 认证管理与发布 ============

const HR_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '待发布', value: 'approved' },
  { label: '评审中', value: 'in_committee_review' },
  { label: '已发布', value: 'published' },
  { label: '未通过', value: 'rejected' },
];

function HrReviewPage() {
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<ApplicationListItemDTO[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    try {
      setRows(
        await hrApplicationsApi.list(filter === 'all' ? undefined : filter),
      );
    } catch (e) {
      setRows([]);
      message.error(e instanceof ApiError ? e.message : '申请列表加载失败');
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openApplication = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      setDetail(await applicationsApi.get(id));
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '申请详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const publish = async () => {
    if (!selectedId) return;
    setPublishing(true);
    try {
      await hrApplicationsApi.publish(selectedId);
      message.success('已发布：员工职级当日生效，认证归档只读');
      await load();
      setDetail(null);
      setSelectedId(null);
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const counts = {
    approved: rows?.filter((r) => r.status === 'approved').length ?? 0,
    inReview:
      rows?.filter(
        (r) =>
          r.status === 'submitted' ||
          r.status === 'in_manager_review' ||
          r.status === 'in_committee_review',
      ).length ?? 0,
    published: rows?.filter((r) => r.status === 'published').length ?? 0,
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">HR 认证管理台</h1>
          <div className="page-subtitle">
            终审通过后由 HR 显式发布 · 发布事务内更新职级与生效日期 ·
            归档只读
          </div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic
              title="待发布（终审通过）"
              value={counts.approved}
              valueStyle={{ color: 'var(--sage)' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="在途" value={counts.inReview} valueStyle={{ color: 'var(--ochre)' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="已发布" value={counts.published} />
          </Card>
        </Col>
      </Row>

      <Segmented
        value={filter}
        onChange={(v) => setFilter(v as string)}
        options={HR_FILTERS}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16}>
        <Col span={9}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="认证申请"
          >
            {rows === null ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : rows.length === 0 ? (
              <Empty description="该筛选下暂无申请" />
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={rows}
                onRow={(r) => ({ onClick: () => void openApplication(r.id) })}
                rowClassName={(r) =>
                  r.id === selectedId ? 'juno-row-selected' : ''
                }
                columns={[
                  {
                    title: '认证目标',
                    render: (_, r) => (
                      <span>
                        {r.target_sequence} · {r.target_grade}
                      </span>
                    ),
                  },
                  {
                    title: '状态',
                    render: (_, r) => {
                      const m = APPLICATION_STATUS_META[r.status];
                      return (
                        <Tag
                          style={{
                            borderRadius: 6,
                            background: m.bg,
                            color: m.color,
                            borderColor: 'transparent',
                          }}
                        >
                          {m.label}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: '提交',
                    dataIndex: 'submitted_at',
                    render: (v: string | null) => v?.slice(0, 10) ?? '—',
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col span={15}>
          {!selectedId ? (
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <Empty description="从左侧选择申请查看详情" />
            </Card>
          ) : detailLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin />
            </div>
          ) : detail ? (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              {detail.status === 'approved' ? (
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 0 }}
                  message="终审通过 · 待发布"
                  description={
                    <Space direction="vertical" style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12.5 }}>
                        发布后员工职级更新为 {detail.target_grade}，
                        grade_since 记为今天，申请单归档只读。
                      </span>
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={publishing}
                        onClick={() => void publish()}
                      >
                        确认发布
                      </Button>
                    </Space>
                  }
                />
              ) : (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 0 }}
                  message={`当前状态：${APPLICATION_STATUS_META[detail.status].label}`}
                  description="仅「终审通过 · 待发布」的申请可执行发布。"
                />
              )}
              <ApplicationMaterial detail={detail} />
            </Space>
          ) : null}
        </Col>
      </Row>
    </div>
  );
}

// ============ 入口：按角色分支 ============

function RealCertReview() {
  const persona = useAuth((s) => s.persona);
  if (persona?.defaultRole === 'manager') return <ManagerReviewPage />;
  if (persona?.defaultRole === 'hr') return <HrReviewPage />;
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Empty description="当前角色无认证审核权限（仅部门经理与 HR 可访问）" />
      </Card>
    </div>
  );
}

export function CertReview() {
  return USE_MOCK ? <MockCertReview /> : <RealCertReview />;
}
