import { Card, Col, Progress, Row, Space, Table, Tag, message } from 'antd';
import { Button } from 'antd';
import { abRoles, AB_STATUS_LABEL } from '@/mock/succession';

const STATUS_COLOR = { training: 'var(--ochre)', ready: 'var(--sage)', shadowing: 'var(--teal)' };

export function AbRoles() {
  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">AB 角配置</h1>
          <div className="page-subtitle">核心岗位 A/B 角指派 · B 角培养跟踪 · 确保岗位不中断</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>AB 角配置数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{abRoles.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>B 角已就绪</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{abRoles.filter((r) => r.bStatus === 'ready').length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>跟岗中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{abRoles.filter((r) => r.bStatus === 'shadowing').length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>培养中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{abRoles.filter((r) => r.bStatus === 'training').length}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="AB 角配置清单" size="small">
        <Table
          rowKey="id"
          dataSource={abRoles}
          pagination={false}
          columns={[
            { title: '岗位', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.positionName}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.deptName}</span>
              </Space>
            )},
            {
              title: 'A 角（在岗）',
              render: (_: unknown, r) => (
                <Space size={8}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{r.aName[0]}</span>
                  <span>{r.aName}</span>
                </Space>
              ),
            },
            {
              title: 'B 角（继任）',
              render: (_: unknown, r) => (
                <Space size={8}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{r.bName[0]}</span>
                  <span>{r.bName}</span>
                </Space>
              ),
            },
            {
              title: 'B 角状态',
              dataIndex: 'bStatus',
              render: (v: 'training' | 'ready' | 'shadowing') => (
                <Tag style={{ borderRadius: 6, background: STATUS_COLOR[v] + '22', color: STATUS_COLOR[v], borderColor: 'transparent' }}>{AB_STATUS_LABEL[v]}</Tag>
              ),
            },
            {
              title: 'B 角培养进度',
              render: (_: unknown, r) => {
                const progress = r.bStatus === 'ready' ? 100 : r.bStatus === 'shadowing' ? 75 : 45;
                return <Progress percent={progress} size="small" strokeColor={STATUS_COLOR[r.bStatus]} style={{ width: 120 }} showInfo={false} />;
              },
            },
            {
              title: '操作',
              render: () => (
                <Space>
                  <Button size="small" type="link" onClick={() => message.success('已发起 B 角跟岗')}>跟岗安排</Button>
                  <Button size="small" type="link" onClick={() => message.info('已调整 AB 角')}>调整</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
