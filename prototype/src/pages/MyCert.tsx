import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Table, Tag } from 'antd';
import { SafetyCertificateOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import { certByEmployee, certHistory, CERT_ROUTER_LABEL, CERT_STAGE_LABEL } from '@/mock/certifications';

export function MyCert() {
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
