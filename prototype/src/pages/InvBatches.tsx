import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Empty, Popconfirm, Row, Space, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { inventoryApi, type BatchOut } from '@/api/inventory';
import { INV_PURPOSE_LABEL, INV_STATUS_LABEL } from '@/mock/inventory';
import { useAuth } from '@/store/auth';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--ink-4)',
  CALIBRATING: 'var(--ochre)',
  CONFIRMING: 'var(--teal)',
  PUBLISHED: 'var(--sage)',
};

const STATUS_BG: Record<string, string> = {
  DRAFT: 'var(--surface-sunken)',
  CALIBRATING: 'var(--ochre-soft)',
  CONFIRMING: 'var(--teal-soft)',
  PUBLISHED: 'var(--sage-soft)',
};

/** 容器内 tab 链接（盘点各页共享 app-nine-grid 容器） */
function tabLink(tab: string, id?: string) {
  return id
    ? `/app/app-nine-grid?tab=${tab}&id=${id}`
    : `/app/app-nine-grid?tab=${tab}`;
}

export function InvBatches() {
  const activeRole = useAuth((s) => s.activeRole);
  const [list, setList] = useState<BatchOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>('');

  const reload = useCallback(() => {
    setLoading(true);
    inventoryApi.invalidateBatches();
    return inventoryApi
      .list()
      .then(setList)
      .catch(() => message.error('加载盘点批次失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    inventoryApi.list().then(setList).catch(() => message.error('加载盘点批次失败')).finally(() => setLoading(false));
  }, []);

  const published = list.filter((b) => b.status === 'PUBLISHED').length;
  const running = list.filter((b) => b.status === 'CALIBRATING' || b.status === 'CONFIRMING').length;

  // 后端：启动仅 HR；确认/退回仅租户管理员（MVP 将发布确认收敛给租户管理员）
  const canStart = activeRole === 'hr';
  const canConfirm = activeRole === 'tenant_admin';

  const runAction = async (batchId: string, label: string, fn: () => Promise<unknown>) => {
    setBusyId(batchId);
    try {
      await fn();
      message.success(label);
      await reload();
    } catch {
      message.error(`${label}失败`);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">盘点批次</h1>
          <div className="page-subtitle">年度/继任/调薪/发展盘点 · 业绩×能力×潜力三维定位，生成九宫格与策略</div>
        </div>
        {canStart && (
          <Link to={tabLink('create')}>
            <Button type="primary" icon={<PlusOutlined />} style={{ background: 'var(--charcoal)' }}>发起盘点</Button>
          </Link>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '全部批次', value: list.length, sub: `${published} 已发布` },
          { label: '进行中', value: running, sub: '校准 / 确认窗口期' },
          { label: '已发布', value: published, sub: '可查历史定位' },
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
          dataSource={list}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无盘点批次，点击右上角「发起盘点」创建" /> }}
          columns={[
            { title: '批次', render: (_: unknown, r: BatchOut) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.created_at?.slice(0, 10)}</span>
              </Space>
            )},
            { title: '目的', dataIndex: 'purpose', render: (p: string) => INV_PURPOSE_LABEL[p as keyof typeof INV_PURPOSE_LABEL] ?? p },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: STATUS_BG[s], color: STATUS_COLOR[s] }}>
                  {INV_STATUS_LABEL[s as keyof typeof INV_STATUS_LABEL] ?? s}
                </Tag>
              ),
            },
            { title: '发布时间', dataIndex: 'published_at', render: (v: string | null) => v?.slice(0, 10) ?? '—' },
            {
              title: '操作',
              render: (_: unknown, r: BatchOut) => (
                <Space size={4}>
                  {r.status === 'DRAFT' && canStart && (
                    <Popconfirm
                      title="启动初排？"
                      description="系统将汇聚范围内员工的画像数据生成初排（草稿创建后不可修改）"
                      onConfirm={() => runAction(r.id, '初排已启动，进入校准阶段', () => inventoryApi.start(r.id))}
                    >
                      <Button size="small" type="primary" loading={busyId === r.id} style={{ background: 'var(--charcoal)' }}>
                        启动初排
                      </Button>
                    </Popconfirm>
                  )}
                  {r.status === 'CALIBRATING' && (
                    <Link to={tabLink('calibrate', r.id)}>
                      <Button size="small" type="primary" style={{ background: 'var(--charcoal)' }}>进入校准</Button>
                    </Link>
                  )}
                  {r.status === 'CONFIRMING' && (
                    <>
                      <Link to={tabLink('calibrate', r.id)}><Button size="small" type="link">查看校准</Button></Link>
                      {canConfirm && (
                        <>
                          <Popconfirm
                            title="确认发布该盘点批次？"
                            description="发布后九宫格定位将回写员工画像"
                            onConfirm={() => runAction(r.id, '批次已发布，定位已回写画像', () => inventoryApi.confirm(r.id))}
                          >
                            <Button size="small" type="primary" loading={busyId === r.id} style={{ background: 'var(--sage)' }}>
                              确认发布
                            </Button>
                          </Popconfirm>
                          <Button
                            size="small"
                            danger
                            disabled={!!busyId}
                            onClick={() => runAction(r.id, '批次已退回 HR 继续校准', () => inventoryApi.reject(r.id))}
                          >
                            退回
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {r.status === 'PUBLISHED' && (
                    <Link to={tabLink('grid', r.id)}>
                      <Button size="small" type="primary" style={{ background: 'var(--charcoal)' }}>查看结果</Button>
                    </Link>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
