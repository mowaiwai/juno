import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Spin, Table, Tag } from 'antd';
import { PlusOutlined, SafetyCertificateOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import { certByEmployee, certHistory, CERT_ROUTER_LABEL, CERT_STAGE_LABEL } from '@/mock/certifications';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import {
  APPLICATION_STATUS_META,
  applicationsApi,
  type ApplicationListItemDTO,
  type ApplicationStatusValue,
} from '@/api/applications';
import { useEffect, useState } from 'react';

// ============ Mock 原型页 ============

function MockMyCert() {
  const persona = useAuth((s) => s.persona);
  const emp = employeeById(persona?.employeeId);
  const inFlight = emp ? certByEmployee(emp.id).filter((c) => !['passed', 'terminated'].includes(c.stage)) : [];
  const history = emp ? certHistory.filter((h) => h.employeeId === emp.id) : [];

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的认证</h1>
          <div className="page-subtitle">认证记录全程留痕 · P4/P5 高等级人才每 3 年复评</div>
        </div>
      </div>

      <Row gutter={16}>
        <Col span={14}>
          {inFlight.length > 0 ? (
            inFlight.map((c) => (
              <Card
                key={c.id}
                variant="borderless"
                style={{ background: 'var(--surface)', marginBottom: 16 }}
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: 'var(--clay)' }} />
                    {c.sequence}-{c.fromGrade} → {c.toGrade} 晋升认证
                  </Space>
                }
                extra={<Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>{CERT_STAGE_LABEL[c.stage]}</Tag>}
              >
                <Progress percent={c.progress} strokeColor="var(--clay)" />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, lineHeight: 2 }}>
                  路由：{CERT_ROUTER_LABEL[c.router]} · 发起 {c.initiatedAt} · 举证截止 {c.deadline}
                  <br />
                  知识测验 {c.examScore} 分 · 履职举证 {c.evidences.filter((e) => e.status === 'approved').length}/{c.evidences.length} 通过
                </div>
                <Link to="/app/cert-apply">
                  <Button size="small" style={{ marginTop: 10 }}>继续举证</Button>
                </Link>
              </Card>
            ))
          ) : (
            <Empty description="无进行中的认证" style={{ marginTop: 40 }} />
          )}

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="历史认证记录" size="small">
            <Table
              size="small"
              rowKey="id"
              dataSource={history}
              pagination={false}
              columns={[
                { title: '认证单号', dataIndex: 'id' },
                { title: '认证职级', dataIndex: 'toGrade', render: (g: string) => <Tag style={{ borderRadius: 6 }}>{g}</Tag> },
                { title: '类型', dataIndex: 'certType' },
                { title: '通过时间', dataIndex: 'passedAt' },
                { title: '备注', dataIndex: 'note' },
              ]}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
            <Space align="center" size={12}>
              <TrophyOutlined style={{ fontSize: 28, color: 'var(--ochre)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>已获认证：{history.length} 项</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>当前职级 {emp?.grade} · 最高认证 {history[history.length - 1]?.toGrade ?? '—'}</div>
              </div>
            </Space>
          </Card>

          <Alert
            type="info"
            showIcon
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', marginBottom: 16 }}
            message="复评机制"
            description={
              <span style={{ fontSize: 12.5, lineHeight: 2 }}>
                P4/P5 高等级人才每 3 年复评一次，复评不合格降 1 级并联动调薪；可申诉一次，申诉走管委会复核。
                「拿着 P4 工资干 P2 的事」将由复评机制校准。
              </span>
            }
          />

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="认证小贴士" size="small">
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 2.1 }}>
              · 述职答辩为最后一关：能力素质以关键行为举证 + 答辩评估，不以能力卡人，仅存在负面行为时不通过。
              <br />· 知识测验默认 1 次补考机会，补考不通过将关联 IDP 知识提升计划。
              <br />· 评审开始前可撤回申请，进入评审后不可撤回。
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ============ 真实 API 模式 ============

const IN_FLIGHT_STATUSES: ApplicationStatusValue[] = [
  'draft',
  'submitted',
  'in_manager_review',
  'in_committee_review',
  'approved',
];

