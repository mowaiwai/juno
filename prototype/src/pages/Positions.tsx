import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Spin,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { orgApi, type PositionItem, type DepartmentItem, type FamilyLabelMap, type ChannelFamily } from '@/api/org';

export function Positions() {
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [familyLabel, setFamilyLabel] = useState<FamilyLabelMap>({});
  const [channels, setChannels] = useState<ChannelFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [familyFilter, setFamilyFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    Promise.all([
      orgApi.positions(),
      orgApi.departments(),
      orgApi.familyLabel(),
      orgApi.channels(),
    ])
      .then(([p, d, fl, c]) => {
        setPositions(p);
        setDepts(d);
        setFamilyLabel(fl);
        setChannels(c);
      })
      .catch(() => message.error('加载岗位数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const deptName = useMemo(() => {
    const map = new Map(depts.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? id;
  }, [depts]);

  const bandOf = useMemo(() => {
    return (family: string, grade: string) => {
      const ch = channels.find((c) => c.family === family);
      return ch?.grades.find((g) => g.grade === grade);
    };
  }, [channels]);

  const rows = useMemo(() => {
    return positions
      .filter((p) => !deptFilter || p.dept_id === deptFilter)
      .filter((p) => !familyFilter || p.family === familyFilter)
      .filter((p) => !keyword || p.name.includes(keyword));
  }, [positions, deptFilter, familyFilter, keyword]);

  const stats = useMemo(() => {
    const headcount = rows.reduce((s, r) => s + r.headcount, 0);
    const onDuty = rows.reduce((s, r) => s + r.on_duty, 0);
    return {
      total: rows.length,
      core: rows.filter((r) => r.is_core).length,
      headcount,
      onDuty,
      rate: headcount ? Math.round((onDuty / headcount) * 100) : 0,
    };
  }, [rows]);

  const columns: ColumnsType<PositionItem> = [
    {
      title: '岗位',
      dataIndex: 'name',
      render: (v: string, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{v}</span>
          {row.is_core && (
            <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay-hover)', borderColor: 'transparent' }}>
              核心岗
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '所属部门',
      dataIndex: 'dept_id',
      render: (v: string) => deptName(v),
    },
    {
      title: '职族 / 序列',
      dataIndex: 'family',
      width: 150,
      render: (v: string, row) => (
        <span>
          <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
            {v} · {familyLabel[v] ?? v}
          </Tag>
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{row.sequence}</span>
        </span>
      ),
    },
    {
      title: '职级',
      dataIndex: 'grade',
      width: 70,
      render: (v: string) => <span className="num" style={{ fontWeight: 650 }}>{v}</span>,
    },
    {
      title: '月薪带宽',
      key: 'band',
      width: 160,
      render: (_, row) => {
        const band = bandOf(row.family, row.grade);
        if (!band) return '—';
        return (
          <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            ¥ {band.salary_band[0].toLocaleString()} ~ {band.salary_band[1].toLocaleString()}
          </span>
        );
      },
    },
    {
      title: '编制 / 在编',
      key: 'hc',
      width: 220,
      render: (_, row) => {
        const pct = row.headcount ? Math.round((row.on_duty / row.headcount) * 100) : 0;
        return (
          <Space size={8} style={{ width: '100%' }}>
            <span className="num" style={{ width: 52, fontSize: 12 }}>
              {row.on_duty}/{row.headcount}
            </span>
            <Progress
              percent={pct}
              size="small"
              showInfo={false}
              style={{ width: 90, marginBottom: 0 }}
              strokeColor={pct < 70 ? 'var(--ochre)' : 'var(--sage)'}
            />
            {row.on_duty < row.headcount && (
              <Tag style={{ borderRadius: 6, fontSize: 11, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                缺编 {row.headcount - row.on_duty}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  if (loading) return <Spin style={{ display: 'block', padding: 80 }} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">岗位管理</h1>
          <div className="page-subtitle">
            岗位 = 职族 × 序列 × 职级 × 编制；核心岗位联动继任盘点
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('新增岗位表单将在后续版本提供')}
        >
          新增岗位
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="岗位数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="核心岗位" value={stats.core} suffix={`/ ${stats.total}`} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="总编制 / 在编" value={stats.onDuty} suffix={`/ ${stats.headcount}`} />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="整体在编率" value={stats.rate} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="搜索岗位名称"
            allowClear
            style={{ width: 220 }}
            onSearch={setKeyword}
            onChange={(e) => !e.target.value && setKeyword('')}
          />
          <Select
            placeholder="部门"
            allowClear
            style={{ minWidth: 180 }}
            value={deptFilter}
            onChange={setDeptFilter}
            options={depts
              .filter((d) => d.id !== '0')
              .map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="职族"
            allowClear
            style={{ minWidth: 140 }}
            value={familyFilter}
            onChange={setFamilyFilter}
            options={Object.entries(familyLabel).map(([f, label]) => ({
              value: f,
              label: `${f} · ${label}`,
            }))}
          />
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            共 {rows.length} 个岗位
          </span>
        </Space>

        <Table
          rowKey="id"
          size="middle"
          dataSource={rows}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
    </div>
  );
}
