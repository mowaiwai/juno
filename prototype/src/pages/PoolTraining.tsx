import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Space, Spin, Table, Tag, message } from 'antd';
import { Button } from 'antd';
import { poolTrainings, POOL_LEVEL_LABEL, TRAINING_STATUS_LABEL } from '@/mock/succession';
import { USE_MOCK } from '@/api/config';
import { successionApi, type TalentPoolOut } from '@/api/succession';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { idpApi, type IDPOut } from '@/api/idp';

const STATUS_COLOR = { doing: 'var(--clay)', done: 'var(--sage)', pending: 'var(--ink-4)' };
const LEVEL_COLOR = { L1: 'var(--danger)', L2: 'var(--ochre)', L3: 'var(--teal)' };

export function MockPoolTraining() {
  const doing = poolTrainings.filter((t) => t.status === 'doing').length;
  const done = poolTrainings.filter((t) => t.status === 'done').length;
  const avg = poolTrainings.length ? Math.round(poolTrainings.reduce((s, t) => s + t.progress, 0) / poolTrainings.length) : 0;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">培养跟踪</h1>
          <div className="page-subtitle">梯队成员培养计划进度 · 带教人 · 效果回看</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>培养计划数</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{poolTrainings.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>进行中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{doing}</div>
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
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{avg}%</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="培养计划清单" size="small">
        <Table
          rowKey="id"
          dataSource={poolTrainings}
          pagination={false}
          columns={[
            { title: '成员', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.employeeName}</span>
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[r.level] + '22', color: LEVEL_COLOR[r.level], borderColor: 'transparent', marginInlineEnd: 0 }}>{POOL_LEVEL_LABEL[r.level]}</Tag>
              </Space>
            )},
            { title: '培养项目', dataIndex: 'program' },
            { title: '带教人', dataIndex: 'mentor' },
            { title: '周期', render: (_: unknown, r) => `${r.startDate} ~ ${r.endDate}` },
            {
              title: '进度',
              dataIndex: 'progress',
              render: (v: number, r) => (
                <Space>
                  <Progress percent={v} size="small" strokeColor={STATUS_COLOR[r.status]} style={{ width: 100 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{v}%</span>
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: 'doing' | 'done' | 'pending') => <Tag style={{ borderRadius: 6, background: STATUS_COLOR[v] + '22', color: STATUS_COLOR[v], borderColor: 'transparent' }}>{TRAINING_STATUS_LABEL[v]}</Tag>,
            },
            {
              title: '操作',
              render: () => (
                <Space>
                  <Button size="small" type="link" onClick={() => message.success('已记录培养进展')}>记录进展</Button>
                  <Button size="small" type="link" onClick={() => message.info('已发起效果回看')}>效果回看</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ---------- 真实后端分支 ----------

type RealStatus = 'doing' | 'done' | 'pending';

interface RealTrainingRow {
  id: string;
  employeeName: string;
  level: string;
  program: string;
  period: string;
  progress: number;
  status: RealStatus;
}

/** IDP 状态 → 培养状态 */
function idpToStatus(idp: IDPOut | undefined): RealStatus {
  if (!idp) return 'pending';
  if (idp.status === 'closed') return 'done';
  if (idp.status === 'draft') return 'pending';
  return 'doing';
}

/** IDP 关键行为完成度 → 培养进度 */
function idpToProgress(idp: IDPOut | undefined): number {
  if (!idp || !idp.key_behaviors.length) return 0;
  const done = idp.key_behaviors.filter((k) => k.status === 'done').length;
  return Math.round((done / idp.key_behaviors.length) * 100);
}

const REAL_TRAINING_STATUS: Record<RealStatus, string> = {
  doing: '进行中',
  done: '已完成',
  pending: '待启动',
};

function RealPoolTraining() {
  const [rows, setRows] = useState<RealTrainingRow[] | null>(null);

  useEffect(() => {
    Promise.all([successionApi.listPools(), employeesApi.list(), idpApi.list()])
      .then(([pools, employees, idps]: [TalentPoolOut[], EmployeeDirectoryItem[], IDPOut[]]) => {
        const empName = new Map(employees.map((e) => [e.id, e.name]));
        // 每个员工取最新一条 IDP（按 period 倒序）
        const latestIdp = new Map<string, IDPOut>();
        for (const i of idps) {
          const cur = latestIdp.get(i.employee_id);
          if (!cur || i.period > cur.period) latestIdp.set(i.employee_id, i);
        }
        const mapped: RealTrainingRow[] = pools
          .filter((p) => p.status === 'active')
          .map((p) => {
            const idp = latestIdp.get(p.employee_id);
            return {
              id: p.id,
              employeeName: empName.get(p.employee_id) ?? '—',
              level: p.pool_level,
              program: idp ? `${idp.period} 个人发展计划（${idp.goals.length} 项目标）` : '待制定 IDP',
              period: idp?.period ?? '—',
              progress: idpToProgress(idp),
              status: idpToStatus(idp),
            };
          });
        setRows(mapped);
      })
      .catch(() => {
        setRows([]);
        message.error('培养跟踪数据加载失败');
      });
  }, []);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const doing = list.filter((t) => t.status === 'doing').length;
    const done = list.filter((t) => t.status === 'done').length;
    const avg = list.length ? Math.round(list.reduce((s, t) => s + t.progress, 0) / list.length) : 0;
    return { total: list.length, doing, done, avg };
  }, [rows]);

  if (!rows) {
    return (
      <div className="page" style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">培养跟踪</h1>
          <div className="page-subtitle">梯队成员最新 IDP 进度 · 进度按关键行为完成度计算</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>在池成员</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{stats.total}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>进行中</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{stats.doing}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>已完成</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{stats.done}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>平均进度</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>{stats.avg}%</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="培养计划清单" size="small">
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无在池梯队成员，请先在梯队池中加入成员" /> }}
          columns={[
            { title: '成员', render: (_: unknown, r: RealTrainingRow) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.employeeName}</span>
                <Tag style={{ borderRadius: 6, background: (LEVEL_COLOR as Record<string, string>)[r.level] + '22', color: (LEVEL_COLOR as Record<string, string>)[r.level], borderColor: 'transparent', marginInlineEnd: 0 }}>
                  {(POOL_LEVEL_LABEL as Record<string, string>)[r.level] ?? r.level}
                </Tag>
              </Space>
            )},
            { title: '培养项目', dataIndex: 'program' },
            { title: '周期', dataIndex: 'period' },
            {
              title: '进度',
              dataIndex: 'progress',
              render: (v: number, r: RealTrainingRow) => (
                <Space>
                  <Progress percent={v} size="small" strokeColor={STATUS_COLOR[r.status]} style={{ width: 100 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{v}%</span>
                </Space>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: RealStatus) => <Tag style={{ borderRadius: 6, background: STATUS_COLOR[v] + '22', color: STATUS_COLOR[v], borderColor: 'transparent' }}>{REAL_TRAINING_STATUS[v]}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}

export function PoolTraining() {
  return USE_MOCK ? <MockPoolTraining /> : <RealPoolTraining />;
}
