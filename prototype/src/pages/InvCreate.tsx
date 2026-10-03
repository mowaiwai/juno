import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Radio, Row, Slider, Space, Spin, Tag, TreeSelect, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { departments } from '@/mock/org';
import { INV_PURPOSE_LABEL } from '@/mock/inventory';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import { orgApi, subtreeDeptIds, type DepartmentItem } from '@/api/org';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { inventoryApi } from '@/api/inventory';

const PURPOSE_OPTIONS = Object.entries(INV_PURPOSE_LABEL).map(([k, v]) => ({ value: k, label: v })) as { value: string; label: string }[];

/** 部门树 */
function buildTree() {
  return departments
    .filter((d) => d.parentId !== '0')
    .map((d) => ({ title: d.name, value: d.id }));
}

export function MockInvCreate() {
  const persona = useAuth((s) => s.persona);
  const [form] = Form.useForm();
  const [weights, setWeights] = useState({ perf: 0.4, ability: 0.3, potential: 0.3 });
  const treeData = useMemo(buildTree, []);

  const total = weights.perf + weights.ability + weights.potential;
  const weightOk = Math.abs(total - 1) < 0.01;

  const submit = () => {
    if (!weightOk) {
      message.warning('三维权重之和必须为 100%');
      return;
    }
    message.success('盘点批次草稿已创建，画像引擎将自动汇聚数据生成初排');
  };

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">发起盘点</h1>
          <div className="page-subtitle">配置目的、维度权重与范围，系统自动汇聚画像数据生成九宫格初排</div>
        </div>
      </div>

      <Alert
        style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}
        type="info"
        showIcon
        message="盘点流程：配置 → 引擎汇聚画像 → 初排（业绩×能力×潜力三维排序）→ 业务校准 → 高管确认 → 归档"
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Form form={form} layout="vertical" initialValues={{ purpose: 'ANNUAL', year: 2026 }}>
          <Form.Item name="name" label="批次名称" rules={[{ required: true, message: '请输入批次名称' }]}>
            <Input placeholder="如 2026 年度人才盘点" />
          </Form.Item>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="purpose" label="盘点目的" rules={[{ required: true }]}>
                <Radio.Group options={PURPOSE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year" label="盘点年度">
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--line)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>三维权重配置</span>
              <Tag style={{ borderRadius: 6, background: weightOk ? 'var(--sage-soft)' : 'var(--danger-soft)', color: weightOk ? 'var(--sage)' : 'var(--danger)', borderColor: 'transparent' }}>
                合计 {Math.round(total * 100)}%
              </Tag>
            </div>
            {[
              { key: 'perf' as const, label: '业绩（过去）', color: 'var(--clay)' },
              { key: 'ability' as const, label: '能力（现在）', color: 'var(--teal)' },
              { key: 'potential' as const, label: '潜力（未来）', color: 'var(--ochre)' },
            ].map((w) => (
              <div key={w.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{w.label}</span>
                  <span className="num" style={{ color: w.color, fontWeight: 600 }}>{Math.round(weights[w.key] * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(weights[w.key] * 100)}
                  onChange={(v) => setWeights((p) => ({ ...p, [w.key]: (v as number) / 100 }))}
                  tooltip={{ formatter: (v) => `${v}%` }}
                />
              </div>
            ))}
            {!weightOk && <div style={{ fontSize: 12, color: 'var(--danger)' }}>权重之和需等于 100%</div>}
          </div>

          <Form.Item name="scope" label="盘点范围（部门）" rules={[{ required: true, message: '请选择盘点范围' }]}>
            <TreeSelect
              treeData={treeData}
              placeholder="选择部门（可多选）"
              multiple
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>

          <Space>
            <Button type="primary" onClick={submit} style={{ background: 'var(--charcoal)' }}>创建批次草稿</Button>
            <Button onClick={() => message.info('已保存为草稿')}>暂存</Button>
          </Space>
        </Form>
      </Card>

      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12, textAlign: 'right' }}>
        创建人：{persona?.name} · 草稿需经 HR 审核后进入校准
      </div>
    </div>
  );
}

// ---------- 真实后端分支 ----------

