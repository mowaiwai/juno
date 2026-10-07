import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tag, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { saasApi, type ConfigItemOut, type ConfigStatus } from '@/api/saas';

export function ConfigCenter() {
  const [items, setItems] = useState<ConfigItemOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigItemOut | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { setItems(await saasApi.listConfig()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const customized = items.filter((c) => c.customized).length;
  const drafts = items.filter((c) => c.status === 'draft').length;

  const save = async () => {
    const values = await form.validateFields();
    if (!editing) return;
    await saasApi.updateConfig(editing.id, values);
    message.success('配置已更新');
    setOpen(false);
    setEditing(null);
    load();
  };

  const openEdit = (c: ConfigItemOut) => {
    setEditing(c);
    form.setFieldsValue({ override_value: c.override_value, note: c.note, status: c.status });
    setOpen(true);
  };

  const publish = async (c: ConfigItemOut) => {
    await saasApi.updateConfig(c.id, { status: 'active' });
    message.success('草稿已发布，规则引擎按新实例执行');
    load();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">配置中心</h1>
          <div className="page-subtitle">SaaS 的灵魂：写死的规则全部改为「模板 + 租户覆盖」，规则引擎按租户实例执行</div>
        </div>
        <Button onClick={() => message.info('配置变更审计：所有覆盖/发布操作均已记录')}>变更审计</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '配置项', value: items.length, sub: '标准/路由/分布/复评/调薪/出题/模型' },
          { label: '已个性化覆盖', value: customized, sub: '基于模板做了租户调整' },
          { label: '未覆盖（跟随模板）', value: items.length - customized, sub: '模板升级自动继承' },
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
          dataSource={items}
          loading={loading}
          pagination={false}
          size="middle"
          columns={[
            { title: '配置组', width: 170, render: (_: unknown, r) => <span style={{ fontWeight: 700 }}>{r.group}</span> },
            { title: '模板默认值', render: (_: unknown, r) => <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.template_value}</span> },
            {
              title: '租户覆盖值',
              render: (_: unknown, r) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: r.customized ? 'var(--ink)' : 'var(--ink-4)', fontWeight: r.customized ? 600 : 400 }}>
                    {r.override_value || '—'}
                  </span>
                  {r.customized && (
                    <Tag style={{ borderRadius: 4, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent', margin: 0 }}>已覆盖</Tag>
                  )}
                </div>
              ),
            },
            {
              title: '状态', width: 90,
              render: (_: unknown, r) =>
                r.status === 'active' ? (
                  <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent', margin: 0, fontWeight: 600 }}>生效中</Tag>
                ) : (
                  <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent', margin: 0, fontWeight: 600 }}>草稿</Tag>
                ),
            },
            { title: '更新时间', width: 110, render: (_: unknown, r) => new Date(r.updated_at).toLocaleDateString('zh-CN') },
            {
              title: '操作', width: 140,
              render: (_: unknown, r) => (
                <div style={{ display: 'flex' }}>
                  <Button type="link" size="small" icon={<EditOutlined />} style={{ padding: '0 4px' }} onClick={() => openEdit(r)}>
                    编辑覆盖
                  </Button>
                  {r.status === 'draft' && (
                    <Button type="link" size="small" style={{ color: 'var(--sage)', padding: '0 4px' }} onClick={() => publish(r)}>
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

      <Modal
        title={editing ? `编辑覆盖：${editing.group}` : '编辑覆盖'}
        open={open}
        onOk={save}
        onCancel={() => { setOpen(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="override_value" label="租户覆盖值">
            <Input.TextArea rows={2} placeholder="留空表示跟随模板" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { value: 'active' as ConfigStatus, label: '生效中' },
              { value: 'draft' as ConfigStatus, label: '草稿' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
