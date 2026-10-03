import { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Space, Spin, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { departments } from '@/mock/org';
import { gapApi, ACTION_LABEL, ACTION_COLOR, type TeamGapOut } from '@/api/gap';

const ACT_LABEL = ACTION_LABEL as Record<string, string>;
const ACT_COLOR = ACTION_COLOR as Record<string, string>;

export function GapBoard() {
  const navigate = useNavigate();
  const [deptId, setDeptId] = useState<string>('all');
  const [board, setBoard] = useState<TeamGapOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    gapApi.team(deptId === 'all' ? undefined : deptId)
      .then(setBoard)
      .catch(() => message.error('加载团队差距失败'))
      .finally(() => setLoading(false));
  }, [deptId]);

  const totalGaps = board.reduce((s, r) => s + r.gap_count, 0);
  const highGaps = board.reduce((s, r) => s + r.high_count, 0);

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
        <Spin spinning={loading}>
          <Table<TeamGapOut>
            rowKey="employee_id"
            dataSource={board}
            pagination={{ pageSize: 10 }}
            onRow={(r) => ({ onClick: () => navigate(`/app/gap-action?emp=${r.employee_id}`), style: { cursor: 'pointer' } })}
            columns={[
              { title: '员工', render: (_, r) => (
                <Space>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--clay-soft)', color: 'var(--clay)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{r.name[0]}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position}</div>
                  </div>
                </Space>
              )},
              { title: '部门', dataIndex: 'dept_name' },
              { title: '差距数', dataIndex: 'gap_count', sorter: (a, b) => a.gap_count - b.gap_count },
              {
                title: '高严重度',
                dataIndex: 'high_count',
                render: (v: number) => v > 0 ? <Tag color="red" style={{ borderRadius: 6 }}>{v}</Tag> : '-',
              },
              {
                title: '动作路由',
                dataIndex: 'actions',
                render: (actions: string[]) => (
                  <Space size={4} wrap>
                    {actions.map((a) => (
                      <Tag key={a} style={{ borderRadius: 6, background: ACT_COLOR[a] + '22', color: ACT_COLOR[a], borderColor: 'transparent' }}>
                        {ACT_LABEL[a]}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
        </Spin>
      </Card>
    </div>
  );
}
