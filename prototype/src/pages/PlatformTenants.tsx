import { useEffect, useState } from 'react';
import { Button, Card, Col, Popconfirm, Row, Select, Spin, Table, Tag, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { platformApi, TenantOut, TenantStatus } from '@/api/platform';

const STATUS_META: Record<TenantStatus, { label: string; bg: string; color: string }> = {
  active: { label: '正式', bg: 'var(--sage-soft)', color: 'var(--sage)' },
  trial: { label: '试用', bg: 'var(--ochre-soft)', color: 'var(--ochre)' },
  suspended: { label: '已停用', bg: 'var(--danger-soft)', color: 'var(--danger)' },
};

export function PlatformTenants() {
  const [rows, setRows] = useState<TenantOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TenantStatus | undefined>();

  const fetch = () => {
    setLoading(true);
    platformApi.listTenants(statusFilter)
      .then(setRows)
      .catch((e) => message.error(e.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const onSuspend = async (t: TenantOut) => {
    try {
      const updated = await platformApi.suspendTenant(t.id);
      setRows((prev) => prev.map((r) => (r.id === t.id ? updated : r)));
      message.success(`租户 ${t.name} 已停用`);
    } catch (e: any) {
      message.error(e.message ?? '停用失败');
    }
  };

  const onRestore = async (t: TenantOut) => {
    try {
      const updated = await platformApi.restoreTenant(t.id);
      setRows((prev) => prev.map((r) => (r.id === t.id ? updated : r)));
      message.success(`租户 ${t.name} 已恢复`);
    } catch (e: any) {
      message.error(e.message ?? '恢复失败');
    }
  };

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    trial: rows.filter((r) => r.status === 'trial').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">租户管理</h1>
          <div className="page-subtitle">平台级视图：开通 / 封禁租户、套餐与续费 · 不可见租户员工数据明文</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'active', label: '正式' },
              { value: 'trial', label: '试用' },
              { value: 'suspended', label: '已停用' },
            ]}
          />
          <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.info('开通新租户：分配租户 ID 与初始化模板（模拟）')}>
            开通新租户
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '租户总数', value: stats.total, sub: '全部租户' },
          { label: '正式租户', value: stats.active, sub: '付费中' },
          { label: '试用中', value: stats.trial, sub: '待转化' },
          { label: '已停用', value: stats.suspended, sub: '欠费/违规' },
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

      <Spin spinning={loading}>
        <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
          <Table
            rowKey="id"
            dataSource={rows}
            pagination={false}
            size="middle"
            rowClassName={(r) => (r.status === 'suspended' ? 'row-disabled' : '')}
            columns={[
              {
                title: '租户',
                render: (_: unknown, r: TenantOut) => (
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>入驻 {r.joined_at ?? '—'} · {r.id}</div>
                  </div>
                ),
              },
              { title: '行业', width: 100, render: (_: unknown, r: TenantOut) => r.industry ?? '—' },
              {
                title: '套餐',
                width: 100,
                render: (_: unknown, r: TenantOut) => <Tag style={{ borderRadius: 6, margin: 0 }}>{r.plan_name ?? '未开通'}</Tag>,
              },
              { title: '席位', width: 80, render: (_: unknown, r: TenantOut) => <span className="num">{r.seats}</span> },
              {
                title: 'MRR',
                width: 110,
                render: (_: unknown, r: TenantOut) => <span className="num" style={{ fontWeight: 600 }}>{r.mrr > 0 ? '¥' + r.mrr.toLocaleString() : '—'}</span>,
              },
              {
                title: '健康度',
                width: 110,
                render: (_: unknown, r: TenantOut) => {
                  const color = r.health >= 80 ? 'var(--sage)' : r.health >= 60 ? 'var(--ochre)' : 'var(--danger)';
                  return <span className="num" style={{ color, fontWeight: 700 }}>{r.health}</span>;
                },
              },
              {
                title: '状态',
                width: 90,
                render: (_: unknown, r: TenantOut) => (
                  <Tag style={{ borderRadius: 6, background: STATUS_META[r.status].bg, color: STATUS_META[r.status].color, borderColor: 'transparent', margin: 0, fontWeight: 600 }}>
                    {STATUS_META[r.status].label}
                  </Tag>
                ),
              },
              {
                title: '操作',
                width: 170,
                render: (_: unknown, r: TenantOut) => (
                  <div style={{ display: 'flex' }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<LockOutlined />}
                      style={{ padding: '0 4px' }}
                      onClick={() => message.info('仅展示租户级聚合数据，员工明文不出租户')}
                    >
                      查看详情
                    </Button>
                    {r.status === 'suspended' ? (
                      <Button type="link" size="small" style={{ color: 'var(--sage)', padding: '0 4px' }} onClick={() => onRestore(r)}>
                        恢复
                      </Button>
                    ) : (
                      <Popconfirm
                        title="停用该租户？"
                        description="停用后立即阻断登录，数据保留 90 天"
                        okText="停用"
                        okButtonProps={{ danger: true }}
                        cancelText="取消"
                        onConfirm={() => onSuspend(r)}
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
      </Spin>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b><LockOutlined /> 数据边界</b>：平台管理员只可见租户级聚合（席位、用量、MRR、健康度），员工档案、薪酬等明文一律不出租户边界；
          大客户按合同可升级独立 Schema / 独立实例，隔离级别随套餐切换。
        </div>
      </Card>
    </div>
  );
}
