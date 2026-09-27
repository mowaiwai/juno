import { Button, Card, Col, Row, Table, Tag, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { bills, plans } from '@/mock/saas';

const PLAN_COLOR: Record<string, string> = {
  免费试用: 'var(--ink-3)',
  标准版: 'var(--teal)',
  专业版: 'var(--clay)',
  企业版: 'var(--charcoal)',
};

export function Billing() {
  const current = plans.find((p) => p.current)!;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">套餐与账单</h1>
          <div className="page-subtitle">席位订阅 + AI 用量计费 · 按月出账 · 支持对公转账与线上支付</div>
        </div>
      </div>

      {/* 当前套餐 */}
      <Card variant="borderless" style={{ background: 'var(--clay-soft)', marginBottom: 16 }} size="small">
        <Row align="middle">
          <Col span={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tag style={{ borderRadius: 6, background: PLAN_COLOR[current.name], color: '#fff', borderColor: 'transparent', margin: 0, fontWeight: 700 }}>
                当前套餐 · {current.name}
              </Tag>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{current.scope}</span>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>开通席位</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>43 席</div>
          </Col>
          <Col span={4} style={{ textAlign: 'right' }}>
            <Button onClick={() => message.info('席位增减下月账期生效（模拟）')}>增减席位</Button>
          </Col>
        </Row>
      </Card>

      {/* 套餐对比 */}
      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="套餐对比">
        <Row gutter={16}>
          {plans.map((p) => (
            <Col span={6} key={p.id}>
              <div
                style={{
                  border: p.current ? '2px solid var(--clay)' : '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 16,
                  height: '100%',
                  background: p.current ? 'var(--clay-soft)' : 'var(--surface)',
                  position: 'relative',
                }}
              >
                {p.current && (
                  <Tag style={{ position: 'absolute', top: -10, right: 12, borderRadius: 6, background: 'var(--clay)', color: '#fff', borderColor: 'transparent', margin: 0 }}>
                    <CheckOutlined /> 使用中
                  </Tag>
                )}
                <div className="font-serif" style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                <div style={{ margin: '8px 0', fontWeight: 700 }} className="num">{p.price}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', minHeight: 56, lineHeight: 1.7 }}>{p.scope}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>{p.billing}</div>
                {!p.current && (
                  <Button
                    size="small"
                    block
                    type={p.name === '企业版' ? 'default' : 'primary'}
                    style={p.name === '企业版' ? {} : { background: 'var(--charcoal)' }}
                    onClick={() => (p.name === '企业版' ? message.info('企业版需洽谈：独立实例 / SSO / 实施（模拟）') : message.loading(`套餐变更申请已提交：${p.name}，次月生效（模拟）`))}
                  >
                    {p.name === '企业版' ? '联系洽谈' : '升级/变更'}
                  </Button>
                )}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 账单 */}
      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="账单记录">
        <Table
          rowKey="id"
          dataSource={bills}
          pagination={false}
          size="middle"
          columns={[
            { title: '账期', width: 110, render: (_: unknown, r) => <span className="num" style={{ fontWeight: 700 }}>{r.period}</span> },
            { title: '套餐', width: 110, render: (_: unknown, r) => <Tag style={{ borderRadius: 6, background: PLAN_COLOR[r.plan] + '22', color: PLAN_COLOR[r.plan], borderColor: 'transparent', margin: 0 }}>{r.plan}</Tag> },
            { title: '席位', width: 90, render: (_: unknown, r) => <span className="num">{r.seats} 席</span> },
            { title: '席位费', render: (_: unknown, r) => <span className="num">¥{(r.total - r.aiCost).toLocaleString()}</span> },
            { title: 'AI 用量费', render: (_: unknown, r) => <span className="num">¥{r.aiCost.toFixed(1)}</span> },
            { title: '合计', render: (_: unknown, r) => <span className="num" style={{ fontWeight: 700 }}>¥{r.total.toLocaleString()}</span> },
            {
              title: '状态 / 操作',
              width: 130,
              render: (_: unknown, r) =>
                r.status === '已支付' ? (
                  <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', margin: 0 }}>已支付</Tag>
                ) : (
                  <Button size="small" type="primary" danger style={{ background: 'var(--clay)' }} onClick={() => message.success(`账期 ${r.period} 支付完成，发票已申请（模拟）`)}>
                    立即支付
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
