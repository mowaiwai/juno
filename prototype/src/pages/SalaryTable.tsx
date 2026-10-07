import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, InputNumber, Modal, Row, Table, Tabs, Tag, Spin, Form, message } from 'antd';
import { orgApi, type ChannelFamily, type GradeBand, type SalaryBandIn } from '@/api/org';
import { useAuth } from '@/store/auth';

const fmt = (v: number) => `¥${v.toLocaleString()}`;

/** 持 comp.band.manage 的内置角色（服务端为最终裁决，403 由弹窗兜底） */
const BAND_MANAGE_ROLES = ['tenant_admin', 'hr_coe_comp'];

export function SalaryTable() {
  const activeRole = useAuth((s) => s.activeRole);
  const canManage =
    !!activeRole && (BAND_MANAGE_ROLES.includes(activeRole) || activeRole.startsWith('custom:'));

  const [channels, setChannels] = useState<ChannelFamily[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [seq, setSeq] = useState<string>('');
  const [editing, setEditing] = useState<GradeBand | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<SalaryBandIn>();

  const load = () =>
    orgApi.channels().then((chs) => {
      setChannels(chs);
      setSeq((cur) => cur || chs[0]?.sequences[0] || chs[0]?.family || '');
      setLoading(false);
    });

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo<GradeBand[]>(() => {
    if (!channels) return [];
    const ch = channels.find((c) => c.sequences.includes(seq)) ?? channels[0];
    return ch ? ch.grades : [];
  }, [channels, seq]);

  const openEdit = (r: GradeBand) => {
    setEditing(r);
    form.setFieldsValue({
      grade: r.grade,
      min_value: r.salary_band[0],
      max_value: r.salary_band[1],
      p25: r.p25 ?? undefined,
      p50: r.p50 ?? undefined,
      p75: r.p75 ?? undefined,
      p90: r.p90 ?? undefined,
      market_source_year: r.market_source_year ?? undefined,
    });
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await orgApi.upsertSalaryBand({ ...values, grade: editing!.grade });
      message.success(`${editing!.grade} 带宽已更新`);
      setEditing(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !channels) {
    return (
      <div className="page" style={{ maxWidth: 1200 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">等级工资表</h1>
          <div className="page-subtitle">市场分位锚定带宽 · 渗透率监控 · 75 分位停涨</div>
        </div>
        <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>
          已生效
        </Tag>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖职级</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
              {channels.reduce((s, c) => s + c.grades.length, 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>停涨分位</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>P75</div>
          </Card>
        </Col>
        <Col span={12}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>序列</div>
            <Tabs
              activeKey={seq}
              onChange={setSeq}
              size="small"
              items={channels.map((c) => ({
                key: c.sequences[0] ?? c.family,
                label: c.name,
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
        <Table
          rowKey={(r) => r.grade}
          dataSource={rows}
          pagination={false}
          size="middle"
          columns={[
            { title: '职级', width: 90, render: (_, r) => <span style={{ fontWeight: 700 }}>{r.grade}</span> },
            { title: '名称', width: 120, render: (_, r) => r.title },
            {
              title: '带宽（月基本工资）',
              render: (_, r) => (
                <span className="num" style={{ fontWeight: 600 }}>
                  {fmt(r.salary_band[0])} — {fmt(r.salary_band[1])}
                </span>
              ),
            },
            { title: '带宽比', width: 90, render: (_, r) => <span className="num">{(r.salary_band[1] / r.salary_band[0]).toFixed(2)}</span> },
            {
              title: '市场 P25',
              width: 110,
              render: (_, r) => <span className="num" style={{ color: 'var(--ink-3)' }}>{r.p25 != null ? fmt(r.p25) : '—'}</span>,
            },
            {
              title: '市场 P50',
              width: 110,
              render: (_, r) => <span className="num" style={{ color: 'var(--ink-2)' }}>{r.p50 != null ? fmt(r.p50) : '—'}</span>,
            },
            {
              title: '市场 P75（停涨线）',
              width: 140,
              render: (_, r) => <span className="num" style={{ color: 'var(--danger)' }}>{r.p75 != null ? fmt(r.p75) : '—'}</span>,
            },
            {
              title: '市场 P90',
              width: 110,
              render: (_, r) => <span className="num">{r.p90 != null ? fmt(r.p90) : '—'}</span>,
            },
            {
              title: '数据年份',
              width: 90,
              render: (_, r) => r.market_source_year ?? '—',
            },
            ...(canManage
              ? [
                  {
                    title: '操作',
                    width: 90,
                    render: (_: unknown, r: GradeBand) => (
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openEdit(r)}>
                        维护
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface-sunken)', marginTop: 16 }} size="small">
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
          <b>规则说明</b>：带宽以市场 P50 锚定；渗透率 ≥ P75 触发停涨；D 等 + PIP 不通过自动降薪。
        </div>
      </Card>

      <Modal
        title={`维护带宽 · ${editing?.grade ?? ''}`}
        open={!!editing}
        onOk={save}
        confirmLoading={saving}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="带宽下限（月）" name="min_value" rules={[{ required: true, message: '必填' }]}>
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="带宽上限（月）"
                name="max_value"
                rules={[
                  { required: true, message: '必填' },
                  ({ getFieldValue }) => ({
                    validator: (_, v) =>
                      v == null || v > getFieldValue('min_value')
                        ? Promise.resolve()
                        : Promise.reject(new Error('上限必须大于下限')),
                  }),
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="P25" name="p25">
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="P50" name="p50">
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="P75" name="p75">
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="P90" name="p90">
                <InputNumber style={{ width: '100%' }} min={0} step={100} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="市场数据年份" name="market_source_year">
            <InputNumber style={{ width: 160 }} min={2000} max={2100} precision={0} placeholder="如 2026" />
          </Form.Item>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            保存即覆盖该职级带宽与市场分位（租户级覆盖，写审计）；分位留空表示暂无市场数据。
          </div>
        </Form>
      </Modal>
    </div>
  );
}
