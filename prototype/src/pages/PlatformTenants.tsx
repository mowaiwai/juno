import { Button, Card, Col, Popconfirm, Row, Table, Tag, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { platformTenants, TenantStatus } from '@/mock/saas';

const STATUS_META: Record<TenantStatus, { label: string; bg: string; color: string }> = {
  active: { label: '正式', bg: 'var(--sage-soft)', color: 'var(--sage)' },
  trial: { label: '试用', bg: 'var(--ochre-soft)', color: 'var(--ochre)' },
  suspended: { label: '已停用', bg: 'var(--danger-soft)', color: 'var(--danger)' },
};

export function PlatformTenants() {
  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">租户管理</h1>
          <div className="page-subtitle">平台级视图：开通 / 封禁租户、套餐与续费 · 不可见租户员工数据明文</div>
        </div>
        <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.info('开通新租户：分配租户 ID 与初始化模板（模拟）')}>
          开通新租户
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '租户总数', value: 126, sub: '本月新增 11' },
          { label: '正式租户', value: 98, sub: '付费 98' },
          { label: '试用中', value: 24, sub: '转化率 34%' },
          { label: '已停用', value: 4, sub: '欠费/违规' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Table
          rowKey="id"
          dataSource={platformTenants}
          pagination={false}
          size="middle"
          rowClassName={(r) => (r.status === 'suspended' ? 'row-disabled' : '')}
          columns={[
            {
              title: '租户',
              render: (_: unknown, r) => (
                <div>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>入驻 {r.joinedAt} · {r.id}</div>
                </div>
              ),
            },
            { title: '行业', width: 100, dataIndex: 'industry' },
            {
              title: '套餐',
              width: 100,
              render: (_: unknown, r) => <Tag style={{ borderRadius: 6, margin: 0 }}>{r.plan}</Tag>,
            },
            { title: '席位', width: 80, render: (_: unknown, r) => <span className="num">{r.seats}</span> },
            {
              title: 'MRR',
              width: 110,
              render: (_: unknown, r) => <span className="num" style={{ fontWeight: 600 }}>{r.mrr > 0 ? '¥' + r.mrr.toLocaleString() : '—'}</span>,
            },
            {
              title: '健康度',
              width: 110,
              render: (_: unknown, r) => {
                const color = r.health >= 80 ? 'var(--sage)' : r.health >= 60 ? 'var(--ochre)' : 'var(--danger)';
                return (
                  <span className="num" style={{ color, fontWeight: 700 }}>{r.health}</span>
                );
              },
            },
            {
              title: '状态',
              width: 90,
              render: (_: unknown, r) => (
                <Tag style={{ borderRadius: 6, background: STATUS_META[r.status].bg, color: STATUS_META[r.status].color, borderColor: 'transparent', margin: 0, fontWeight: 600 }}>
                  {STATUS_META[r.status].label}
                </Tag>
              ),
            },
            {
              title: '操作',
              width: 170,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex' }}>
                  <Button
                    type="link"
                    size="small"
                    icon={<LockOutlined />}
                    style={{ padding: '0 4px' }}
                    onClick={() => message.info('仅展示租户级聚合数据，员工明文不出租户（模拟）')}
                  >
                    查看详情
                  </Button>
                  {r.status === 'suspended' ? (
                    <Button type="link" size="small" style={{ color: 'var(--sage)', padding: '0 4px' }} onClick={() => message.success(`租户 ${r.name} 已恢复`)}>
                      恢复
                    </Button>
                  ) : (
                    <Popconfirm
                      title="停用该租户？"
                      description="停用后立即阻断登录，数据保留 90 天"
                      okText="停用"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => message.warning(`租户 ${r.name} 已停用（模拟）`)}
                    >
                      <Button type="link" size="small" danger style={{ padding: '0 4px' }}>停用</Button>
                    </Popconfirm>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b><LockOutlined /> 数据边界</b>：平台管理员只可见租户级聚合（席位、用量、MRR、健康度），员工档案、薪酬等明文一律不出租户边界；
          大客户按合同可升级独立 Schema / 独立实例，隔离级别随套餐切换。
        </div>
      </Card>
    </div>
  );
}
