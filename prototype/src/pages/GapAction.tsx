import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Progress, Row, Select, Space, Tag, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import {
  ACTION_COLOR, ACTION_LABEL, DIM_TO_ACTION, GAP_DIM_LABEL,
  gapsOf, improvementPlans, STATUS_LABEL,
} from '@/mock/gap';

const SEV_COLOR = { HIGH: 'var(--danger)', MID: 'var(--ochre)', LOW: 'var(--sage)' };
const SEV_LABEL = { HIGH: '高', MID: '中', LOW: '低' };
const PRIORITY_LABEL = { 1: '意愿', 2: '机制', 3: '能力' };

export function GapAction() {
  const [params] = useSearchParams();
  const [empId, setEmpId] = useState(params.get('emp') ?? employees[0].id);
  const emp = employees.find((e) => e.id === empId)!;
  const gaps = useMemo(() => gapsOf(empId), [empId]);
  const plans = improvementPlans.filter((p) => p.employeeId === empId);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">差距详情与动作路由</h1>
          <div className="page-subtitle">逐项差距的标准 vs 现状 · AI 推荐动作路由 · 一键生成改进计划</div>
        </div>
        <Select
          value={empId}
          onChange={setEmpId}
          style={{ width: 240 }}
          showSearch
          optionFilterProp="label"
          options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="员工画像摘要" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="姓名">{emp.name}</Descriptions.Item>
              <Descriptions.Item label="岗位">{emp.position} · {emp.grade}</Descriptions.Item>
              <Descriptions.Item label="部门">{deptName(emp.deptId)}</Descriptions.Item>
              <Descriptions.Item label="绩效">{emp.perf}（{emp.perfScore} 分）</Descriptions.Item>
              <Descriptions.Item label="潜力">{emp.potential === 'HIGH' ? '高' : emp.potential === 'MID' ? '中' : '低'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="差距分布" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {(['perf', 'duty', 'ability', 'contribution', 'knowledge'] as const).map((dim) => {
                const g = gaps.find((x) => x.dimension === dim);
                return (
                  <div key={dim}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>{GAP_DIM_LABEL[dim]}</span>
                      <span style={{ color: g ? SEV_COLOR[g.severity] : 'var(--sage)' }}>{g ? `${SEV_LABEL[g.severity]}差距` : '达标'}</span>
                    </div>
                    <Progress percent={g ? (g.severity === 'HIGH' ? 30 : g.severity === 'MID' ? 55 : 75) : 100} showInfo={false} strokeColor={g ? SEV_COLOR[g.severity] : 'var(--sage)'} size="small" />
                  </div>
                );
              })}
            </Space>
          </Card>
        </Col>

        <Col span={14}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="差距清单（按杨三角优先级排序：意愿＞机制＞能力）"
            size="small"
            extra={<span className="ai-badge">AI 动作路由</span>}
          >
            {gaps.length === 0 ? (
              <Alert type="success" showIcon message="该员工无显著差距，各维度均达标。" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {gaps.map((g) => {
                  const action = DIM_TO_ACTION[g.dimension];
                  return (
                    <Card key={g.id} size="small" variant="borderless" style={{ background: 'var(--surface-sunken)' }}>
                      <Space size={8} style={{ marginBottom: 8 }}>
                        <Tag style={{ borderRadius: 6, background: SEV_COLOR[g.severity] + '22', color: SEV_COLOR[g.severity], borderColor: 'transparent' }}>{SEV_LABEL[g.severity]}</Tag>
                        <Tag style={{ borderRadius: 6, background: 'var(--ink-4)' + '22', color: 'var(--ink-2)', borderColor: 'transparent' }}>{GAP_DIM_LABEL[g.dimension]}</Tag>
                        <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>优先级：{PRIORITY_LABEL[g.priority]}</Tag>
                      </Space>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{g.detail}</div>
                      <Row gutter={12} style={{ fontSize: 12, marginBottom: 8 }}>
                        <Col span={12}>
                          <div style={{ color: 'var(--ink-3)' }}>标准要求</div>
                          <div>{g.standard}</div>
                        </Col>
                        <Col span={12}>
                          <div style={{ color: 'var(--ink-3)' }}>现状</div>
                          <div style={{ color: SEV_COLOR[g.severity] }}>{g.current}</div>
                        </Col>
                      </Row>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>推荐动作：</span>
                          <Tag style={{ borderRadius: 6, background: ACTION_COLOR[action] + '22', color: ACTION_COLOR[action], borderColor: 'transparent', fontWeight: 600 }}>{ACTION_LABEL[action]}</Tag>
                        </div>
                        <Button size="small" icon={<ThunderboltOutlined />} onClick={() => message.success(`已为 ${emp.name} 生成「${ACTION_LABEL[action]}」改进计划`)}>
                          生成改进计划
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </Space>
            )}
          </Card>

          {plans.length > 0 && (
            <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="已关联改进计划" size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {plans.map((p) => (
                  <div key={p.id} style={{ padding: 10, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{p.title}</span>
                      <Tag style={{ borderRadius: 6 }}>{STATUS_LABEL[p.status]}</Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{p.startDate} ~ {p.endDate} · 负责人 {p.owner}</div>
                    <Progress percent={p.progress} size="small" strokeColor="var(--clay)" style={{ marginTop: 6 }} />
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
