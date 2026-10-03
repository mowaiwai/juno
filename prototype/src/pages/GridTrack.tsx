import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Col, Empty, Row, Select, Space, Spin, Tag, Timeline, message } from 'antd';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { orgApi, type DepartmentItem } from '@/api/org';
import { inventoryApi, type TrackPoint } from '@/api/inventory';
import { GRID_CELLS } from '@/mock/inventory';
import { CHART } from '@/charts/palette';

const POTENTIAL_LABEL: Record<string, string> = { high: '高', mid: '中', low: '低' };

export function GridTrack() {
  const [emps, setEmps] = useState<EmployeeDirectoryItem[] | null>(null);
  const [depts, setDepts] = useState<Map<string, DepartmentItem>>(new Map());
  const [empId, setEmpId] = useState<string>('');
  const [tracks, setTracks] = useState<TrackPoint[] | null>(null);

  useEffect(() => {
    Promise.all([employeesApi.list(), orgApi.departments()])
      .then(([list, d]) => {
        setEmps(list);
        setDepts(new Map(d.map((x) => [x.id, x])));
        if (list.length) setEmpId(list[0].id);
      })
      .catch(() => message.error('员工目录加载失败'));
  }, []);

  useEffect(() => {
    if (!empId) return;
    setTracks(null);
    inventoryApi.tracks(empId).then(setTracks).catch(() => {
      setTracks([]);
      message.error('轨迹加载失败');
    });
  }, [empId]);

  const emp = emps?.find((e) => e.id === empId);
  const latest = tracks?.length ? tracks[tracks.length - 1] : null;

  // 折线：X=已发布批次，Y=潜力行；标签显示格码
  const option = useMemo(() => {
    const rows = (tracks ?? []).filter((t) => t.grid_code);
    return {
      grid: { left: 40, right: 20, top: 30, bottom: 60 },
      xAxis: {
        type: 'category',
        data: rows.map((t) => t.batch_name),
        axisLine: { lineStyle: { color: CHART.line } },
        axisLabel: { color: CHART.ink2, interval: 0 },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 3,
        interval: 1,
        axisLabel: {
          color: CHART.ink2,
          formatter: (v: number) => ({ 1: '高潜', 2: '中潜', 3: '低潜' })[v],
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: CHART.line, type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          data: rows.map((t) => Number(t.grid_code![2])),
          smooth: true,
          symbol: 'circle',
          symbolSize: 18,
          lineStyle: { color: CHART.primary, width: 3 },
          itemStyle: { color: CHART.primary, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: (p: { dataIndex: number }) => rows[p.dataIndex].grid_code,
            color: CHART.ink,
            fontWeight: 700,
            position: 'top',
          },
        },
      ],
    };
  }, [tracks]);

  if (!emps) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">位置轨迹</h1>
          <div className="page-subtitle">员工在历次已发布盘点中的九宫格位置变化，识别成长趋势与风险</div>
        </div>
        <Select
          value={empId || undefined}
          onChange={setEmpId}
          style={{ width: 240 }}
          showSearch
          optionFilterProp="label"
          options={emps.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="员工档案" size="small">
            {emp && (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space size={12}>
                  <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--clay)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emp.name[0]}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{emp.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {emp.position} · {depts.get(emp.dept_id)?.name ?? '—'}
                    </div>
                  </div>
                </Space>
                <Space wrap>
                  <Tag color="blue" style={{ borderRadius: 6 }}>{emp.grade || '未定级'} 级</Tag>
                  <Tag color="geekblue" style={{ borderRadius: 6 }}>绩效 {emp.perf_grade ?? '—'}</Tag>
                  {latest?.potential && (
                    <Tag
                      color={
                        latest.potential === 'high'
                          ? 'green'
                          : latest.potential === 'mid'
                            ? 'gold'
                            : 'red'
                      }
                      style={{ borderRadius: 6 }}
                    >
                      潜力 {POTENTIAL_LABEL[latest.potential]}
                    </Tag>
                  )}
                </Space>
              </Space>
            )}
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="轨迹时间线" size="small">
            {tracks === null ? (
              <Spin />
            ) : tracks.length ? (
              <Timeline
                items={tracks.map((t) => {
                  const cell = t.grid_code ? GRID_CELLS.find((c) => c.code === t.grid_code) : undefined;
                  return {
                    color: cell?.color ?? 'var(--line)',
                    children: (
                      <Space direction="vertical" size={2}>
                        <span style={{ fontWeight: 600 }}>{t.batch_name}</span>
                        {cell ? (
                          <Tag style={{ background: cell.color + '22', color: cell.color, borderColor: 'transparent', borderRadius: 6, fontFamily: 'var(--font-mono)' }}>
                            {cell.code} · {cell.label}
                          </Tag>
                        ) : (
                          <Tag style={{ borderRadius: 6 }}>当次未定位</Tag>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                          {t.published_at?.slice(0, 10)}
                        </span>
                      </Space>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description="暂无已发布盘点，轨迹将在批次发布后生成" />
            )}
          </Card>
        </Col>

        <Col span={14}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="九宫格位置变化趋势" size="small">
            {tracks === null ? (
              <div style={{ height: 360, display: 'grid', placeItems: 'center' }}><Spin /></div>
            ) : tracks.some((t) => t.grid_code) ? (
              <>
                <ReactECharts option={option} style={{ height: 360 }} />
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                  纵轴为潜力维度（高→低），折线位置代表九宫格行；标签显示当次盘点定位编码。
                  {latest?.potential === 'high' && ' 当前位于高潜区，建议保持培养节奏。'}
                  {latest?.potential === 'low' && ' 潜力持续偏低，建议关注留用与转岗。'}
                </div>
              </>
            ) : (
              <div style={{ height: 360, display: 'grid', placeItems: 'center' }}>
                <Empty description="暂无已定位的盘点记录" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
