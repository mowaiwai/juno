import { useMemo, useState } from 'react';
import { Card, Col, Progress, Row, Select, Space, Table, Tag } from 'antd';
import { improvementPlans, ACTION_LABEL, ACTION_COLOR, STATUS_LABEL } from '@/mock/gap';
import type { ActionRoute } from '@/mock/gap';
import { departments } from '@/mock/org';

export function ImprovementBoard() {
  const [deptId, setDeptId] = useState('all');
  const [status, setStatus] = useState('all');

  const list = useMemo(() => {
    return improvementPlans.filter((p) => status === 'all' || p.status === status);
  }, [status]);

  const running = list.filter((p) => p.status === 'running').length;
  const done = list.filter((p) => p.status === 'done').length;
  const avgProgress = list.length ? Math.round(list.reduce((s, p) => s + p.progress, 0) / list.length) : 0;

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">改进计划看板</h1>
          <div className="page-subtitle">差距→改进计划→跟踪状态 · 闭环管理</div>
        </div>
        <Space>
          <Select value={deptId} onChange={setDeptId} style={{ width: 180 }} options={[{ value: 'all', label: '全公司' }, ...departments.filter((d) => d.parentId !== '0').map((d) => ({ value: d.id, label: d.name }))]} />
          <Select value={status} onChange={setStatus} style={{ width: 140 }} options={[{ value: 'all', label: '全部状态' }, { value: 'running', label: '进行中' }, { value: 'done', label: '已完成' }, { value: 'pending', label: '待启动' }]} />
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>计划总数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>进行中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{running}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已完成</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{done}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均进度</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{avgProgress}%</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="改进计划清单" size="small">
        <Table
          rowKey="id"
          dataSource={list}
          pagination={false}
          columns={[
            { title: '计划', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.owner} · 主管 {r.manager}</span>
              </Space>
            )},
            {
              title: '动作类型',
              dataIndex: 'action',
              render: (a: ActionRoute) => (
                <Tag style={{ borderRadius: 6, background: ACTION_COLOR[a] + '22', color: ACTION_COLOR[a], borderColor: 'transparent' }}>{ACTION_LABEL[a]}</Tag>
              ),
            },
            {
              title: '进度',
              dataIndex: 'progress',
              render: (v: number) => <Progress percent={v} size="small" strokeColor="var(--clay)" style={{ width: 120 }} />,
            },
            { title: '周期', render: (_: unknown, r) => `${r.startDate} ~ ${r.endDate}` },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: 'pending' | 'running' | 'done' | 'closed') => <Tag style={{ borderRadius: 6 }}>{STATUS_LABEL[s]}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
