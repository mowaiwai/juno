import { useEffect, useState } from 'react';
import {
  Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Progress,
  Row, Select, Space, Spin, Table, Tag, Tooltip, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import {
  CalibrationRule,
  IndicatorIn,
  IndicatorOut,
  IndicatorType,
  PerfGradeMeta,
  PerfStandardsOut,
  perfApi,
} from '@/api/perf';

const TYPE_COLOR: Record<IndicatorType, string> = {
  kpi: 'var(--teal)',
  okr: 'var(--clay)',
  value: 'var(--ochre)',
};
const TYPE_LABEL: Record<IndicatorType, string> = {
  kpi: 'KPI',
  okr: 'OKR',
  value: '价值观',
};
const GRADE_COLOR: Record<string, string> = {
  S: 'var(--clay)', A: 'var(--sage)', B: 'var(--teal)', C: 'var(--ochre)', D: 'var(--ink-3)',
};
const SEQ_OPTIONS = [
  { value: 'SW', label: '软件 SW' }, { value: 'ENG', label: '机械 ENG' },
  { value: 'SAL', label: '销售 SAL' }, { value: 'MGT', label: '管理 MGT' },
  { value: 'FIN', label: '财务 FIN' }, { value: 'HR', label: '人力 HR' },
];

export function PerfStandards() {
  const [data, setData] = useState<PerfStandardsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [indModal, setIndModal] = useState<{ open: boolean; editing?: IndicatorOut }>({ open: false });
  const [ruleModal, setRuleModal] = useState(false);
  const [gradeModal, setGradeModal] = useState(false);
  const [indForm] = Form.useForm<IndicatorIn>();

  const load = () => {
    perfApi.getStandards().then((d) => { setData(d); setLoading(false); })
      .catch(() => { message.error('绩效标准库加载失败'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const saveIndicator = async () => {
    try {
      const values = await indForm.validateFields();
      if (indModal.editing) {
        await perfApi.updateIndicator(indModal.editing.id, values);
        message.success('指标已更新');
      } else {
        await perfApi.createIndicator(values);
        message.success('指标已创建');
      }
      setIndModal({ open: false });
      load();
    } catch { /* 校验失败 */ }
  };

  const removeIndicator = (ind: IndicatorOut) => {
    Modal.confirm({
      title: `删除指标「${ind.name}」？`,
      content: '删除后不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: () => perfApi.deleteIndicator(ind.id).then(() => { message.success('已删除'); load(); }),
    });
  };

  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>{loading ? '加载中…' : <Empty />}</div>;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">绩效管理标准库</h1>
          <div className="page-subtitle">
            考核指标 · 等级定义 · 校准规则 ｜ 绩效标准与任职资格标准解耦维护，供绩效改进与九宫格应用消费
          </div>
        </div>
      </div>

      {/* 考核指标库 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        size="small"
        title={
          <Space>
            <span>考核指标库</span>
            <Tag style={{ borderRadius: 6, margin: 0 }}>{data.indicators.length} 项</Tag>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} style={{ background: 'var(--charcoal)' }}
            onClick={() => { indForm.resetFields(); setIndModal({ open: true }); }}>
            新增指标
          </Button>
        }
      >
        {data.indicators.length === 0 ? (
          <Empty description="暂无考核指标，点击「新增指标」开始" />
        ) : (
          <Table
            rowKey="id"
            dataSource={data.indicators}
            pagination={false}
            size="middle"
            columns={[
              {
                title: '指标名称',
                render: (_: unknown, r: IndicatorOut) => (
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                ),
              },
              {
                title: '类型',
                width: 90,
                render: (_: unknown, r: IndicatorOut) => (
                  <Tag style={{ borderRadius: 6, background: TYPE_COLOR[r.type] + '22', color: TYPE_COLOR[r.type], borderColor: 'transparent' }}>
                    {TYPE_LABEL[r.type]}
                  </Tag>
                ),
              },
              {
                title: '适用序列',
                width: 200,
                render: (_: unknown, r: IndicatorOut) =>
                  r.sequence_codes.length ? r.sequence_codes.join(' · ') : <span style={{ color: 'var(--ink-4)' }}>全序列</span>,
              },
              {
                title: '建议权重',
                width: 110,
                render: (_: unknown, r: IndicatorOut) => (
                  <span className="num">
                    {r.weight_min != null ? `${r.weight_min}–${r.weight_max ?? r.weight_min}%` : '—'}
                  </span>
                ),
              },
              { title: '数据来源', width: 120, dataIndex: 'data_source', render: (v: string | null) => v || '—' },
              {
                title: '操作',
                width: 90,
                render: (_: unknown, r: IndicatorOut) => (
                  <Space size={0}>
                    <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />}
                      onClick={() => { indForm.setFieldsValue(r); setIndModal({ open: true, editing: r }); }} /></Tooltip>
                    <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => removeIndicator(r)} /></Tooltip>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* 等级定义 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)', marginBottom: 16 }}
        size="small"
        title="等级定义（建议分布）"
        extra={
          <Button icon={<SettingOutlined />} onClick={() => setGradeModal(true)}>配置分数线/系数</Button>
        }
      >
        <Row gutter={[12, 12]}>
          {data.grades.map((g: PerfGradeMeta) => (
            <Col span={12} key={g.grade}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: GRADE_COLOR[g.grade] + '22', color: GRADE_COLOR[g.grade], display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 750, flexShrink: 0 }}>
                  {g.grade}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 13 }}>
                    {g.label}
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-4)' }}>{g.grid}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{g.definition}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                    分数线 {g.cutoff} · 系数 {g.coefficient != null ? g.coefficient : '按分数'}
                    {g.distribution_range && ` · 建议占比 ${Math.round(g.distribution_range[0] * 100)}–${Math.round(g.distribution_range[1] * 100)}%`}
                  </div>
                </div>
                {g.distribution_range && (
                  <div style={{ width: 110, flexShrink: 0 }}>
                    <Progress percent={Math.round(g.distribution_range[1] * 100)} size="small" showInfo={false}
                      strokeColor={GRADE_COLOR[g.grade]} trailColor="var(--line)" />
                  </div>
                )}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 校准规则 */}
      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        size="small"
        title="校准规则"
        extra={<Button icon={<EditOutlined />} onClick={() => setRuleModal(true)}>编辑规则</Button>}
      >
        <Row gutter={[12, 12]}>
          {data.calibration_rules.map((r, i) => (
            <Col span={12} key={i}>
              <div style={{ padding: '4px 4px 4px 0' }}>
                <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 指标弹窗 */}
      <Modal
        title={indModal.editing ? '编辑考核指标' : '新增考核指标'}
        open={indModal.open}
        onOk={saveIndicator}
        onCancel={() => setIndModal({ open: false })}
        okText="保存"
        destroyOnClose
      >
        <Form form={indForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
            <Input placeholder="如：营收 / 利润目标达成率" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={[
              { value: 'kpi', label: 'KPI' }, { value: 'okr', label: 'OKR' }, { value: 'value', label: '价值观' },
            ]} />
          </Form.Item>
          <Form.Item name="sequence_codes" label="适用序列">
            <Select mode="multiple" options={SEQ_OPTIONS} placeholder="不选表示全序列" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="weight_min" label="建议权重下限（%）">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="weight_max" label="建议权重上限（%）">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="data_source" label="数据来源">
            <Input placeholder="如：经营系统 / 项目系统 / 上级评估" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 校准规则弹窗 */}
      <CalibrationRulesModal
        open={ruleModal}
        initial={data.calibration_rules}
        onClose={() => setRuleModal(false)}
        onSaved={() => { setRuleModal(false); load(); }}
      />

      {/* 等级常量弹窗 */}
      <GradeConstantsModal
        open={gradeModal}
        onClose={() => setGradeModal(false)}
        onSaved={() => { setGradeModal(false); load(); }}
      />
    </div>
  );
}

function CalibrationRulesModal({ open, initial, onClose, onSaved }: {
  open: boolean; initial: CalibrationRule[]; onClose: () => void; onSaved: () => void;
}) {
  const [rules, setRules] = useState<CalibrationRule[]>(initial);
  useEffect(() => { setRules(initial); }, [open, initial]);

  const save = () => {
    perfApi.updateCalibrationRules(rules).then(() => { message.success('校准规则已保存'); onSaved(); })
      .catch(() => message.error('保存失败'));
  };

  return (
    <Modal title="编辑校准规则" open={open} onOk={save} onCancel={onClose} okText="保存" width={600} destroyOnClose>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Input value={r.title} placeholder="规则标题" style={{ width: 160 }}
              onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
            <Input.TextArea value={r.desc} placeholder="规则说明" rows={2}
              onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
            <Button danger type="text" icon={<DeleteOutlined />}
              onClick={() => setRules(rules.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setRules([...rules, { title: '', desc: '' }])}>
          添加规则
        </Button>
      </div>
    </Modal>
  );
}

function GradeConstantsModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      perfApi.getConstants().then((c) => {
        form.setFieldsValue({
          score_cutoffs: c.score_cutoffs,
          coefficients: c.coefficients,
        });
        setLoading(false);
      }).catch(() => { message.error('加载失败'); setLoading(false); });
    }
  }, [open]);

  const save = async () => {
    try {
      const values = await form.validateFields();
      await perfApi.updateConstants(values);
      message.success('等级常量已保存');
      onSaved();
    } catch { /* 校验失败 */ }
  };

  return (
    <Modal title="配置分数线与系数" open={open} onOk={save} onCancel={onClose} okText="保存" destroyOnClose>
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-3)' }}>分数线（score ≥ 该值即落档，D 兜底）</div>
          <Row gutter={8}>
            {(['S', 'A', 'B', 'C', 'D'] as const).map((g) => (
              <Col span={4} key={g}>
                <Form.Item name={['score_cutoffs', g]} label={g}>
                  <InputNumber min={0} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ink-3)' }}>系数（C 档按分数 ÷ 分母计算，无需配置）</div>
          <Row gutter={8}>
            {(['S', 'A', 'B', 'D'] as const).map((g) => (
              <Col span={5} key={g}>
                <Form.Item name={['coefficients', g]} label={g}>
                  <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Spin>
    </Modal>
  );
}
