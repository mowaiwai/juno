import { useMemo, useState } from 'react';
import { Button, Card, Col, Input, Row, Select, Space, Tag, Timeline, message } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { employees } from '@/mock/people';
import { coachingRecords } from '@/mock/gap';

export function Coaching() {
  const [params] = useSearchParams();
  const [empId, setEmpId] = useState(params.get('emp') ?? 'E10086');
  const emp = employees.find((e) => e.id === empId)!;
  const records = useMemo(() => coachingRecords.filter((r) => r.employeeId === empId), [empId]);
  const [note, setNote] = useState('');

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">辅导与效果回看</h1>
          <div className="page-subtitle">绩效辅导记录 · 改进效果回看 · 下期画像对比</div>
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
        <Col span={16}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title={`${emp.name} 的辅导记录`} size="small">
            {records.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)' }}>暂无辅导记录</div>
            ) : (
              <Timeline
                items={records.map((r) => ({
                  color: r.effect ? 'var(--sage)' : 'var(--clay)',
                  children: (
                    <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                      <Space style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 600 }}>{r.type}</span>
                        <Tag style={{ borderRadius: 6 }}>{r.date}</Tag>
                      </Space>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>{r.content}</div>
                      {r.effect && (
                        <div style={{ padding: 10, background: 'var(--sage-soft)', borderRadius: 6, fontSize: 12 }}>
                          <b style={{ color: 'var(--sage)' }}>效果回看：</b>{r.effect}
                        </div>
                      )}
                      {r.nextProfileCompare && (
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--teal)' }}>
                          📈 画像对比：{r.nextProfileCompare}
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="新增辅导记录" size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Input placeholder="辅导类型（如：业绩辅导/知识辅导）" />
              <Input.TextArea rows={4} placeholder="辅导内容" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="primary" block style={{ background: 'var(--charcoal)' }} onClick={() => { message.success('辅导记录已保存'); setNote(''); }}>
                保存记录
              </Button>
            </Space>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="效果回看规则" size="small">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              <li>改进动作完成后自动对比下期画像</li>
              <li>业绩维度变化触发绩效评级更新</li>
              <li>能力/知识提升联动认证路径</li>
              <li>连续两期无改进则升级处理</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