function RealMyCert() {
  const [rows, setRows] = useState<ApplicationListItemDTO[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = () => {
    setRows(null);
    setErrorMsg(null);
    applicationsApi
      .mine()
      .then((list) => setRows(list))
      .catch((e: unknown) => {
        setRows([]);
        setErrorMsg(e instanceof ApiError ? e.message : '我的认证加载失败');
      });
  };

  useEffect(load, []);

  if (rows === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  const inFlight = rows.filter((r) => IN_FLIGHT_STATUSES.includes(r.status));
  const history = rows.filter((r) => !IN_FLIGHT_STATUSES.includes(r.status));
  const publishedCount = rows.filter((r) => r.status === 'published').length;

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的认证</h1>
          <div className="page-subtitle">
            草稿 → 提交 → 初审 → 评审 → 终裁 → 发布 · 全程留痕可审计
          </div>
        </div>
        <Link to="/app/cert-apply">
          <Button type="primary" icon={<PlusOutlined />}>
            发起认证
          </Button>
        </Link>
      </div>

      {errorMsg && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMsg}
        />
      )}

      <Row gutter={16}>
        <Col span={14}>
          {inFlight.length > 0 ? (
            inFlight.map((a) => {
              const meta = APPLICATION_STATUS_META[a.status];
              return (
                <Card
                  key={a.id}
                  variant="borderless"
                  style={{ background: 'var(--surface)', marginBottom: 16 }}
                  title={
                    <Space>
                      <SafetyCertificateOutlined style={{ color: 'var(--clay)' }} />
                      {a.target_sequence} 序列 · 目标职级 {a.target_grade}
                    </Space>
                  }
                  extra={
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
                  }
                >
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 2 }}>
                    {a.submitted_at
                      ? `提交于 ${a.submitted_at.slice(0, 10)}`
                      : '草稿尚未提交，提交后才会进入初审'}
                  </div>
                  <Link to={`/app/cert-apply?app=${a.id}`}>
                    <Button size="small" style={{ marginTop: 10 }}>
                      {a.status === 'draft'
                        ? '继续填写 / 举证'
                        : a.status === 'submitted'
                          ? '查看 / 撤回'
                          : '查看进度'}
                    </Button>
                  </Link>
                </Card>
              );
            })
          ) : (
            <Empty
              description="无进行中的认证，点击右上角「发起认证」"
              style={{ marginTop: 40 }}
            />
          )}

          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="历史认证记录"
            size="small"
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={history}
              pagination={false}
              locale={{ emptyText: '暂无历史记录' }}
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
                  title: '结果',
                  render: (_, r) =>
                    r.status === 'published' ? (
                      <Tag
                        style={{
                          borderRadius: 6,
                          background: 'var(--sage-soft)',
                          color: 'var(--sage)',
                          borderColor: 'transparent',
                        }}
                      >
                        已通过并发布
                      </Tag>
                    ) : (
                      <Tag
                        style={{
                          borderRadius: 6,
                          background: 'var(--danger-soft)',
                          color: 'var(--danger)',
                          borderColor: 'transparent',
                        }}
                      >
                        未通过
                      </Tag>
                    ),
                },
                {
                  title: '提交时间',
                  dataIndex: 'submitted_at',
                  render: (v: string | null) => v?.slice(0, 10) ?? '—',
                },
                {
                  title: '完成时间',
                  render: (_, r) =>
                    (r.published_at ?? r.decided_at)?.slice(0, 10) ?? '—',
                },
                {
                  title: '操作',
                  render: (_, r) => (
                    <Link to={`/app/cert-apply?app=${r.id}`}>查看</Link>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            size="small"
          >
            <Space align="center" size={12}>
              <TrophyOutlined style={{ fontSize: 28, color: 'var(--ochre)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  已获认证：{publishedCount} 项
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  进行中 {inFlight.length} 项 · 历史申请 {history.length} 次
                </div>
              </div>
            </Space>
          </Card>

          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="认证小贴士"
            size="small"
          >
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 2.1 }}>
              · 硬门槛（现职级任职年限、近一年绩效）由系统校验，未达标不会产生评审成本。
              <br />· 履职表逐项自评并挂接关键行为举证，jpg/png/pdf，每项最多 3 个附件。
              <br />· 仅「已提交」状态可撤回；被驳回可基于最新标准重新提交，材料自动复制。
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export function MyCert() {
  return USE_MOCK ? <MockMyCert /> : <RealMyCert />;
}
