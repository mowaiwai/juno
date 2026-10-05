import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Empty, Spin, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { perfApi } from '@/api/perf';
import type { MyResultOut, MyPerfOut, PipOut } from '@/api/perf';
import { GRADE_COLOR, TOOL_LABEL, WRITEBACK_TOOLS } from '@/api/perf';
import { useAuth } from '@/store/auth';

const PIP_STATUS: Record<PipOut['status'], { label: string; color: string }> = {
  active: { label: '改进中', color: 'orange' },
  passed: { label: '已通过', color: 'green' },
  failed: { label: '未通过', color: 'red' },
};

export function MyPerf() {
  const { persona } = useAuth();
  const [data, setData] = useState<MyPerfOut | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!persona) return;
    const selfId = persona.employeeId ?? persona.id;
    setLoading(true);
    try {
      // 真实模式后端按当前登录人返回，入参仅 mock 用于定位员工
      const res = await perfApi.myPerf(selfId);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [persona]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的绩效</h1>
          <div className="page-subtitle">已发布考核结果 · 我的绩效改进计划（PIP）</div>
        </div>
      </div>

      <Spin spinning={loading}>
        <Card
          variant="borderless"
          style={{ background: 'var(--surface)', marginBottom: 16 }}
          title="已发布考核结果"
          size="small"
        >
          {data && data.results.length > 0 ? (
            <Table
              rowKey="plan_id"
              dataSource={data.results}
              pagination={false}
              columns={[
                { title: '周期', dataIndex: 'period', width: 120 },
                {
                  title: '考核工具',
                  dataIndex: 'tool_type',
                  width: 120,
                  render: (t: MyResultOut['tool_type']) => TOOL_LABEL[t],
                },
                {
                  title: '等级',
                  dataIndex: 'grade',
                  width: 90,
                  render: (g: MyResultOut['grade']) => (
                    <Tag
                      style={{
                        borderRadius: 6,
                        background: GRADE_COLOR[g] + '22',
                        color: GRADE_COLOR[g],
                        borderColor: 'transparent',
                      }}
                    >
                      {g}
                    </Tag>
                  ),
                },
                {
                  title: '分数',
                  dataIndex: 'score',
                  width: 90,
                  render: (v: number | null) => v ?? '—',
                },
                {
                  title: '绩效系数',
                  dataIndex: 'coefficient',
                  width: 100,
                  render: (v: number) => v.toFixed(2),
                },
                {
                  title: '发布时间',
                  dataIndex: 'published_at',
                  width: 130,
                  render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
                },
                {
                  title: '说明',
                  render: (_: unknown, r: MyResultOut) =>
                    WRITEBACK_TOOLS.includes(r.tool_type) ? (
                      <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>已回写员工档案等级</span>
                    ) : (
                      <span style={{ color: 'var(--ochre)', fontSize: 12 }}>
                        仅作结果沉淀，不回写档案等级
                      </span>
                    ),
                },
              ]}
            />
          ) : (
            <Empty description="暂无已发布的考核结果" style={{ padding: 32 }} />
          )}
        </Card>

        <Card
          variant="borderless"
          style={{ background: 'var(--surface)' }}
          title="我的绩效改进计划（PIP）"
          size="small"
        >
          {data && data.pips.length > 0 ? (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="D 等（PBC/KPI）发布后自动进入绩效改进计划；结论录入后终结，不可修改。"
              />
              <Table
                rowKey="id"
                dataSource={data.pips}
                pagination={false}
                columns={[
                  { title: '周期', dataIndex: 'period', width: 120 },
                  {
                    title: '改进目标',
                    dataIndex: 'goals',
                    render: (goals: string[]) =>
                      goals.length === 0 ? '—' : goals.join('；'),
                  },
                  {
                    title: '截止日期',
                    dataIndex: 'deadline',
                    width: 120,
                    render: (v: string | null) => v ?? '—',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: (s: PipOut['status']) => (
                      <Tag color={PIP_STATUS[s].color}>{PIP_STATUS[s].label}</Tag>
                    ),
                  },
                  {
                    title: '结论',
                    dataIndex: 'conclusion',
                    width: 120,
                    render: (v: string | null) => v ?? '—',
                  },
                ]}
              />
            </>
          ) : (
            <Empty description="暂无 PIP 记录" style={{ padding: 32 }} />
          )}
        </Card>
      </Spin>
    </div>
  );
}
