import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Row, Segmented, Space, Table, Tag, Tooltip, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { inventoryApi, type BatchOut, type ResultOut } from '@/api/inventory';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { profilesApi, type ProfileOut } from '@/api/profiles';
import { GRID_CELLS } from '@/mock/inventory';
import { RadarChart } from '@/components/RadarChart';
import { useAuth } from '@/store/auth';
import { ApiError } from '@/api/client';

const DIM_ORDER = ['basic', 'biz', 'contribution', 'duty', 'knowledge', 'ability', 'perf'];

/** 可主导校准的 HR COE 角色：干部管理 / 绩效 / 组织与人才发展 */
const CALIBRATE_ROLES = ['hr_coe_cadre', 'hr_coe_perf', 'hr_coe_otd'];

const POTENTIAL_LABEL: Record<string, string> = { high: '高', mid: '中', low: '低' };

/** 与后端 locate_grid 一致的建议格位：业绩列 × 潜力行 */
function suggestedGrid(r: ResultOut): string | null {
  if (!r.potential || !r.perf_label) return null;
  const col =
    r.perf_label === 'S' || r.perf_label === 'A'
      ? 'A'
      : r.perf_label === 'B'
        ? 'B'
        : 'C';
  const row = r.potential === 'high' ? '1' : r.potential === 'mid' ? '2' : '3';
  return `9${col}${row}`;
}

