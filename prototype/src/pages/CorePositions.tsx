import { useEffect, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Space, Table, Tag, message } from 'antd';
import { Link } from 'react-router-dom';
import { successionApi, type CorePositionView } from '@/api/succession';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const RISK_COLOR = { HIGH: 'var(--danger)', MID: 'var(--ochre)', LOW: 'var(--sage)' };
const RISK_LABEL = { HIGH: '高风险', MID: '中风险', LOW: '低风险' };

export function CorePositions() {
  const [list, setList] = useState<CorePositionView[]>([]);
  const [emps, setEmps] = useState<Map<string, EmployeeDirectoryItem>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([successionApi.listPositions(), employeesApi.list()])
      .then(([positions, dir]) => {
        setList(positions);
        setEmps(new Map(dir.map((e) => [e.id, e])));
      })
      .catch(() => message.error('加载核心岗位数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const nameOf = (id: string | null) => (id ? emps.get(id)?.name ?? '—' : '—');
  const highRisk = list.filter((p) => p.risk === 'HIGH').length;
  const coverage = list.length
    ? Math.round(list.reduce((s, p) => s + p.coverage, 0) / list.length)
    : 0;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">核心岗位清单</h1>
          <div className="page-subtitle">先找核心岗位 · 再盘岗位知识能力 · 72 小时补位配套</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>核心岗位数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高风险岗位</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{highRisk}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均继任覆盖率</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{coverage}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>候选总人数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{list.reduce((s, p) => s + p.candidate_count, 0)}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="核心岗位清单" size="small">
        <Table
          rowKey="id"
          dataSource={list}
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无核心岗位，可通过继任规划模块创建" /> }}
          columns={[
            { title: '岗位', render: (_: unknown, r: CorePositionView) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.dept_id ?? '—'} · {r.grade}</span>
              </Space>
            )},
            { title: '编制', dataIndex: 'headcount' },
            { title: '在岗人', dataIndex: 'incumbent_employee_id', render: (v: string | null) => v ? nameOf(v) : <Tag color="red" style={{ borderRadius: 6 }}>空缺</Tag> },
            {
              title: '继任覆盖',
              render: (_: unknown, r: CorePositionView) => (
                <Space>
                  <Progress percent={r.coverage} size="small" strokeColor="var(--sage)" style={{ width: 100 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{r.candidate_count} 人</span>
                </Space>
              ),
            },
            {
              title: '风险',
              dataIndex: 'risk',
              render: (v: 'HIGH' | 'MID' | 'LOW') => (
                <Tag style={{ borderRadius: 6, background: RISK_COLOR[v] + '22', color: RISK_COLOR[v], borderColor: 'transparent' }}>{RISK_LABEL[v]}</Tag>
              ),
            },
            { title: '风险原因', dataIndex: 'risk_reason', ellipsis: true },
            {
              title: '操作',
              render: (_: unknown, r: CorePositionView) => (
                <Link to={`/app/succession-matrix?id=${r.id}`}>
                  <span style={{ color: 'var(--clay)', cursor: 'pointer', fontSize: 13 }}>查看继任矩阵</span>
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
