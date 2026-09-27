import { Button, Card, Col, Row, Table, Tag, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { configItems } from '@/mock/saas';

export function ConfigCenter() {
  const customized = configItems.filter((c) => c.customized).length;
  const drafts = configItems.filter((c) => c.status === 'draft').length;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">配置中心</h1>
          <div className="page-subtitle">SaaS 的灵魂：写死的规则全部改为「模板 + 租户覆盖」，规则引擎按租户实例执行</div>
        </div>
        <Button onClick={() => message.success('配置变更记录已打开（模拟审计日志）')}>变更审计</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '配置项', value: configItems.length, sub: '标准/路由/分布/复评/调薪/出题/模型' },
          { label: '已个性化覆盖', value: customized, sub: '基于模板做了租户调整' },
          { label: '未覆盖（跟随模板）', value: configItems.length - customized, sub: '模板升级自动继承' },
          { label: '草稿待发布', value: drafts, sub: '草稿不影响线上规则' },
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
          dataSource={configItems}
          pagination={false}
          size="middle"
          columns={[
            {
              title: '配置组',
              width: 170,
              render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.group.replace('（草稿）', '')}</span>,
            },
            {
              title: '模板默认值',
              render: (_: unknown, r) => (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.templateValue}</span>
              ),
            },
            {
              title: '租户覆盖值',
              render: (_: unknown, r) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: r.customized ? 'var(--ink)' : 'var(--ink-4)', fontWeight: r.customized ? 600 : 400 }}>
                    {r.overrideValue}
                  </span>
                  {r.customized && (
                    <Tag style={{ borderRadius: 4, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent', margin: 0 }}>
                      已覆盖
                    </Tag>
                  )}
                </div>
              ),
            },
            {
              title: '状态',
              width: 90,
              render: (_: unknown, r) =>
                r.status === 'active' ? (
                  <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', margin: 0, fontWeight: 600 }}>生效中</Tag>
                ) : (
                  <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', margin: 0, fontWeight: 600 }}>草稿</Tag>
                ),
            },
            { title: '更新时间', width: 110, dataIndex: 'updatedAt' },
            {
              title: '操作',
              width: 140,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex' }}>
                  <Button type="link" size="small" icon={<EditOutlined />} style={{ padding: '0 4px' }} onClick={() => message.info(`编辑「${r.group}」（原型模拟：弹窗表单覆盖配置）`)}>
                    编辑覆盖
                  </Button>
                  {r.status === 'draft' && (
                    <Button type="link" size="small" style={{ color: 'var(--sage)', padding: '0 4px' }} onClick={() => message.success('草稿已发布，规则引擎按新实例执行')}>
                      发布
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>覆盖模型</b>：未覆盖的配置跟随模板，模板升级时自动继承（可在升级前 diff 预览）；个性化覆盖项升级时提示三方合并。
          所有变更走「草稿 → 发布生效」，写审计日志，规则引擎只读取已发布实例，杜绝改配置即出事故。
        </div>
      </Card>
    </div>
  );
}
