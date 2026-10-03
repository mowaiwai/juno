import { useEffect, useState } from 'react';
import { Button, Card, Col, Progress, Row, Select, Space, Tag, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { successionApi, type CorePositionView, type CandidateOut } from '@/api/succession';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const WILLINGNESS_COLOR = { unconfirmed: 'var(--ink-4)', willing: 'var(--sage)', unwilling: 'var(--danger)' };
const WILLINGNESS_LABEL: Record<string, string> = { unconfirmed: '未确认', willing: '愿意', unwilling: '不愿意' };
const ORIGIN_LABEL: Record<string, string> = { auto: '系统初筛', manual: '人工提名' };

export function SuccessionMatrix() {
  const [params] = useSearchParams();
  const [cores, setCores] = useState<CorePositionView[]>([]);
  const [posId, setPosId] = useState<string | null>(params.get('id'));
  const [candidates, setCandidates] = useState<CandidateOut[]>([]);
  const [emps, setEmps] = useState<Map<string, EmployeeDirectoryItem>>(new Map());

  useEffect(() => {
    Promise.all([successionApi.listPositions(), employeesApi.list()]).then(([positions, dir]) => {
      setCores(positions);
      setEmps(new Map(dir.map((e) => [e.id, e])));
      if (!posId && positions.length) setPosId(positions[0].id);
    }).catch(() => message.error('加载核心岗位数据失败'));
  }, []);

  useEffect(() => {
    if (!posId) return;
    successionApi.listCandidates(posId)
      .then(setCandidates)
      .catch(() => message.error('加载候选人数据失败'));
  }, [posId]);

  const core = cores.find((c) => c.id === posId);
  const empOf = (id: string) => emps.get(id);
  const nameOf = (id: string) => empOf(id)?.name ?? '—';

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">继任矩阵图谱</h1>
          <div className="page-subtitle">核心岗位 × 候选人匹配矩阵 · 绩效/履职/意愿</div>
        </div>
        <Select
          value={posId}
          onChange={setPosId}
          style={{ width: 280 }}
          placeholder={cores.length ? '选择岗位' : '暂无核心岗位'}
          options={cores.map((c) => ({ value: c.id, label: `${c.name} · ${c.dept_id ?? ''}` }))}
        />
      </div>

      {core && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
          <Row gutter={24}>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>岗位</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{core.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{core.grade} · 编制 {core.headcount}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>在岗人</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{core.incumbent_employee_id ? nameOf(core.incumbent_employee_id) : '空缺'}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>候选人数</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{candidates.length}</div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>继任覆盖率</div>
              <Progress percent={core.coverage} strokeColor="var(--sage)" showInfo={false} />
            </Col>
          </Row>
        </Card>
      )}

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="候选人匹配矩阵" size="small">
        {candidates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>
            暂无合格候选人，建议启动外部招聘或扩大候选池
            <div style={{ marginTop: 12 }}>
              <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.info('已发起外部招聘需求')}>外部招聘</Button>
            </div>
          </div>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {candidates.map((c, i) => {
              const emp = empOf(c.employee_id);
              return (
                <div
                  key={c.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: i === 0 ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                    border: i === 0 ? '1px solid var(--clay)' : '1px solid var(--line)',
                  }}
                >
                  <Row gutter={12} align="middle">
                    <Col span={6}>
                      <Space size={10}>
                        <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{nameOf(c.employee_id)[0]}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{nameOf(c.employee_id)} {i === 0 && <Tag color="red" style={{ borderRadius: 6, marginInlineStart: 4 }}>首选</Tag>}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{emp?.position ?? '—'}</div>
                        </div>
                      </Space>
                    </Col>
                    <Col span={5}>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>绩效等级</div>
                      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--clay)' }}>{c.perf_label ?? '—'}</div>
                    </Col>
                    <Col span={5}>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>履职分</div>
                      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>{c.duty_score ?? '—'}</div>
                      {c.duty_score != null && <Progress percent={c.duty_score} size="small" strokeColor="var(--teal)" showInfo={false} />}
                    </Col>
                    <Col span={5}>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>意愿</div>
                      <Tag style={{ borderRadius: 6, background: WILLINGNESS_COLOR[c.willingness as keyof typeof WILLINGNESS_COLOR] + '22', color: WILLINGNESS_COLOR[c.willingness as keyof typeof WILLINGNESS_COLOR], borderColor: 'transparent' }}>
                        {WILLINGNESS_LABEL[c.willingness] ?? c.willingness}
                      </Tag>
                    </Col>
                    <Col span={3} style={{ textAlign: 'right' }}>
                      <Space direction="vertical" size={4}>
                        <Tag style={{ borderRadius: 6 }}>{ORIGIN_LABEL[c.origin] ?? c.origin}</Tag>
                        <Button size="small" onClick={() => message.success('已发送意愿确认邀请')}>确认意愿</Button>
                      </Space>
                    </Col>
                  </Row>
                </div>
              );
            })}
          </Space>
        )}
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="补位规则" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
          <li>关键岗位 7–15 条能力模型，半年盘点一次</li>
          <li>候选人需通过知识考试 + 意愿确认方可正式入池</li>
          <li>高风险岗位启动「72 小时补位」机制</li>
          <li>系统初筛：同序列 + 绩效 S/A/B，排除在岗人</li>
        </ul>
      </Card>
    </div>
  );
}