export function InvCalibrate() {
  const activeRole = useAuth((s) => s.activeRole);
  const [params] = useSearchParams();
  const batchId = params.get('id') ?? '';

  const [batch, setBatch] = useState<BatchOut | null>(null);
  const [results, setResults] = useState<ResultOut[]>([]);
  const [emps, setEmps] = useState<Map<string, EmployeeDirectoryItem>>(new Map());
  const [selected, setSelected] = useState<string>('');
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  /** 各员工校准理由草稿（服务端 calibrate_note 初始化） */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    Promise.all([inventoryApi.get(batchId), inventoryApi.results(batchId), employeesApi.list()])
      .then(([b, res, dir]) => {
        setBatch(b);
        setResults(res);
        setEmps(new Map(dir.map((e) => [e.id, e])));
        setNotes(Object.fromEntries(res.map((r) => [r.employee_id, r.calibrate_note ?? ''])));
        if (res.length && !selected) setSelected(res[0].employee_id);
      })
      .catch(() => message.error('加载盘点数据失败'));
  }, [batchId]);

  useEffect(() => {
    if (!selected) {
      setProfile(null);
      return;
    }
    profilesApi.latest(selected)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [selected]);

  const emp = selected ? emps.get(selected) : undefined;
  const current = results.find((r) => r.employee_id === selected);

  // 仅干部/绩效/OTD 三个 COE 角色在 CALIBRATING 状态可校准；其余角色/状态只读
  const editable =
    !!activeRole && CALIBRATE_ROLES.includes(activeRole) && batch?.status === 'CALIBRATING';

  const locatedCount = results.filter((r) => r.located).length;

  const profileValues = useMemo(() => {
    if (!profile) return [0, 0, 0, 0, 0, 0, 0];
    const m = new Map(profile.dimensions.map((d) => [d.dimension_key, d.score ?? 0]));
    return DIM_ORDER.map((k) => m.get(k) ?? 0);
  }, [profile]);

  const patchResult = (updated: ResultOut) => {
    setResults((list) => list.map((r) => (r.employee_id === updated.employee_id ? updated : r)));
  };

  const failMessage = (e: unknown, fallback: string) =>
    message.error(e instanceof ApiError ? e.message : fallback);

  /** 显式评定潜力：后端据绩效×潜力给出建议格位 */
  const ratePotential = async (potential: string) => {
    if (!current) return;
    setSaving(true);
    try {
      const note = notes[selected]?.trim();
      const updated = await inventoryApi.calibrate(batchId, selected, {
        potential,
        note: note || undefined,
      });
      patchResult(updated);
      message.success(`已评定 ${emp?.name ?? '该员工'} 潜力为「${POTENTIAL_LABEL[potential]}」，系统建议 ${updated.grid_code ?? '—'}`);
    } catch (e) {
      failMessage(e, '潜力评定保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 人工调整格位：与建议不同时后端强制要求校准理由 */
  const applyGrid = async (grid: string) => {
    if (!current) return;
    const note = notes[selected]?.trim();
    if (grid !== suggestedGrid(current) && !note) {
      message.warning('人工调整格位必须填写校准理由');
      return;
    }
    setSaving(true);
    try {
      const updated = await inventoryApi.calibrate(batchId, selected, { grid_code: grid, note });
      patchResult(updated);
      message.success(`已将 ${emp?.name ?? '该员工'} 校准至 ${grid}`);
    } catch (e) {
      failMessage(e, '校准保存失败');
    } finally {
      setSaving(false);
    }
  };

  const reloadAfterSubmit = async () => {
    const [b, res] = await Promise.all([inventoryApi.get(batchId), inventoryApi.results(batchId)]);
    setBatch(b);
    setResults(res);
  };

  const submitCalibration = async () => {
    const unlocated = results.length - locatedCount;
    if (unlocated > 0) {
      message.warning(`还有 ${unlocated} 人未定位，请完成潜力评定后再提交`);
      return;
    }
    try {
      await inventoryApi.submitCalibration(batchId);
      message.success('校准结果已提交租户管理员确认');
      await reloadAfterSubmit();
    } catch (e) {
      failMessage(e, '提交失败');
    }
  };

  const readOnlyBanner = () => {
    if (batch?.status === 'CONFIRMING')
      return <Alert type="info" showIcon style={{ marginBottom: 16 }} message="批次已提交租户管理员确认发布，当前结果只读" />;
    if (batch?.status === 'PUBLISHED')
      return <Alert type="success" showIcon style={{ marginBottom: 16 }} message="批次已发布，九宫格定位已回写员工画像，当前结果只读" />;
    if (activeRole && !CALIBRATE_ROLES.includes(activeRole))
      return <Alert type="info" showIcon style={{ marginBottom: 16 }} message="校准由 COE（干部/绩效/组织发展）主导，您当前为只读视角" />;
    return null;
  };

  return (
    <div className="page" style={{ maxWidth: 1440 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">初排与校准</h1>
          <div className="page-subtitle">
            {batch?.name ?? '加载中…'} · 画像引擎已汇聚绩效/认证/测评生成初排，HR 逐人评定潜力并调整定位
          </div>
        </div>
        <Space>
          <Tag
            style={{
              background: 'var(--clay-soft)',
              color: 'var(--clay)',
              borderColor: 'transparent',
              borderRadius: 6,
            }}
          >
            初排 {results.length} 人
          </Tag>
          <Tag
            style={{
              background: 'var(--sage-soft)',
              color: 'var(--sage)',
              borderColor: 'transparent',
              borderRadius: 6,
            }}
          >
            已定位 {locatedCount} 人
          </Tag>
        </Space>
      </div>

      {readOnlyBanner()}

      <Row gutter={16}>
        <Col span={14}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            size="small"
            title="员工初排列表"
          >
            <Table
              rowKey="employee_id"
              dataSource={results}
              size="small"
              pagination={{ pageSize: 8 }}
              onRow={(r) => ({
                onClick: () => setSelected(r.employee_id),
                style: {
                  cursor: 'pointer',
                  background:
                    selected === r.employee_id ? 'var(--surface-sunken)' : undefined,
                },
              })}
              columns={[
                {
                  title: '员工',
                  render: (_: unknown, r: ResultOut) => {
                    const e = emps.get(r.employee_id);
                    return (
                      <Space>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--clay-soft)',
                            color: 'var(--clay)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                          }}
                        >
                          {e?.name?.[0] ?? '?'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{e?.name ?? r.employee_id}</span>
                      </Space>
                    );
                  },
                },
                {
                  title: '岗位',
                  render: (_: unknown, r: ResultOut) => emps.get(r.employee_id)?.position ?? '—',
                },
                {
                  title: '业绩',
                  dataIndex: 'perf_label',
                  render: (v: string | null) =>
                    v ? (
                      <Tag
                        style={{
                          borderRadius: 6,
                          fontFamily: 'var(--font-mono)',
                          margin: 0,
                        }}
                      >
                        {v}
                      </Tag>
                    ) : (
                      '—'
                    ),
                },
                {
                  title: '能力',
                  dataIndex: 'ability_score',
                  render: (v: number | null) =>
                    v != null ? <span className="num">{v}</span> : '—',
                },
                {
                  title: '潜力',
                  dataIndex: 'potential',
                  render: (v: string | null) =>
                    v ? POTENTIAL_LABEL[v] ?? v : '—',
                },
                {
                  title: '初排',
                  dataIndex: 'grid_code',
                  render: (g: string | null, r: ResultOut) => (
                    <Space>
                      {g && (
                        <Tag
                          style={{
                            background:
                              (GRID_CELLS.find((x) => x.code === g)?.color ?? '#999') + '22',
                            color: GRID_CELLS.find((x) => x.code === g)?.color ?? '#999',
                            borderColor: 'transparent',
                            borderRadius: 6,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {g}
                        </Tag>
                      )}
                      {r.calibrate_note && (
                        <Tag color="green" style={{ borderRadius: 6, margin: 0 }}>
                          人工校准
                        </Tag>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            size="small"
            title={emp ? `${emp.name} · ${emp.position}` : '未选择'}
            extra={editable ? <span className="ai-badge">潜力评定 · 格位校准</span> : undefined}
          >
            {!current || !emp ? (
              <Empty />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={8}>
                  {[
                    { label: '业绩', value: current.perf_label ?? '—', color: 'var(--clay)' },
                    {
                      label: '能力',
                      value: current.ability_score != null ? current.ability_score : '—',
                      color: 'var(--teal)',
                    },
                    {
                      label: '潜力',
                      value: current.potential
                        ? POTENTIAL_LABEL[current.potential] ?? current.potential
                        : '待评定',
                      color: 'var(--ochre)',
                    },
                  ].map((d) => (
                    <Col span={8} key={d.label}>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{d.label}</div>
                      <div
                        className="num"
                        style={{ fontSize: 22, fontWeight: 700, color: d.color }}
                      >
                        {d.value}
                      </div>
                    </Col>
                  ))}
                </Row>

                {profile && (
                  <RadarChart
                    height={220}
                    series={[
                      {
                        name: emp.name,
                        values: profileValues,
                        color: 'var(--clay)',
                      },
                    ]}
                  />
                )}

                {editable && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                      潜力评定（保存后系统按业绩×潜力给出建议格位）
                    </div>
                    <Segmented
                      block
                      value={current.potential ?? undefined}
                      onChange={(v) => ratePotential(String(v))}
                      options={[
                        { value: 'high', label: '高潜' },
                        { value: 'mid', label: '中潜' },
                        { value: 'low', label: '低潜' },
                      ]}
                    />
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
                    当前定位{' '}
                    {current.grid_code && (
                      <Tag
                        style={{
                          color: GRID_CELLS.find((c) => c.code === current.grid_code)?.color,
                          borderColor: 'transparent',
                          background:
                            (GRID_CELLS.find((c) => c.code === current.grid_code)?.color ??
                              '#999') + '22',
                          borderRadius: 6,
                        }}
                      >
                        {current.grid_code} ·{' '}
                        {GRID_CELLS.find((c) => c.code === current.grid_code)?.label}
                      </Tag>
                    )}
                    {current.potential && suggestedGrid(current) !== current.grid_code && (
                      <span style={{ fontSize: 11 }}>
                        （系统建议 {suggestedGrid(current)}）
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {GRID_CELLS.map((c) => {
                      const isCur = current.grid_code === c.code;
                      const btn = (
                        <Button
                          block
                          size="small"
                          disabled={!editable || saving}
                          style={{
                            borderRadius: 8,
                            background: isCur ? c.color : 'transparent',
                            color: isCur ? '#fff' : 'var(--ink-2)',
                            borderColor: isCur ? c.color : 'var(--line)',
                            fontSize: 11,
                            padding: '4px 0',
                          }}
                          onClick={() => applyGrid(c.code)}
                        >
                          {c.code}
                          <br />
                          {c.label}
                        </Button>
                      );
                      return (
                        <Tooltip key={c.code} title={`${c.label} · ${c.strategy}`}>
                          {btn}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                <Input.TextArea
                  rows={2}
                  disabled={!editable}
                  placeholder={
                    editable
                      ? '校准理由：人工调整格位时必填，将与定位一同提交确认'
                      : '当前只读'
                  }
                  value={notes[selected] ?? ''}
                  onChange={(e) =>
                    setNotes((p) => ({ ...p, [selected]: e.target.value }))
                  }
                />

                {editable && (
                  <Space>
                    <Button
                      type="primary"
                      loading={saving}
                      style={{ background: 'var(--charcoal)' }}
                      onClick={submitCalibration}
                    >
                      提交校准
                    </Button>
                    <Button
                      icon={<ThunderboltOutlined />}
                      onClick={() => message.warning('争议已升级至租户管理员裁决')}
                    >
                      升级争议
                    </Button>
                  </Space>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
