import { useEffect, useMemo, useState } from 'react';
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
  Spin,
  message,
} from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { orgApi, type DepartmentItem } from '@/api/org';
import { useActiveRoleMeta } from '@/store/auth';
import { Can } from '@/components/Can';
import { MaskedField } from '@/components/MaskedField';

const PERF_COLOR: Record<string, { bg: string; fg: string }> = {
  S: { bg: 'var(--sage-soft)', fg: 'var(--sage)' },
  A: { bg: 'var(--teal-soft)', fg: 'var(--teal)' },
  B: { bg: 'var(--surface-sunken)', fg: 'var(--ink-2)' },
  C: { bg: 'var(--ochre-soft)', fg: 'var(--ochre)' },
  D: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

export function Roster() {
  const meta = useActiveRoleMeta();
  const [dept, setDept] = useState<string | undefined>();
  const [grade, setGrade] = useState<string | undefined>();
  const [perf, setPerf] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([employeesApi.list(), orgApi.departments()])
      .then(([e, d]) => {
        setEmployees(e);
        setDepts(d);
      })
      .catch(() => message.error('加载花名册失败'))
      .finally(() => setLoading(false));
  }, []);

  const deptName = useMemo(() => {
    const map = new Map(depts.map((d) => [d.id, d.name]));
    return (id: string) => map.get(id) ?? id;
  }, [depts]);

  const list = useMemo(
    () =>
      employees
        .filter((e) => !dept || e.dept_id === dept)
        .filter((e) => !grade || e.grade === grade)
        .filter((e) => !perf || e.perf_grade === perf)
        .filter(
          (e) =>
            !keyword ||
            e.name.includes(keyword) ||
            e.position.includes(keyword) ||
            e.employee_no.includes(keyword),
        ),
    [employees, dept, grade, perf, keyword],
  );

  const stats = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter((e) => e.is_active).length,
    };
  }, [employees]);

  const columns: ColumnsType<EmployeeDirectoryItem> = [
    {
      title: '工号',
      dataIndex: 'employee_no',
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
        <Link to={`/app/employee-detail?id=${row.id}`} style={{ fontWeight: 600, color: 'var(--ink)' }}>
          {v}
        </Link>
      ),
    },
    {
      title: '部门',
      dataIndex: 'dept_id',
      width: 130,
      render: (v: string) => deptName(v),
    },
    { title: '岗位', dataIndex: 'position', ellipsis: true },
    {
      title: '职族',
      dataIndex: 'family',
      width: 70,
      render: (v: string) => <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>{v}</Tag>,
    },
    { title: '序列', dataIndex: 'sequence', width: 80 },
    {
      title: '职级',
      dataIndex: 'grade',
      width: 70,
      render: (v: string) => <span className="num" style={{ fontWeight: 650 }}>{v}</span>,
    },
    {
      title: '绩效',
      dataIndex: 'perf_grade',
      width: 70,
      render: (v: string | null) => {
        // 绩效列按激活角色掩码（SSC/招聘/薪酬等角色不可见）
        if (!meta?.seePerf) return <MaskedField kind="perf" />;
        if (!v) return <span style={{ color: 'var(--ink-4)' }}>—</span>;
        const c = PERF_COLOR[v];
        return (
          <Tag style={{ borderRadius: 6, background: c?.bg ?? 'var(--surface-sunken)', color: c?.fg ?? 'var(--ink-3)', borderColor: 'transparent', width: 24, textAlign: 'center' }}>
            {v}
          </Tag>
        );
      },
    },
    {
      title: '直接上级',
      dataIndex: 'manager_name',
      width: 120,
      render: (v: string | null, row) =>
        v ? (
          <Link to={`/app/employee-detail?id=${row.manager_id}`}>{v}</Link>
        ) : (
          <span style={{ color: 'var(--ink-4)' }}>—</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 70,
      render: (v: boolean) => (
        <Tag style={{ borderRadius: 6, background: v ? 'var(--sage-soft)' : 'var(--danger-soft)', color: v ? 'var(--sage)' : 'var(--danger)', borderColor: 'transparent' }}>
          {v ? '在职' : '离职'}
        </Tag>
      ),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', padding: 80 }} />;

  return (
    <div className="page" style={{ maxWidth: 1560 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">员工花名册</h1>
          <div className="page-subtitle">
            当前视角（{meta?.label}）可见 {employees.length} 人
          </div>
        </div>
        <Can roles={['hr_coe_otd', 'ssc']}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => message.info('导出功能将在后续版本提供')}
          >
            导出名册
          </Button>
        </Can>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="可见员工" value={stats.total} suffix="人" />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="在职" value={stats.active} suffix="人" />
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Statistic title="部门数" value={depts.length - 1} suffix="个" />
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
            options={depts
              .filter((d) => d.id !== '0')
              .map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            placeholder="职级"
            allowClear
            style={{ minWidth: 100 }}
            value={grade}
            onChange={setGrade}
            options={[...new Set(employees.map((e) => e.grade))]
              .sort()
              .map((g) => ({ value: g, label: g }))}
          />
          {meta?.seePerf && (
            <Select
              placeholder="绩效"
              allowClear
              style={{ minWidth: 100 }}
              value={perf}
              onChange={setPerf}
              options={['S', 'A', 'B', 'C', 'D'].map((p) => ({ value: p, label: `${p} 级` }))}
            />
          )}
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
          scroll={{ x: 1080 }}
        />
      </Card>
    </div>
  );
}
