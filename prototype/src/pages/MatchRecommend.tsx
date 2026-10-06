import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, InputNumber, Progress, Segmented, Select, Space, Spin, Tag, message } from 'antd';
import { matchApi, DIM_LABEL, LEVEL_LABEL, LEVEL_COLOR, type RecommendOut } from '@/api/match';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { standardsApi, type StandardSetDTO } from '@/api/standards';
import { USE_MOCK } from '@/api/config';
import { useAuth } from '@/store/auth';

/** 持 gap.manage 的内置角色（服务端为最终裁决，403 由页面兜底） */
const MANAGE_ROLES = ['manager', 'hr_coe_cadre', 'hr_coe_perf', 'hr_coe_otd', 'hrbp', 'tenant_admin'];

/** mock 模式下的岗位方向选项（真实模式从已发布标准集加载） */
const MOCK_POSITIONS = [
  { sequence: 'SW', target_grade: 'P4', label: '软件序列 · P4 高级软件工程师' },
  { sequence: 'SW', target_grade: 'P5', label: '软件序列 · P5 资深软件工程师' },
  { sequence: 'ENG', target_grade: 'P4', label: '机械序列 · P4 高级机械工程师' },
  { sequence: 'OP', target_grade: 'T4', label: '工艺序列 · T4 高级技师' },
  { sequence: 'MGT', target_grade: 'M2', label: '管理序列 · M2 部门经理' },
];

type Mode = 'positions' | 'employees';

