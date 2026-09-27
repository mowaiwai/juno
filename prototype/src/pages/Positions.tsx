import { useMemo, useState } from 'react';
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
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { departments, positions } from '@/mock/org';
import { employees as allEmployees } from '@/mock/people';
import { FAMILY_LABEL, bandOf } from '@/mock/channels';
import { deptName } from '@/mock/org';
import type { Position } from '@/types';

export function Positions() {
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [familyFilter, setFamilyFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    return positions
      .filter((p) => !deptFilter || p.deptId === deptFilter)
      .filter((p) => !familyFilter || p.family === familyFilter)
      .filter((p) => !keyword || p.name.includes(keyword))
      .map((p) => {
        const on = allEmployees.filter(
          (e) => e.deptId === p.deptId && e.position === p.name,
        ).length;
        return { ...p, onDuty: on };
      });
  }, [deptFilter, familyFilter, keyword]);

  const stats = useMemo(() => {
    const headcount = rows.reduce((s, r) => s + r.headcount, 0);
    const onDuty = rows.reduce((s, r) => s + r.onDuty, 0);
    return {
      total: rows.length,
      core: rows.filter((r) => r.isCore).length,
      headcount,
      onDuty,
      rate: headcount ? Math.round((onDuty / headcount) * 100) : 0,
    };
  }, [rows]);

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: '岗位',
      dataIndex: 'name',
      render: (v: string, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{v}</span>
          {row.isCore && (
            <Tag style={{ borderRadius: 6, background: 'var(--clay-soft)', color: 'var(--clay-hover)', borderColor: 'transparent' }}>
              核心岗
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '所属部门',
      dataIndex: 'deptId',
      render: (v: string) => deptName(v),
    },
    {
      title: '职族 / 序列',
      dataIndex: 'family',
      width: 150,
      render: (v: Position['family'], row) => (
        <span>
          <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
            {v} · {FAMILY_LABEL[v]}
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
            ¥ {band.salaryBand[0].toLocaleString()} ~ {band.salaryBand[1].toLocaleString()}
          </span>
        );
      },
    },
    {
      title: '编制 / 在编',
      key: 'hc',
      width: 220,
      render: (_, row) => {
        const pct = row.headcount ? Math.round((row.onDuty / row.headcount) * 100) : 0;
        return (
          <Space size={8} style={{ width: '100%' }}>
            <span className="num" style={{ width: 52, fontSize: 12 }}>
              {row.onDuty}/{row.headcount}
            </span>
            <Progress
              percent={pct}
              size="small"
              showInfo={false}
              style={{ width: 90, marginBottom: 0 }}
              strokeColor={pct < 70 ? 'var(--ochre)' : 'var(--sage)'}
            />
            {row.onDuty < row.headcount && (
              <Tag style={{ borderRadius: 6, fontSize: 11, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                缺编 {row.headcount - row.onDuty}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">岗位管理</h1>
          <div className="page-subtitle">
            岗位 = 职族 × 序列 × 职级 × 编制；核心岗位联动继任盘点（批次 6）
          </div>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info('原型演示：新增岗位表单将在集成版提供')}
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
            options={departments
              .filter((d) => d.id !== '0')
              .map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="职族"
            allowClear
            style={{ minWidth: 140 }}
            value={familyFilter}
            onChange={setFamilyFilter}
            options={(Object.keys(FAMILY_LABEL) as Array<keyof typeof FAMILY_LABEL>).map((f) => ({
              value: f,
              label: `${f} · ${FAMILY_LABEL[f]}`,
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
