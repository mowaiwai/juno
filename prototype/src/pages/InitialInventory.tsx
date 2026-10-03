import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Col, Empty, message, Row, Space, Spin, Table, Tag } from 'antd';
import { initialInventory, LEVEL_LABEL } from '@/mock/gap';
import { CHART } from '@/charts/palette';
import { USE_MOCK } from '@/api/config';
import { employeesApi } from '@/api/employees';
import { inventoryApi } from '@/api/inventory';

const LEVEL_COLOR = { qualified: CHART.mint, near: CHART.butter, need_improve: CHART.danger };

type LevelKey = keyof typeof LEVEL_COLOR;

interface InvRow {
  grade: string;
  headcount: number;
  level: LevelKey;
  ratio: number;
}

/** 展示层：Mock 与真实分支共用 */
function InventoryView({ rows, subtitle }: { rows: InvRow[]; subtitle: string }) {
  const total = rows.reduce((s, d) => s + d.headcount, 0);
  const qualified = rows.filter((d) => d.level === 'qualified').reduce((s, d) => s + d.headcount, 0);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: rows.map((d) => d.grade),
      axisLine: { lineStyle: { color: CHART.line } },
      axisLabel: { color: CHART.ink2 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: CHART.ink2 },
      splitLine: { lineStyle: { color: CHART.line } },
    },
    series: [{
      type: 'bar',
      data: rows.map((d) => ({
        value: d.headcount,
        itemStyle: { color: LEVEL_COLOR[d.level], borderRadius: [6, 6, 0, 0] },
      })),
      barWidth: 40,
      label: { show: true, position: 'top', color: CHART.ink2 },
    }],
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">人才初盘</h1>
          <div className="page-subtitle">{subtitle}</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总人数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--clay)' }}>{total}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>达标人数</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--sage)' }}>{qualified}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>达标率</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)' }}>{total ? Math.round((qualified / total) * 100) : 0}%</div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="各职级人数分布" size="small">
            <ReactECharts option={option} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="图例说明" size="small">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(['qualified', 'near', 'need_improve'] as const).map((lv) => (
                <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: LEVEL_COLOR[lv] }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{LEVEL_LABEL[lv]}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {lv === 'qualified' && '绩效 B 以上且潜力非低，可正常晋升/留用'}
                      {lv === 'near' && '接近达标，需补短板后进入达标区'}
                      {lv === 'need_improve' && '需启动绩效改进或能力提升计划'}
                    </div>
                  </div>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="职级水平层级明细" size="small">
        <Table
          rowKey="grade"
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无员工数据" /> }}
          columns={[
            { title: '职级', dataIndex: 'grade' },
            { title: '人数', dataIndex: 'headcount' },
            {
              title: '水平层级',
              dataIndex: 'level',
              render: (v: LevelKey) => (
                <Tag style={{ borderRadius: 6, background: LEVEL_COLOR[v] + '22', color: LEVEL_COLOR[v], borderColor: 'transparent' }}>
                  {LEVEL_LABEL[v]}
                </Tag>
              ),
            },
            { title: '达标率', dataIndex: 'ratio', render: (v: number) => `${Math.round(v * 100)}%` },
          ]}
        />
      </Card>
    </div>
  );
}

function MockInitialInventory() {
  return (
    <InventoryView
      rows={initialInventory()}
      subtitle="各职级水平层级分布 · 先找核心岗位再盘知识能力"
    />
  );
}

// ---------- 真实后端分支 ----------

function RealInitialInventory() {
  const [rows, setRows] = useState<InvRow[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const emps = await employeesApi.list();
        // 潜力取自最新盘点批次结果；无批次或无权限时降级为仅绩效判定
        const potentialByEmp = new Map<string, string | null>();
        try {
          const batches = await inventoryApi.list();
          const sorted = [...batches].sort((a, b) => b.created_at.localeCompare(a.created_at));
          const batch = sorted.find((b) => b.status === 'PUBLISHED') ?? sorted[0];
          if (batch) {
            const results = await inventoryApi.results(batch.id);
            for (const r of results) potentialByEmp.set(r.employee_id, r.potential);
          }
        } catch { /* 降级为仅绩效判定 */ }

        const byGrade = new Map<string, { headcount: number; qualified: number }>();
        for (const e of emps) {
          const g = e.grade || '未设置';
          const cell = byGrade.get(g) ?? { headcount: 0, qualified: 0 };
          cell.headcount += 1;
          // 达标口径与图例一致：绩效 B 以上且潜力非低
          if ((e.perf_grade === 'A' || e.perf_grade === 'B') && potentialByEmp.get(e.id) !== 'low') {
            cell.qualified += 1;
          }
          byGrade.set(g, cell);
        }
        const mapped: InvRow[] = Array.from(byGrade.entries())
          .map(([grade, c]) => {
            const ratio = c.headcount ? c.qualified / c.headcount : 0;
            const level: LevelKey = ratio >= 0.6 ? 'qualified' : ratio >= 0.3 ? 'near' : 'need_improve';
            return { grade, headcount: c.headcount, level, ratio };
          })
          .sort((a, b) => a.grade.localeCompare(b.grade));
        setRows(mapped);
      } catch {
        setRows([]);
        message.error('人才初盘数据加载失败');
      }
    })();
  }, []);

  if (!rows) {
    return (
      <div className="page" style={{ maxWidth: 1200, textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <InventoryView
      rows={rows}
      subtitle="各职级水平层级分布 · 绩效 B 以上且潜力非低视为达标"
    />
  );
}

export function InitialInventory() {
  return USE_MOCK ? <MockInitialInventory /> : <RealInitialInventory />;
}
