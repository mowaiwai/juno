import { useEffect, useState } from 'react';
import { Button, Card, Col, Progress, Row, Select, Space, Spin, Tag, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { orgApi, type LiquidProjectOut, type TeamCandidateOut } from '@/api/orgDiagnosis';
import { DIM_LABEL } from '@/api/match';

// 统一匹配引擎口径：willing/unwilling/unconfirmed；mock 旧数据兼容 high/mid/low
const WILLINGNESS_COLOR: Record<string, string> = {
  willing: 'var(--sage)', unconfirmed: 'var(--ochre)', unwilling: 'var(--danger)',
  high: 'var(--sage)', mid: 'var(--ochre)', low: 'var(--danger)',
};
const WILLINGNESS_LABEL: Record<string, string> = {
  willing: '愿意', unconfirmed: '意愿未确认', unwilling: '不愿意',
  high: '意愿高', mid: '意愿中', low: '意愿低',
};
const READINESS_LABEL: Record<string, string> = {
  ready: '可立即入组', developing: '待培养', gap: '有差距',
  '6m': '6 个月内就绪', '1y': '1 年内就绪',
};
const READINESS_COLOR: Record<string, string> = {
  ready: 'var(--sage)', developing: 'var(--ochre)', gap: 'var(--danger)',
};

export function LiquidTeam() {
  const [projects, setProjects] = useState<LiquidProjectOut[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [candidates, setCandidates] = useState<TeamCandidateOut[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    setLoadingProjects(true);
    orgApi.liquidProjects()
      .then((list) => {
        setProjects(list);
        if (list.length && !projectId) setProjectId(list[0].id);
      })
      .catch(() => message.error('加载项目数据失败'))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoadingTeam(true);
    orgApi.projectTeam({ project_id: projectId })
      .then(setCandidates)
      .catch(() => message.error('加载候选队员失败'))
      .finally(() => setLoadingTeam(false));
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">液态组队</h1>
          <div className="page-subtitle">按项目能力要求智能匹配候选队员，支撑跨部门敏捷组队</div>
        </div>
        <Select
          value={projectId || undefined}
          onChange={setProjectId}
          style={{ width: 320 }}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="项目能力要求" size="small">
            <Spin spinning={loadingProjects}>
              {project ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    <b>{project.name}</b>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>所属：{project.dept_name} · 截止 {project.deadline}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>所需能力</div>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {project.needs.map((n) => (
                        <div key={n.ability} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>{n.ability}</span>
                          <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}>
                            L{n.level}
                          </Tag>
                        </div>
                      ))}
                    </Space>
                  </div>
                  <div style={{ padding: 12, background: 'var(--teal-soft)', borderRadius: 8, fontSize: 12, color: 'var(--ink-2)' }}>
                    <TeamOutlined style={{ color: 'var(--teal)', marginRight: 6 }} />
                    系统将基于员工画像的知识/能力维度，结合意愿度与就绪度匹配候选队员。
                  </div>
                </Space>
              ) : (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>暂无项目</div>
              )}
            </Spin>
          </Card>
        </Col>

        <Col span={16}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="候选队员匹配" size="small">
            <Spin spinning={loadingTeam}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {candidates.map((c, i) => (
                  <div
                    key={c.employee_id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: i === 0 ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                      border: i === 0 ? '1px solid var(--clay)' : '1px solid var(--line)',
                    }}
                  >
                    <Space size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={12}>
                        <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{c.name[0]}</span>
                        <div>
                          <Space>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            {i === 0 && <Tag color="red" style={{ borderRadius: 6 }}>推荐</Tag>}
                          </Space>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.position}</div>
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right', width: 200 }}>
                        <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{c.match_score.toFixed(1)}</div>
                        <Progress percent={c.match_score} showInfo={false} size="small" strokeColor="var(--clay)" style={{ width: '100%' }} />
                      </div>
                    </Space>
                    <Space style={{ marginTop: 8 }} wrap size={4}>
                      <Tag style={{ borderRadius: 6, background: (WILLINGNESS_COLOR[c.willingness] ?? 'var(--ink-4)') + '22', color: WILLINGNESS_COLOR[c.willingness] ?? 'var(--ink-4)', borderColor: 'transparent' }}>
                        {WILLINGNESS_LABEL[c.willingness] ?? c.willingness}
                      </Tag>
                      <Tag style={{ borderRadius: 6, background: (READINESS_COLOR[c.readiness] ?? 'var(--teal)') + '22', color: READINESS_COLOR[c.readiness] ?? 'var(--teal)', borderColor: 'transparent' }}>
                        {READINESS_LABEL[c.readiness] ?? c.readiness}
                      </Tag>
                      {(c.missing_dims ?? []).map((d) => (
                        <Tag key={d} style={{ borderRadius: 6 }}>缺 {DIM_LABEL[d as keyof typeof DIM_LABEL] ?? d}</Tag>
                      ))}
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.reason}</span>
                    </Space>
                  </div>
                ))}
              </Space>
            </Spin>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => message.info('已通知候选员工')}>批量通知入组</Button>
                <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => message.success('组队方案已生成')}>生成组队方案</Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
