import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Progress, Spin, Table, Tag, message } from 'antd';
import { ArrowRightOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth, useActiveRoleMeta } from '@/store/auth';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { orgApi, makeDeptName } from '@/api/org';
import { Can } from '@/components/Can';
import { pageRegistry } from '@/app/registry';
import { ApiError } from '@/api/client';

export function Home() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const meta = useActiveRoleMeta();

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[] | null>(null);
  const [deptNameFn, setDeptNameFn] = useState<((id: string) => string) | null>(null);

  const progress = useMemo(() => {
    const done = pageRegistry.filter((p) => p.done && !p.dev).length;
    const total = pageRegistry.filter((p) => !p.dev).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }, []);

  // 全员目录：GLOBAL（COE/SSC/exec 等）或 ASSIGNED_DEPTS（HRBP，真实模式由服务端按授权部门过滤）
  const canViewDirectory =
    !!meta && (meta.scope === 'GLOBAL' || meta.scope === 'ASSIGNED_DEPTS');

  useEffect(() => {
    if (!canViewDirectory) {
      setEmployees(null);
      return;
    }
    setEmployees(null);
    employeesApi
      .list()
      .then(setEmployees)
      .catch((e: unknown) => {
        setEmployees([]);
        message.error(e instanceof ApiError ? e.message : '员工目录加载失败');
      });
  }, [canViewDirectory]);

  useEffect(() => {
    orgApi
      .departments()
      .then((depts) => setDeptNameFn(() => makeDeptName(depts)))
      .catch(() => {
        setDeptNameFn(() => (id: string) => id);
      });
  }, []);

  if (!persona || !activeRole || !meta) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">你好，{persona.name}</h1>
          <div className="page-subtitle">
            当前以「{meta.label}」视角使用系统 · {persona.tenantName}
          </div>
        </div>
        <Link to="/app/style-guide">
          <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end">
            查看样式总览
          </Button>
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <SafetyOutlined style={{ color: 'var(--clay)', fontSize: 18 }} />
          <div style={{ fontWeight: 650, margin: '10px 0 4px' }}>
            数据范围 · {meta.scope}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {meta.description}
          </div>
        </Card>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>可见员工数</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 650 }}>
            {canViewDirectory ? (employees?.length ?? '—') : 1}
          </div>
        </Card>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>敏感字段</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <Tag
              style={{
                borderRadius: 6,
                background: meta.seeSalary
                  ? 'var(--sage-soft)'
                  : 'var(--surface-sunken)',
                color: meta.seeSalary ? 'var(--sage)' : 'var(--ink-3)',
                borderColor: 'transparent',
              }}
            >
              薪酬 {meta.seeSalary ? '可见' : '掩码'}
            </Tag>
            <Tag
              style={{
                borderRadius: 6,
                background: meta.seeFullProfile
                  ? 'var(--sage-soft)'
                  : 'var(--surface-sunken)',
                color: meta.seeFullProfile ? 'var(--sage)' : 'var(--ink-3)',
                borderColor: 'transparent',
              }}
            >
              完整画像 {meta.seeFullProfile ? '可见' : '掩码'}
            </Tag>
          </div>
        </Card>
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            原型建设进度
          </div>
          <div
            className="num"
            style={{ fontSize: 22, fontWeight: 650, margin: '4px 0' }}
          >
            {progress.done} / {progress.total} 页
          </div>
          <Progress percent={progress.pct} size="small" showInfo={false} />
        </Card>
      </div>

      <Can roles={['employee']}>
        <Alert
          type="info"
          showIcon
          style={{
            marginBottom: 16,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
          }}
          message="员工视角：你只能看到自己一条记录；切换到其他角色（若持有）可观察数据范围变化。"
        />
      </Can>

      <Can
        roles={['employee', 'manager', 'cert_panel']}
        fallback={
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <Alert
              type="info"
              showIcon
              message="当前视角可查看员工目录（GLOBAL / 授权部门范围）"
            />
          </Card>
        }
      >
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Alert
            type="info"
            showIcon
            style={{
              marginBottom: 0,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}
            message="员工/管理者/认证小组视角：数据范围以本人或关联对象为限；切换到 COE / HRBP / SSC 等视角可观察目录变化。"
          />
        </Card>
      </Can>

      {canViewDirectory && (
        <Card
          title="员工目录 · 当前激活角色范围"
          variant="borderless"
          style={{ background: 'var(--surface)' }}
        >
          {employees === null ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : employees.length === 0 ? (
            <Alert type="info" showIcon message="暂无员工数据" />
          ) : (
            <Table
              rowKey="id"
              size="middle"
              dataSource={employees}
              pagination={false}
              columns={[
                {
                  title: '姓名',
                  dataIndex: 'name',
                  render: (v: string, row: EmployeeDirectoryItem) => (
                    <Link to={`/app/employee-detail?id=${row.id}`}>{v}</Link>
                  ),
                },
                {
                  title: '部门',
                  dataIndex: 'dept_id',
                  render: (v: string) => (deptNameFn ? deptNameFn(v) : v),
                },
                { title: '岗位', dataIndex: 'position' },
                { title: '职级', dataIndex: 'grade' },
                {
                  title: '绩效',
                  dataIndex: 'perf_grade',
                  render: (v: string | null) =>
                    v && meta?.seePerf ? (
                      <Tag
                        style={{
                          borderRadius: 6,
                          background: 'var(--surface-sunken)',
                          borderColor: 'var(--line)',
                        }}
                      >
                        {v}
                      </Tag>
                    ) : (
                      '—'
                    ),
                },
                {
                  title: '直接上级',
                  dataIndex: 'manager_name',
                  render: (v: string | null) => v ?? '—',
                },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
