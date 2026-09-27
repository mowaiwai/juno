import { useMemo, useState } from 'react';
import { Button, Card, Col, Progress, Row, Select, Space, Tag, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { liquidProjects, matchCandidates } from '@/mock/inventory';
import { employees } from '@/mock/people';

const WILLINGNESS_COLOR: Record<string, string> = { high: 'var(--sage)', mid: 'var(--ochre)', low: 'var(--danger)' };
const WILLINGNESS_LABEL: Record<string, string> = { high: '意愿高', mid: '意愿中', low: '意愿低' };
const READINESS_LABEL: Record<string, string> = { ready: '可立即入组', '6m': '6 个月内就绪', '1y': '1 年内就绪' };

export function LiquidTeam() {
  const [projectId, setProjectId] = useState(liquidProjects[0].id);
  const project = liquidProjects.find((p) => p.id === projectId)!;
  const candidates = useMemo(() => matchCandidates(project), [project]);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">液态组队</h1>
          <div className="page-subtitle">按项目能力要求智能匹配候选队员，支撑跨部门敏捷组队</div>
        </div>
        <Select
          value={projectId}
          onChange={setProjectId}
          style={{ width: 320 }}
          options={liquidProjects.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="项目能力要求" size="small">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                <b>{project.name}</b>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>所属：{project.deptName} · 截止 {project.deadline}</div>
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
          </Card>
        </Col>

        <Col span={16}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="候选队员匹配" size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {candidates.map((c, i) => {
                const emp = employees.find((e) => e.id === c.employeeId)!;
                return (
                  <div
                    key={c.employeeId}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: i === 0 ? 'var(--clay-soft)' : 'var(--surface-sunken)',
                      border: i === 0 ? '1px solid var(--clay)' : '1px solid var(--line)',
                    }}
                  >
                    <Space size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={12}>
                        <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{emp.name[0]}</span>
                        <div>
                          <Space>
                            <span style={{ fontWeight: 600 }}>{emp.name}</span>
                            {i === 0 && <Tag color="red" style={{ borderRadius: 6 }}>推荐</Tag>}
                          </Space>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{emp.position} · {emp.grade}</div>
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right', width: 200 }}>
                        <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--clay)' }}>{c.matchScore}</div>
                        <Progress percent={c.matchScore} showInfo={false} size="small" strokeColor="var(--clay)" style={{ width: '100%' }} />
                      </div>
                    </Space>
                    <Space style={{ marginTop: 8 }} wrap>
                      <Tag style={{ borderRadius: 6, background: WILLINGNESS_COLOR[c.willingness] + '22', color: WILLINGNESS_COLOR[c.willingness], borderColor: 'transparent' }}>
                        {WILLINGNESS_LABEL[c.willingness]}
                      </Tag>
                      <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
                        {READINESS_LABEL[c.readiness]}
                      </Tag>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.reason}</span>
                    </Space>
                  </div>
                );
              })}
            </Space>

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
