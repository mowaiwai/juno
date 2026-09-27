import { useMemo, useState } from 'react';
import { Card, Col, Row, Select, Space, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { departments } from '@/mock/org';
import { ACTION_LABEL, ACTION_COLOR, teamGapBoard } from '@/mock/gap';
import type { ActionRoute } from '@/mock/gap';

export function GapBoard() {
  const navigate = useNavigate();
  const [deptId, setDeptId] = useState<string>('all');
  const board = useMemo(() => {
    if (deptId === 'all') return teamGapBoard();
    return teamGapBoard(deptId);
  }, [deptId]);

  const totalGaps = board.reduce((s, r) => s + r.gapCount, 0);
  const highGaps = board.reduce((s, r) => s + r.highCount, 0);

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">差距分析看板</h1>
          <div className="page-subtitle">标准×现状比对 · 差距类型自动路由至改进动作（杨三角优先级）</div>
        </div>
        <Select
          value={deptId}
          onChange={setDeptId}
          style={{ width: 220 }}
          options={[
            { value: 'all', label: '全公司' },
            ...departments.filter((d) => d.parentId !== '0').map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>覆盖员工</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--clay)' }}>{board.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>差距总数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ochre)' }}>{totalGaps}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高严重度差距</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{highGaps}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>人均差距</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)' }}>{board.length ? (totalGaps / board.length).toFixed(1) : 0}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="团队差距清单" size="small">
        <Table
          rowKey="employeeId"
          dataSource={board}
          pagination={{ pageSize: 10 }}
          onRow={(r) => ({ onClick: () => navigate(`/app/gap-action?emp=${r.employeeId}`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '员工', render: (_: unknown, r) => (
              <Space>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--clay-soft)', color: 'var(--clay)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{r.name[0]}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position}</div>
                </div>
              </Space>
            )},
            { title: '部门', dataIndex: 'deptName' },
            { title: '差距数', dataIndex: 'gapCount', sorter: (a, b) => a.gapCount - b.gapCount },
            {
              title: '高严重度',
              dataIndex: 'highCount',
              render: (v: number) => v > 0 ? <Tag color="red" style={{ borderRadius: 6 }}>{v}</Tag> : '-',
            },
            {
              title: '动作路由',
              dataIndex: 'actions',
              render: (actions: ActionRoute[]) => (
                <Space size={4} wrap>
                  {actions.map((a) => (
                    <Tag key={a} style={{ borderRadius: 6, background: ACTION_COLOR[a] + '22', color: ACTION_COLOR[a], borderColor: 'transparent' }}>
                      {ACTION_LABEL[a]}
                    </Tag>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
