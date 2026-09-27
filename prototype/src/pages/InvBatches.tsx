import { Link } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { batches, INV_PURPOSE_LABEL, INV_STATUS_LABEL } from '@/mock/inventory';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--ink-4)',
  RUNNING: 'var(--ochre)',
  PUBLISHED: 'var(--sage)',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: 'var(--surface-sunken)',
  RUNNING: 'var(--ochre-soft)',
  PUBLISHED: 'var(--sage-soft)',
};

export function InvBatches() {
  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">盘点批次</h1>
          <div className="page-subtitle">年度/继任/调薪/发展盘点 · 业绩×能力×潜力三维定位，生成九宫格与策略</div>
        </div>
        <Link to="/app/inv-create">
          <Button type="primary" icon={<PlusOutlined />} style={{ background: 'var(--charcoal)' }}>发起盘点</Button>
        </Link>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '全部批次', value: batches.length, sub: `${batches.filter((b) => b.status === 'PUBLISHED').length} 已发布` },
          { label: '进行中', value: batches.filter((b) => b.status === 'RUNNING').length, sub: '校准窗口期' },
          { label: '已发布', value: batches.filter((b) => b.status === 'PUBLISHED').length, sub: '可查历史定位' },
        ].map((s) => (
          <Col span={8} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="批次列表" size="small">
        <Table
          rowKey="id"
          dataSource={batches}
          pagination={false}
          columns={[
            { title: '批次', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.id}</span>
              </Space>
            )},
            { title: '目的', dataIndex: 'purpose', render: (p: string) => INV_PURPOSE_LABEL[p as keyof typeof INV_PURPOSE_LABEL] },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: STATUS_BG[s], color: STATUS_COLOR[s] }}>
                  {INV_STATUS_LABEL[s as keyof typeof INV_STATUS_LABEL]}
                </Tag>
              ),
            },
            { title: '维度权重', render: (_: unknown, r) => (
              <span className="num" style={{ fontSize: 12 }}>
                业绩 {Math.round(r.dimensionConfig.perf * 100)} · 能力 {Math.round(r.dimensionConfig.ability * 100)} · 潜力 {Math.round(r.dimensionConfig.potential * 100)}
              </span>
            )},
            { title: '范围', render: (_: unknown, r) => r.scopeDeptIds.includes('100') ? '全公司' : `${r.scopeDeptIds.length} 个部门` },
            {
              title: '确认进度',
              render: (_: unknown, r) => (
                <Space>
                  <Progress percent={Math.round((r.confirmedCount / r.estCount) * 100)} size="small" strokeColor="var(--clay)" showInfo={false} style={{ width: 80 }} />
                  <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.confirmedCount}/{r.estCount}</span>
                </Space>
              ),
            },
            { title: '负责人', dataIndex: 'owner' },
            {
              title: '操作',
              render: (_: unknown, r) => (
                r.status === 'DRAFT' ? (
                  <Link to={`/app/inv-create?id=${r.id}`}><Button size="small" type="link">继续配置</Button></Link>
                ) : (
                  <Link to={`/app/inv-calibrate?id=${r.id}`}><Button size="small" type="primary" style={{ background: 'var(--charcoal)' }}>{r.status === 'PUBLISHED' ? '查看结果' : '进入校准'}</Button></Link>
                )
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
