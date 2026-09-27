import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Tag, Progress, Button, Alert } from 'antd';
import { ArrowRightOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth, useActiveRoleMeta, useDataScope } from '@/store/auth';
import { employees as allEmployees } from '@/mock/people';
import { deptName } from '@/mock/org';
import { MaskedField } from '@/components/MaskedField';
import { Can } from '@/components/Can';
import { pageRegistry } from '@/app/registry';

export function Home() {
  const persona = useAuth((s) => s.persona);
  const activeRole = useAuth((s) => s.activeRole);
  const meta = useActiveRoleMeta();
  const scope = useDataScope();

  const visible = useMemo(() => scope(allEmployees), [scope]);

  const progress = useMemo(() => {
    const done = pageRegistry.filter((p) => p.done && !p.dev).length;
    const total = pageRegistry.filter((p) => !p.dev).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }, []);

  if (!persona || !activeRole || !meta) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">
            你好，{persona.name}
          </h1>
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
            {visible.length}
            <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 6 }}>
              / {allEmployees.length} 名样本
            </span>
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

      <Card
        title="视角验证 · 当前角色可见的员工"
        variant="borderless"
        style={{ background: 'var(--surface)' }}
      >
        <Table
          rowKey="id"
          size="middle"
          dataSource={visible}
          pagination={false}
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
              render: (v, row) => (
                <Link to={`/app/page/employee-detail`} state={{ sample: row.id }}>
                  {v}
                </Link>
              ),
            },
            {
              title: '部门',
              dataIndex: 'deptId',
              render: (v: string) => deptName(v),
            },
            { title: '职级', dataIndex: 'grade' },
            {
              title: '2025 绩效',
              dataIndex: 'perf',
              render: (v: string) => (
                <Tag
                  style={{
                    borderRadius: 6,
                    background: 'var(--surface-sunken)',
                    borderColor: 'var(--line)',
                  }}
                >
                  {v}
                </Tag>
              ),
            },
            {
              title: '月薪（敏感）',
              dataIndex: 'salary',
              render: (v: number) => (
                <MaskedField
                  value={v}
                  format={(x) => `¥ ${Number(x).toLocaleString()}`}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