function RealInvCreate() {
  const persona = useAuth((s) => s.persona);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [weights, setWeights] = useState({ perf: 0.4, ability: 0.3, potential: 0.3 });
  const [depts, setDepts] = useState<DepartmentItem[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[] | null>(null);
  const [scopeDeptIds, setScopeDeptIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([orgApi.departments(), employeesApi.list()])
      .then(([d, e]) => {
        setDepts(d);
        setEmployees(e);
      })
      .catch(() => {
        setDepts([]);
        setEmployees([]);
        message.error('组织与员工目录加载失败');
      });
  }, []);

  const treeData = useMemo(() => {
    if (!depts) return [];
    return depts
      .filter((d) => d.parent_id !== '0')
      .map((d) => ({ title: d.name, value: d.id }));
  }, [depts]);

  // 选中部门 → 展开子树 → 命中员工
  const scopedEmployeeIds = useMemo(() => {
    if (!depts || !employees || !scopeDeptIds.length) return [];
    const all = new Set<string>();
    for (const root of scopeDeptIds) {
      for (const id of subtreeDeptIds(depts, root)) all.add(id);
    }
    return employees.filter((e) => all.has(e.dept_id)).map((e) => e.id);
  }, [depts, employees, scopeDeptIds]);

  const total = weights.perf + weights.ability + weights.potential;
  const weightOk = Math.abs(total - 1) < 0.01;

  const submit = async () => {
    if (!weightOk) {
      message.warning('三维权重之和必须为 100%');
      return;
    }
    const values = await form.validateFields();
    if (!scopedEmployeeIds.length) {
      message.warning('所选部门下暂无员工，请调整盘点范围');
      return;
    }
    setSubmitting(true);
    try {
      // 后端枚举为小写：annual / succession / salary / development
      const batch = await inventoryApi.create(
        values.name,
        String(values.purpose).toLowerCase(),
        scopedEmployeeIds,
      );
      inventoryApi.invalidateBatches();
      message.success(`批次「${batch.name}」已创建，覆盖 ${scopedEmployeeIds.length} 名员工`);
      navigate('/app/inv-batches');
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '创建盘点批次失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!depts || !employees) {
    return (
      <div className="page" style={{ maxWidth: 960, textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">发起盘点</h1>
          <div className="page-subtitle">配置目的与盘点范围，批次创建后可在盘点列表中启动并进入校准</div>
        </div>
      </div>

      <Alert
        style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--line)' }}
        type="info"
        showIcon
        message="盘点流程：配置 → 启动批次 → 引擎汇聚画像生成初排 → HR 校准 → 高管确认 → 发布"
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Form form={form} layout="vertical" initialValues={{ purpose: 'ANNUAL', year: 2026 }}>
          <Form.Item name="name" label="批次名称" rules={[{ required: true, message: '请输入批次名称' }]}>
            <Input placeholder="如 2026 年度人才盘点" />
          </Form.Item>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="purpose" label="盘点目的" rules={[{ required: true }]}>
                <Radio.Group options={PURPOSE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year" label="盘点年度（仅作为名称参考，不入库）">
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--surface-sunken)', border: '1px solid var(--line)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600 }}>三维权重配置（仅作初排参考，当前版本不入库）</span>
              <Tag style={{ borderRadius: 6, background: weightOk ? 'var(--sage-soft)' : 'var(--danger-soft)', color: weightOk ? 'var(--sage)' : 'var(--danger)', borderColor: 'transparent' }}>
                合计 {Math.round(total * 100)}%
              </Tag>
            </div>
            {[
              { key: 'perf' as const, label: '业绩（过去）', color: 'var(--clay)' },
              { key: 'ability' as const, label: '能力（现在）', color: 'var(--teal)' },
              { key: 'potential' as const, label: '潜力（未来）', color: 'var(--ochre)' },
            ].map((w) => (
              <div key={w.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{w.label}</span>
                  <span className="num" style={{ color: w.color, fontWeight: 600 }}>{Math.round(weights[w.key] * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(weights[w.key] * 100)}
                  onChange={(v) => setWeights((p) => ({ ...p, [w.key]: (v as number) / 100 }))}
                  tooltip={{ formatter: (v) => `${v}%` }}
                />
              </div>
            ))}
            {!weightOk && <div style={{ fontSize: 12, color: 'var(--danger)' }}>权重之和需等于 100%</div>}
          </div>

          <Form.Item
            label="盘点范围（部门，含子部门）"
            required
            validateStatus={scopeDeptIds.length ? 'success' : undefined}
            help={
              scopeDeptIds.length
                ? `已选 ${scopeDeptIds.length} 个部门，预计覆盖 ${scopedEmployeeIds.length} 名员工`
                : '请选择至少一个部门'
            }
          >
            <TreeSelect
              treeData={treeData}
              placeholder="选择部门（可多选，自动包含子部门）"
              multiple
              treeDefaultExpandAll
              allowClear
              value={scopeDeptIds}
              onChange={(v) => setScopeDeptIds(v as string[])}
            />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              loading={submitting}
              onClick={submit}
              disabled={!scopeDeptIds.length}
              style={{ background: 'var(--charcoal)' }}
            >
              创建批次草稿
            </Button>
            <Button onClick={() => navigate('/app/inv-batches')}>取消</Button>
          </Space>
        </Form>
      </Card>

      <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 12, textAlign: 'right' }}>
        创建人：{persona?.name} · 创建后可在盘点列表中启动批次
      </div>
    </div>
  );
}

export function InvCreate() {
  return USE_MOCK ? <MockInvCreate /> : <RealInvCreate />;
}
