import { Card, Col, Progress, Row, Space, Table, Tag, message } from 'antd';
import { Button } from 'antd';
import { poolTrainings, POOL_LEVEL_LABEL, TRAINING_STATUS_LABEL } from '@/mock/succession';

const STATUS_COLOR = { doing: 'var(--clay)', done: 'var(--sage)', pending: 'var(--ink-4)' };
const LEVEL_COLOR = { L1: 'var(--danger)', L2: 'var(--ochre)', L3: 'var(--teal)' };

export function PoolTraining() {
  const doing = poolTrainings.filter((t) => t.status === 'doing').length;
  const done = poolTrainings.filter((t) => t.status === 'done').length;
  const avg = poolTrainings.length ? Math.round(poolTrainings.reduce((s, t) => s + t.progress, 0) / poolTrainings.length) : 0;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">培养跟踪</h1>
          <div className="page-subtitle">梯队成员培养计划进度 · 带教人 · 效果回看</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>培养计划数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{poolTrainings.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>进行中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{doing}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已完成</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{done}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均进度</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{avg}%</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="培养计划清单" size="small">
        <Table
          rowKey="id"
          dataSource={poolTrainings}
          pagination={false}
          columns={[
            { title: '成员', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.employeeName}</span>
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[r.level] + '22', color: LEVEL_COLOR[r.level], borderColor: 'transparent', marginInlineEnd: 0 }}>{POOL_LEVEL_LABEL[r.level]}</Tag>
              </Space>
            )},
            { title: '培养项目', dataIndex: 'program' },
            { title: '带教人', dataIndex: 'mentor' },
            { title: '周期', render: (_: unknown, r) => `${r.startDate} ~ ${r.endDate}` },
            {
              title: '进度',
              dataIndex: 'progress',
              render: (v: number, r) => (
                <Space>
                  <Progress percent={v} size="small" strokeColor={STATUS_COLOR[r.status]} style={{ width: 100 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{v}%</span>
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: 'doing' | 'done' | 'pending') => <Tag style={{ borderRadius: 6, background: STATUS_COLOR[v] + '22', color: STATUS_COLOR[v], borderColor: 'transparent' }}>{TRAINING_STATUS_LABEL[v]}</Tag>,
            },
            {
              title: '操作',
              render: () => (
                <Space>
                  <Button size="small" type="link" onClick={() => message.success('已记录培养进展')}>记录进展</Button>
                  <Button size="small" type="link" onClick={() => message.info('已发起效果回看')}>效果回看</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
