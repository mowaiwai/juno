import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Col,
  Row,
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { employees as allEmployees } from '@/mock/people';
import { departments, deptName } from '@/mock/org';
import { useDataScope, useActiveRoleMeta } from '@/store/auth';
import { MaskedField } from '@/components/MaskedField';
import { Can } from '@/components/Can';
import { message } from 'antd';
import type { Employee } from '@/types';

const PERF_COLOR: Record<string, { bg: string; fg: string }> = {
  S: { bg: 'var(--sage-soft)', fg: 'var(--sage)' },
  A: { bg: 'var(--teal-soft)', fg: 'var(--teal)' },
  B: { bg: 'var(--surface-sunken)', fg: 'var(--ink-2)' },
  C: { bg: 'var(--ochre-soft)', fg: 'var(--ochre)' },
  D: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

const RISK_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  HIGH: { text: '高风险', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  MID: { text: '中风险', bg: 'var(--ochre-soft)', fg: 'var(--ochre)' },
  LOW: { text: '低风险', bg: 'var(--surface-sunken)', fg: 'var(--ink-3)' },
};

export function Roster() {
  const scope = useDataScope();
  const meta = useActiveRoleMeta();
  const [dept, setDept] = useState<string | undefined>();
  const [grade, setGrade] = useState<string | undefined>();
  const [perf, setPerf] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const scoped = useMemo(() => scope(allEmployees), [scope]);

  const list = useMemo(
    () =>
      scoped
        .filter((e) => !dept || e.deptId === dept)
        .filter((e) => !grade || e.grade === grade)
        .filter((e) => !perf || e.perf === perf)
        .filter(
          (e) =>
            !keyword ||
            e.name.includes(keyword) ||
            e.position.includes(keyword) ||
            e.id.includes(keyword),
        ),
    [scoped, dept, grade, perf, keyword],
  );

  const stats = useMemo(() => {
    const avgScore = scoped.length
      ? Math.round(scoped.reduce((s, e) => s + e.perfScore, 0) / scoped.length)
      : 0;
    return {
      total: scoped.length,
      core: scoped.filter((e) => e.isCorePosition).length,
      highRisk: scoped.filter((e) => e.risk === 'HIGH').length,
      avgScore,
    };
  }, [scoped]);

  const columns: ColumnsType<Employee> = [
    {
      title: '工号',
      dataIndex: 'id',
      width: 90,
      render: (v: string) => (
        <span className="num" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {v}
        </span>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 150,
      render: (v: string, row) => (
        <Space size={6}>
          <Link to={`/app/employee-detail?id=${row.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {v}
          </Link>
          {row.isCorePosition && (
            <Tag style={{ borderRadius: 5, fontSize: 11, background: 'var(--clay-soft)', color: 'var(--clay-hover)', borderColor: 'transparent' }}>
              核心
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '部门',
      dataIndex: 'deptId',
      width: 130,
      render: (v: string) => deptName(v),
    },
    { title: '岗位', dataIndex: 'position', ellipsis: true },
    {
      title: '职级',
      dataIndex: 'grade',
      width: 70,
      render: (v: string) => <span className="num" style={{ fontWeight: 650 }}>{v}</span>,
    },
    {
      title: '司龄',
      dataIndex: 'years',
      width: 70,
      render: (v: number) => <span className="num">{v} 年</span>,
    },
    {
      title: '2025 绩效',
      dataIndex: 'perf',
      width: 100,
      render: (v: string, row) => {
        const c = PERF_COLOR[v];
        return (
          <Space size={4}>
            <Tag style={{ borderRadius: 6, background: c.bg, color: c.fg, borderColor: 'transparent', width: 24, textAlign: 'center' }}>
              {v}
            </Tag>
            <span className="num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {row.perfScore}
            </span>
          </Space>
        );
      },
    },
    {
      title: '九宫格',
      dataIndex: 'grid',
      width: 80,
      render: (v: string) => (
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '月薪（敏感）',
      dataIndex: 'salary',
      width: 130,
      render: (v: number) => (
        <MaskedField value={v} format={(x) => `¥ ${Number(x).toLocaleString()}`} />
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {tags.slice(0, 2).map((t) => (
            <Tag key={t} style={{ borderRadius: 6, fontSize: 11, borderColor: 'var(--line)', background: 'var(--surface-sunken)', color: 'var(--ink-2)' }}>
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '风险',
      dataIndex: 'risk',
      width: 90,
      render: (v: Employee['risk']) => {
        const r = RISK_LABEL[v];
        return (
          <Tag style={{ borderRadius: 6, background: r.bg, color: r.fg, borderColor: 'transparent' }}>
            {r.text}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="page" style={{ maxWidth: 1560 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">员工花名册</h1>
          <div className="page-subtitle">
            当前视角（{meta?.label}）可见 {scoped.length} 人 · 薪酬字段按角色掩码
          </div>
        </div>
        <Can roles={['hr']}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.info('原型演示：导出需二次授权，集成版提供水印与审计')}
          >
            导出名册
          </Button>
        </Can>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="可见员工" value={stats.total} suffix="人" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="核心岗位" value={stats.core} suffix="人" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="高离职风险" value={stats.highRisk} suffix="人" />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="平均绩效分" value={stats.avgScore} suffix="分" />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--ink-4)' }} />}
            placeholder="姓名 / 岗位 / 工号"
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            placeholder="部门"
            allowClear
            style={{ minWidth: 160 }}
            value={dept}
            onChange={setDept}
            options={departments
              .filter((d) => d.id !== '0')
              .map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="职级"
            allowClear
            style={{ minWidth: 100 }}
            value={grade}
            onChange={setGrade}
            options={[...new Set(allEmployees.map((e) => e.grade))]
              .sort()
              .map((g) => ({ value: g, label: g }))}
          />
          <Select
            placeholder="绩效"
            allowClear
            style={{ minWidth: 100 }}
            value={perf}
            onChange={setPerf}
            options={['S', 'A', 'B', 'C', 'D'].map((p) => ({ value: p, label: `${p} 级` }))}
          />
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            筛选出 {list.length} 人
          </span>
        </Space>

        <Table
          rowKey="id"
          size="middle"
          dataSource={list}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 人` }}
          scroll={{ x: 1280 }}
        />
      </Card>
    </div>
  );
}
