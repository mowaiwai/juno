import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Progress, Row, Select, Space, Spin, Tag, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { employees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { gapApi, ACTION_LABEL, ACTION_COLOR, GAP_DIM_LABEL, DIM_TO_ACTION, type GapOut } from '@/api/gap';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const SEV_COLOR: Record<string, string> = { HIGH: 'var(--danger)', MID: 'var(--ochre)', LOW: 'var(--sage)' };
const SEV_LABEL: Record<string, string> = { HIGH: '高', MID: '中', LOW: '低' };
const PRIORITY_LABEL: Record<number, string> = { 1: '意愿', 2: '机制', 3: '能力' };
const DIM_LABEL = GAP_DIM_LABEL as Record<string, string>;
const DIM_ACTION = DIM_TO_ACTION as Record<string, string>;
const ACT_LABEL = ACTION_LABEL as Record<string, string>;
const ACT_COLOR = ACTION_COLOR as Record<string, string>;

export function GapAction() {
  const [params] = useSearchParams();
  const [emps, setEmps] = useState<EmployeeDirectoryItem[]>([]);
  const [empId, setEmpId] = useState<string>(params.get('emp') ?? '');
  const [gaps, setGaps] = useState<GapOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeesApi.list().then((dir) => {
      setEmps(dir);
      const paramEmp = params.get('emp');
      const defaultEmp = paramEmp ?? (dir.length ? dir[0].id : '');
      if (defaultEmp) setEmpId(defaultEmp);
    }).catch(() => message.error('加载员工目录失败'));
  }, []);

  useEffect(() => {
    if (!empId) return;
    setLoading(true);
    gapApi.list()
      .then((all) => setGaps(all.filter((g) => g.employee_id === empId)))
      .catch(() => message.error('加载差距数据失败'))
      .finally(() => setLoading(false));
  }, [empId]);

  const emp = employees.find((e) => e.id === empId);
  const empDir = emps.find((e) => e.id === empId);

  const handleGenerate = (g: GapOut) => {
    gapApi.action({ gap_ids: [g.id] })
      .then((res) => {
        const suggestion = res[0]?.suggestion ?? '改进计划已生成';
        message.success(`已为 ${emp?.name ?? empDir?.name ?? ''} 生成「${ACT_LABEL[g.action] ?? g.action}」改进计划：${suggestion}`);
      })
      .catch(() => message.error('生成改进计划失败'));
  };

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
          placeholder={emps.length ? '选择员工' : '暂无员工'}
          options={emps.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="员工画像摘要" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="姓名">{emp?.name ?? empDir?.name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="岗位">{(emp?.position ?? empDir?.position) ?? '—'} · {(emp?.grade ?? empDir?.grade) ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="部门">{emp ? deptName(emp.deptId) : '—'}</Descriptions.Item>
              <Descriptions.Item label="绩效">{emp ? `${emp.perf}（${emp.perfScore} 分）` : '—'}</Descriptions.Item>
              <Descriptions.Item label="潜力">{emp ? (emp.potential === 'HIGH' ? '高' : emp.potential === 'MID' ? '中' : '低') : '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="差距分布" size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {(['perf', 'duty', 'ability', 'contribution', 'knowledge'] as const).map((dim) => {
                const g = gaps.find((x) => x.dimension === dim);
                return (
                  <div key={dim}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                      <span>{DIM_LABEL[dim]}</span>
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
            <Spin spinning={loading}>
              {gaps.length === 0 ? (
                <Alert type="success" showIcon message="该员工无显著差距，各维度均达标。" />
              ) : (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {gaps.map((g) => {
                    const action = DIM_ACTION[g.dimension] ?? g.action;
                    return (
                      <Card key={g.id} size="small" variant="borderless" style={{ background: 'var(--surface-sunken)' }}>
                        <Space size={8} style={{ marginBottom: 8 }}>
                          <Tag style={{ borderRadius: 6, background: SEV_COLOR[g.severity] + '22', color: SEV_COLOR[g.severity], borderColor: 'transparent' }}>{SEV_LABEL[g.severity]}</Tag>
                          <Tag style={{ borderRadius: 6, background: 'var(--ink-4)' + '22', color: 'var(--ink-2)', borderColor: 'transparent' }}>{DIM_LABEL[g.dimension]}</Tag>
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
                            <Tag style={{ borderRadius: 6, background: ACT_COLOR[action] + '22', color: ACT_COLOR[action], borderColor: 'transparent', fontWeight: 600 }}>{ACT_LABEL[action]}</Tag>
                          </div>
                          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleGenerate(g)}>
                            生成改进计划
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </Space>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