export function MatchRecommend() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const canManage =
    !!activeRole && (MANAGE_ROLES.includes(activeRole) || activeRole.startsWith('custom:'));

  const [mode, setMode] = useState<Mode>('positions');
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [sets, setSets] = useState<StandardSetDTO[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('');
  const [setId, setSetId] = useState<string>('');
  const [mockPos, setMockPos] = useState<string>(MOCK_POSITIONS[0].label);
  const [limit, setLimit] = useState<number>(5);
  const [result, setResult] = useState<RecommendOut | null>(null);
  const [loading, setLoading] = useState(false);

  // 员工视角固定查本人；HR 可任选数据范围内员工
  const isSelfOnly = !canManage;
  const selfEmployeeId = persona?.employeeId ?? '';

  useEffect(() => {
    if (isSelfOnly) {
      setEmployeeId(selfEmployeeId);
      return;
    }
    employeesApi.list()
      .then(setEmployees)
      .catch(() => message.error('加载员工目录失败'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelfOnly, selfEmployeeId]);

  useEffect(() => {
    if (USE_MOCK || !canManage) return;
    standardsApi.list({ status: 'published' })
      .then(setSets)
      .catch(() => message.error('加载已发布岗位标准失败'));
  }, [canManage]);

  const positionOptions = useMemo(() => {
    if (USE_MOCK) return MOCK_POSITIONS.map((p) => ({ value: p.label, label: p.label }));
    // 同 sequence+target_grade 可能有多版本，列表按版本降序已由后端保证则取首个
    const seen = new Set<string>();
    return sets
      .filter((s) => {
        const key = `${s.sequence}|${s.target_grade}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => ({
        value: s.id,
        label: `${s.sequence} · ${s.target_grade}（v${s.version}）`,
      }));
  }, [sets]);

  const run = () => {
    setLoading(true);
    setResult(null);
    const req =
      mode === 'positions'
        ? { employee_id: employeeId, limit }
        : USE_MOCK
          ? (() => {
              const p = MOCK_POSITIONS.find((x) => x.label === mockPos)!;
              return { sequence: p.sequence, target_grade: p.target_grade, limit };
            })()
          : { standard_set_id: setId, limit };
    matchApi.recommend(req)
      .then(setResult)
      .catch((e) => {
        if (e?.status === 403) message.error('当前角色无权执行一岗多人推荐');
        else if (e?.status === 404) message.error('对象不存在或未发布');
        else message.error(e?.message ?? '推荐查询失败');
      })
      .finally(() => setLoading(false));
  };

  const canRun =
    mode === 'positions'
      ? !!employeeId
      : USE_MOCK
        ? !!mockPos
        : !!setId;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">双向推荐</h1>
          <div className="page-subtitle">一人多岗 TOP 推荐 / 一岗多人候选 · 同一匹配引擎口径</div>
        </div>
        {canManage && (
          <Segmented
            value={mode}
            onChange={(v) => { setMode(v as Mode); setResult(null); }}
            options={[
              { value: 'positions', label: '一人多岗' },
              { value: 'employees', label: '一岗多人' },
            ]}
          />
        )}
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
        <Space size={12} wrap>
          {mode === 'positions' ? (
            <Select
              value={employeeId || undefined}
              onChange={setEmployeeId}
              style={{ width: 280 }}
              placeholder="选择员工"
              disabled={isSelfOnly}
              showSearch
              optionFilterProp="label"
              options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
            />
          ) : (
            <Select
              value={USE_MOCK ? mockPos : setId || undefined}
              onChange={(v) => (USE_MOCK ? setMockPos(v) : setSetId(v))}
              style={{ width: 320 }}
              placeholder="选择目标岗位（已发布标准）"
              options={positionOptions}
            />
          )}
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>TOP</span>
          <InputNumber min={1} max={20} value={limit} onChange={(v) => setLimit(v ?? 5)} style={{ width: 72 }} />
          <Button type="primary" style={{ background: 'var(--charcoal)' }} disabled={!canRun} loading={loading} onClick={run}>
            查询推荐
          </Button>
        </Space>
        {mode === 'positions' && isSelfOnly && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            员工视角默认查询本人可活水岗位；如需查询他人请切换 HR/管理者角色。
          </div>
        )}
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small"
        title={result ? (result.direction === 'positions' ? '推荐岗位' : '候选员工') : '推荐结果'}>
        <Spin spinning={loading}>
          {!result ? (
            <Empty description="选择条件后点击「查询推荐」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : result.items.length === 0 ? (
            <Empty description="范围内暂无可推荐对象" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {result.items.map((item, i) => {
                const title = result.direction === 'positions'
                  ? `${item.sequence} · ${item.target_grade}`
                  : item.name ?? '—';
                const subtitle = result.direction === 'positions' ? null : item.position;
                return (
                  <div
                    key={item.set_id ?? item.employee_id ?? i}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: i === 0 ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                      border: i === 0 ? '1px solid var(--clay)' : '1px solid var(--line)',
                    }}
                  >
                    <Space size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={12}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                          {result.direction === 'employees' ? (item.name?.[0] ?? '?') : i + 1}
                        </span>
                        <div>
                          <Space>
                            <span style={{ fontWeight: 600 }}>{title}</span>
                            {i === 0 && <Tag color="red" style={{ borderRadius: 6 }}>TOP 1</Tag>}
                          </Space>
                          {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{subtitle}</div>}
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right', width: 200 }}>
                        <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--clay)' }}>
                          {item.score === null ? '—' : item.score.toFixed(1)}
                        </div>
                        <Progress
                          percent={item.score ?? 0}
                          showInfo={false}
                          size="small"
                          strokeColor={LEVEL_COLOR[item.level] ?? 'var(--clay)'}
                        />
                      </div>
                    </Space>
                    <Space style={{ marginTop: 8 }} wrap size={4}>
                      <Tag style={{ borderRadius: 6, background: `${LEVEL_COLOR[item.level]}22`, color: LEVEL_COLOR[item.level], borderColor: 'transparent' }}>
                        {LEVEL_LABEL[item.level] ?? item.level}
                      </Tag>
                      {item.missing_dims.map((d) => (
                        <Tag key={d} style={{ borderRadius: 6 }}>缺 {DIM_LABEL[d as keyof typeof DIM_LABEL] ?? d}</Tag>
                      ))}
                    </Space>
                  </div>
                );
              })}
            </Space>
          )}
        </Spin>
      </Card>
    </div>
  );
}
