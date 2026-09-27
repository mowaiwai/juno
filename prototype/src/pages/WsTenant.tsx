import { Link } from 'react-router-dom';
import { Card, Col, List, Progress, Row, Space, Tag } from 'antd';
import {
  AppstoreOutlined,
  ControlOutlined,
  FileTextOutlined,
  FundOutlined,
} from '@ant-design/icons';
import { aiQuota, bills, configItems, templatePacks } from '@/mock/saas';

const QUICK = [
  { to: '/app/config-center', icon: <ControlOutlined />, label: '配置中心', desc: '规则模板与租户覆盖' },
  { to: '/app/template-market', icon: <AppstoreOutlined />, label: '模板市场', desc: '行业包导入与升级' },
  { to: '/app/ai-usage', icon: <FundOutlined />, label: 'AI 用量', desc: '配额、流水与费用' },
  { to: '/app/billing', icon: <FileTextOutlined />, label: '套餐与账单', desc: '席位订阅与支付' },
];

export function WsTenant() {
  const unpaid = bills.filter((b) => b.status !== '已支付');
  const usagePct = Math.round((aiQuota.monthUsedTokens / aiQuota.monthlyTokenQuota) * 100);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">租户管理员工作台</h1>
          <div className="page-subtitle">华砺精工 · 本租户配置、模板、用量与账单</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>配置项 / 草稿</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
              {configItems.length} <span style={{ color: 'var(--ochre)', fontSize: 15 }}>/ {configItems.filter((c) => c.status === 'draft').length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>1 条草稿待发布</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已装模板</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{templatePacks.filter((t) => t.installed).length}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>制造包生效中 · 均为最新</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>本月 AI 配额使用</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{usagePct}%</div>
            <Progress percent={usagePct} size="small" strokeColor="var(--sage)" trailColor="var(--line)" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待支付账单</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: unpaid.length ? 'var(--clay)' : 'var(--sage)' }}>
              {unpaid.length} 笔
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>9 月账期 ¥5,833.4</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small" title="快捷入口">
            <Row gutter={[16, 16]}>
              {QUICK.map((q) => (
                <Col span={12} key={q.to}>
                  <Link to={q.to}>
                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 18, color: 'var(--clay)' }}>{q.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{q.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{q.desc}</div>
                      </div>
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)', height: '100%' }} size="small" title="待办">
            <List
              size="small"
              dataSource={[
                { t: '发布 AI 模型灰度草稿（出题场景 30% 走 GLM-4）', tag: '配置', color: 'var(--ochre)' },
                { t: '支付 2026-09 账期账单 ¥5,833.4', tag: '账单', color: 'var(--clay)' },
                { t: '制造行业包 v2.2 升级预告：10 月发布，届时 diff 合入', tag: '模板', color: 'var(--teal)' },
              ]}
              renderItem={(it) => (
                <List.Item style={{ paddingLeft: 0 }}>
                  <Space align="start">
                    <Tag style={{ borderRadius: 4, margin: '4px 0 0', background: it.color + '22', color: it.color, borderColor: 'transparent' }}>{it.tag}</Tag>
                    <span style={{ fontSize: 13 }}>{it.t}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          本租户数据逻辑隔离，配置变更走「草稿 → 发布」并留审计；当前套餐 <b>专业版</b>，AI 费用随席位账单按月结算。
        </div>
      </Card>
    </div>
  );
}
