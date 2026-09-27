import { useMemo, useState } from 'react';
import { Button, Card, Col, Row, Select, Space, Table, Tag, message } from 'antd';
import { poolMembers, POOL_LEVEL_LABEL } from '@/mock/succession';
import type { PoolLevel } from '@/mock/succession';

const LEVEL_COLOR = { L1: 'var(--danger)', L2: 'var(--ochre)', L3: 'var(--teal)' };
const STATUS_LABEL = { active: '在池', graduated: '已出池', exited: '已退出' };

export function TalentPool() {
  const [level, setLevel] = useState<string>('all');
  const list = useMemo(() => poolMembers.filter((m) => level === 'all' || m.level === level), [level]);

  const l1 = poolMembers.filter((m) => m.level === 'L1').length;
  const l2 = poolMembers.filter((m) => m.level === 'L2').length;
  const l3 = poolMembers.filter((m) => m.level === 'L3').length;

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">梯队池管理</h1>
          <div className="page-subtitle">入池/出池规则 · 一级（核心继任）/ 二级（重点培养）/ 三级（潜力储备）</div>
        </div>
        <Space>
          <Select value={level} onChange={setLevel} style={{ width: 180 }} options={[{ value: 'all', label: '全部梯队' }, { value: 'L1', label: '一级梯队' }, { value: 'L2', label: '二级梯队' }, { value: 'L3', label: '三级梯队' }]} />
          <Button icon={<span>+</span>} onClick={() => message.success('已打开入池提名')}>提名入池</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {([
          { lv: 'L1' as PoolLevel, count: l1 },
          { lv: 'L2' as PoolLevel, count: l2 },
          { lv: 'L3' as PoolLevel, count: l3 },
        ]).map((s) => (
          <Col span={8} key={s.lv}>
            <Card variant="borderless" style={{ background: 'var(--surface)', borderTop: `3px solid ${LEVEL_COLOR[s.lv]}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: LEVEL_COLOR[s.lv] }}>{POOL_LEVEL_LABEL[s.lv]}</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{s.count}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>人</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="梯队成员清单" size="small">
        <Table
          rowKey="employeeId"
          dataSource={list}
          pagination={false}
          columns={[
            { title: '成员', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position}</span>
              </Space>
            )},
            {
              title: '梯队层级',
              dataIndex: 'level',
              render: (v: PoolLevel) => (
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[v] + '22', color: LEVEL_COLOR[v], borderColor: 'transparent' }}>{POOL_LEVEL_LABEL[v]}</Tag>
              ),
            },
            { title: '入池依据', dataIndex: 'reason', ellipsis: true },
            { title: '入池时间', dataIndex: 'joinedAt' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: 'active' | 'graduated' | 'exited') => <Tag style={{ borderRadius: 6 }}>{STATUS_LABEL[v]}</Tag>,
            },
            {
              title: '操作',
              render: () => (
                <Space>
                  <Button size="small" type="link" onClick={() => message.success('已调出培养计划')}>培养跟踪</Button>
                  <Button size="small" type="link" danger onClick={() => message.warning('已启动出池评估')}>出池</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="入池/出池规则" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
          <li><b>入池：</b>绩效 B 以上 + 潜力非低 + 管委会/部门提名</li>
          <li><b>一级：</b>高潜 + 高管级绩效，核心岗位继任候选</li>
          <li><b>二级：</b>绩效 A + 潜力中高，重点培养对象</li>
          <li><b>三级：</b>绩效稳定 + 有潜力，储备观察</li>
          <li><b>出池：</b>晋升到岗 / 连续两期绩效 C / 主动退出 / 超龄</li>
        </ul>
      </Card>
    </div>
  );
}
