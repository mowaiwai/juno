import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  InputNumber,
  Modal,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { ReloadOutlined, SettingOutlined, TableOutlined } from '@ant-design/icons';
import {
  structureGapApi,
  type GapForecastOut,
  type HeadcountRow,
  type HeadcountRowOut,
  type GapConfigOut,
} from '@/api/structureGap';

const SEVERITY_COLOR: Record<string, string> = {
  shortage: 'var(--danger)',
  surplus: 'var(--sage)',
  balanced: 'var(--ink-4)',
};

const SEQ_LABEL: Record<string, string> = {
  SW: '软件序列',
  ENG: '机械序列',
  OP: '工艺序列',
  MGT: '管理序列',
  SAL: '营销序列',
  PUR: '采购序列',
  HR: 'HR 序列',
  OPS: '运维序列',
};

export function GapForecast() {
  const [data, setData] = useState<GapForecastOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // 编制标准编辑
  const [standardsVisible, setStandardsVisible] = useState(false);
  const [standards, setStandards] = useState<HeadcountRowOut[]>([]);
  const [standardsLoading, setStandardsLoading] = useState(false);
  const [standardsSaving, setStandardsSaving] = useState(false);

  // 折算系数编辑
  const [configVisible, setConfigVisible] = useState(false);
  const [config, setConfig] = useState<GapConfigOut | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const loadForecast = () => {
    setLoading(true);
    structureGapApi
      .getForecast()
      .then(setData)
      .catch((e) => {
        if (e?.status === 403) setForbidden(true);
        else message.error(e?.message ?? '加载缺口预测失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadForecast();
  }, []);

  // ---------- 编制标准 ----------
  const openStandards = () => {
    setStandardsVisible(true);
    setStandardsLoading(true);
    structureGapApi
      .getHeadcountStandards()
      .then(setStandards)
      .catch(() => message.error('加载编制标准失败'))
      .finally(() => setStandardsLoading(false));
  };

  const saveStandards = () => {
    setStandardsSaving(true);
    structureGapApi
      .updateHeadcountStandards({ rows: standards })
      .then(() => {
        message.success('编制标准已保存');
        setStandardsVisible(false);
        loadForecast();
      })
      .catch((e) => {
        if (e?.status === 403) message.error('当前角色无权修改编制标准');
        else if (e?.status === 422) message.error('编制标准校验未通过：同一序列+层级不允许重复');
        else message.error(e?.message ?? '保存失败');
      })
      .finally(() => setStandardsSaving(false));
  };

  const addStandardRow = () => {
    setStandards((s) => [...s, { sequence: 'SW', level_order: 1, headcount: 0 }]);
  };

  const removeStandardRow = (idx: number) => {
    setStandards((s) => s.filter((_, i) => i !== idx));
  };

  const updateStandardRow = (idx: number, patch: Partial<HeadcountRow>) => {
    setStandards((s) => s.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // ---------- 折算系数 ----------
  const openConfig = () => {
    setConfigVisible(true);
    setConfigLoading(true);
    structureGapApi
      .getGapConfig()
      .then(setConfig)
      .catch(() => message.error('加载折算系数失败'))
      .finally(() => setConfigLoading(false));
  };

  const configValid =
    !!config &&
    config.factor_l3 <= config.factor_l2 &&
    config.factor_l2 <= config.factor_l1 &&
    config.factor_l1 <= 1 &&
    config.factor_l3 >= 0;

  const saveConfig = () => {
    if (!config || !configValid) return;
    setConfigSaving(true);
    structureGapApi
      .updateGapConfig({
        factor_l1: config.factor_l1,
        factor_l2: config.factor_l2,
        factor_l3: config.factor_l3,
      })
      .then((next) => {
        setConfig(next);
        message.success('折算系数已保存');
        setConfigVisible(false);
        loadForecast();
      })
      .catch((e) => {
        if (e?.status === 403) message.error('当前角色无权修改折算系数');
        else if (e?.status === 422) message.error('系数校验未通过：须满足 0 ≤ f3 ≤ f2 ≤ f1 ≤ 1');
        else message.error(e?.message ?? '保存失败');
      })
      .finally(() => setConfigSaving(false));
  };

  // ---------- 矩阵渲染 ----------
  const sequences = [...new Set(data?.cells.map((c) => c.sequence) ?? [])].sort();
  const levels = [...new Set(data?.cells.map((c) => c.level_order) ?? [])].sort((a, b) => a - b);

  const matrixColumns = [
    {
      title: '序列',
      dataIndex: 'sequence',
      fixed: 'left' as const,
      render: (seq: string) => SEQ_LABEL[seq] ?? seq,
    },
    ...levels.map((lvl) => ({
      title: data?.cells.find((c) => c.level_order === lvl)?.level_name ?? `L${lvl}`,
      dataIndex: `lvl_${lvl}`,
      render: (cell: { gap: number; severity: string; demand: number; supply: number } | null) => {
        if (!cell) return <span style={{ color: 'var(--ink-4)' }}>—</span>;
        const color = SEVERITY_COLOR[cell.severity] ?? 'var(--ink-3)';
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{cell.gap > 0 ? '+' : ''}{cell.gap}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {cell.supply}/{cell.demand}
            </div>
          </div>
        );
      },
    })),
  ];

  const matrixData = sequences.map((seq) => {
    const row: Record<string, unknown> = { sequence: seq };
    for (const lvl of levels) {
      const cell = data?.cells.find((c) => c.sequence === seq && c.level_order === lvl);
      row[`lvl_${lvl}`] = cell
        ? { gap: cell.gap, severity: cell.severity, demand: cell.demand, supply: cell.supply_total }
        : null;
    }
    return row;
  });

  if (forbidden) {
    return (
      <div className="page" style={{ maxWidth: 960 }}>
        <Alert
          type="warning"
          showIcon
          message="当前角色无权查看缺口预测"
          description="缺口预测需 gap.manage 权限（COE·组织与人才发展 / COE·干部管理 / 高管 / 租户管理员）。"
        />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">缺口预测</h1>
          <div className="page-subtitle">
            确定性减法：缺口 = 战略需求 − 现有供给（在岗 + 梯队储备按就绪度折算）
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadForecast}>刷新</Button>
          <Button icon={<TableOutlined />} onClick={openStandards}>编制标准</Button>
          <Button icon={<SettingOutlined />} onClick={openConfig}>折算系数</Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {data && (
          <>
            {/* 摘要卡片 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>战略需求（编制）</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                    {data.summary.total_demand}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>现有供给（折算后）</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                    {data.summary.total_supply}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总缺口</div>
                  <div
                    className="num"
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: data.summary.total_gap < 0 ? 'var(--danger)' : 'var(--sage)',
                    }}
                  >
                    {data.summary.total_gap > 0 ? '+' : ''}{data.summary.total_gap}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>短缺 / 盈余格子</div>
                  <Space size={16} style={{ marginTop: 4 }}>
                    <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 20 }}>
                      {data.summary.shortage_cells}
                    </span>
                    <span style={{ color: 'var(--ink-3)' }}>/</span>
                    <span style={{ color: 'var(--sage)', fontWeight: 700, fontSize: 20 }}>
                      {data.summary.surplus_cells}
                    </span>
                  </Space>
                </Card>
              </Col>
            </Row>

            {/* 配置提示 */}
            {data.config.is_default && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="当前使用平台默认折算系数"
                description={`L1=${data.config.factor_l1} / L2=${data.config.factor_l2} / L3=${data.config.factor_l3}，保存后生成本租户专属配置。`}
              />
            )}

            {/* 未映射职级提示 */}
            {data.unmapped.count > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${data.unmapped.count} 名员工的职级未纳入层级体系`}
                description={`未映射职级：${data.unmapped.grades.join('、')}。这些员工未计入供给，请检查职级通道配置。`}
              />
            )}

            {/* 缺口矩阵 */}
            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="缺口矩阵（行=序列，列=层级）" size="small">
              <Table
                rowKey="sequence"
                dataSource={matrixData}
                columns={matrixColumns}
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 'max-content' }}
              />
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
                每格显示：缺口值（正=盈余/负=短缺）与 供给/需求 明细。
                颜色：<Tag color="red" style={{ borderRadius: 4 }}>短缺</Tag>
                <Tag color="green" style={{ borderRadius: 4 }}>盈余</Tag>
                <Tag style={{ borderRadius: 4 }}>平衡</Tag>
              </div>
            </Card>
          </>
        )}
      </Spin>

      {/* 编制标准编辑弹窗 */}
      <Modal
        title="编制标准配置"
        open={standardsVisible}
        onCancel={() => setStandardsVisible(false)}
        onOk={saveStandards}
        confirmLoading={standardsSaving}
        width={640}
        destroyOnHidden
      >
        <Spin spinning={standardsLoading}>
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--ink-3)' }}>
            按序列 × 层级维护标准编制数，保存后缺口预测即时重算。同一序列+层级不允许重复行。
          </div>
          <Table
            rowKey={(_, idx) => String(idx)}
            dataSource={standards}
            pagination={false}
            size="small"
            columns={[
              {
                title: '序列',
                dataIndex: 'sequence',
                render: (v: string, _, idx) => (
                  <InputNumber
                    value={v}
                    onChange={(val) => updateStandardRow(idx, { sequence: String(val ?? 'SW') })}
                    style={{ width: '100%' }}
                    // 简单起见用 InputNumber 展示，实际可改 Select
                    disabled
                  />
                ),
              },
              {
                title: '层级',
                dataIndex: 'level_order',
                render: (v: number, _, idx) => (
                  <InputNumber
                    min={1}
                    max={6}
                    value={v}
                    onChange={(val) => updateStandardRow(idx, { level_order: val ?? 1 })}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '编制数',
                dataIndex: 'headcount',
                render: (v: number, _, idx) => (
                  <InputNumber
                    min={0}
                    value={v}
                    onChange={(val) => updateStandardRow(idx, { headcount: val ?? 0 })}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '操作',
                render: (_, __, idx) => (
                  <Button type="link" danger size="small" onClick={() => removeStandardRow(idx)}>
                    删除
                  </Button>
                ),
              },
            ]}
          />
          <Button type="dashed" block style={{ marginTop: 8 }} onClick={addStandardRow}>
            + 添加一行
          </Button>
        </Spin>
      </Modal>

      {/* 折算系数编辑弹窗 */}
      <Modal
        title="梯队折算系数"
        open={configVisible}
        onCancel={() => setConfigVisible(false)}
        onOk={saveConfig}
        confirmLoading={configSaving}
        okButtonProps={{ disabled: !configValid }}
        destroyOnHidden
      >
        <Spin spinning={configLoading}>
          {config && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="就绪度三档折算"
                description="梯队储备按就绪度分为 L1（Ready Now）/ L2（1–2 年）/ L3（3 年+），分别乘以折算系数后计入供给。系数越接近 1 表示该档位人才越接近即战力。"
              />
              {(['factor_l1', 'factor_l2', 'factor_l3'] as const).map((key) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                    {key === 'factor_l1' ? 'L1（Ready Now）' : key === 'factor_l2' ? 'L2（1–2 年）' : 'L3（3 年+）'}
                  </div>
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.05}
                    value={config[key]}
                    onChange={(v) => setConfig({ ...config, [key]: v ?? 0 })}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
              {!configValid && (
                <Alert type="error" showIcon message="系数须满足 0 ≤ L3 ≤ L2 ≤ L1 ≤ 1" />
              )}
            </Space>
          )}
        </Spin>
      </Modal>
    </div>
  );
}
