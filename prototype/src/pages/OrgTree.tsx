import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Col, Row, Statistic, Tag, Tree, Typography, Alert, Spin, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { AppstoreOutlined } from '@ant-design/icons';
import { orgApi, subtreeDeptIds, type DepartmentItem } from '@/api/org';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const TYPE_LABEL: Record<string, string> = {
  func: '职能',
  biz: '业务',
  tech: '技术',
};

function buildTreeData(
  depts: DepartmentItem[],
  headcount: (deptId: string) => number,
): DataNode[] {
  const build = (parentId: string): DataNode[] =>
    depts
      .filter((d) => d.parent_id === parentId)
      .map((d) => ({
        key: d.id,
        title: (
          <span>
            {d.name}
            <span className="num" style={{ color: 'var(--ink-4)', marginLeft: 8, fontSize: 12 }}>
              {headcount(d.id)} 人
            </span>
          </span>
        ),
        children: build(d.id),
      }));
  return build('0');
}

export function OrgTree() {
  const [depts, setDepts] = useState<DepartmentItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('300');

  useEffect(() => {
    Promise.all([orgApi.departments(), employeesApi.list()])
      .then(([d, e]) => {
        setDepts(d);
        setEmployees(e);
      })
      .catch(() => message.error('加载组织架构数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const headcount = useMemo(() => {
    return (deptId: string) => {
      const ids = subtreeDeptIds(depts, deptId);
      return employees.filter((e) => ids.includes(e.dept_id)).length;
    };
  }, [depts, employees]);

  const treeData = useMemo(() => buildTreeData(depts, headcount), [depts, headcount]);

  const dept = depts.find((d) => d.id === selected);
  const childDepts = depts.filter((d) => d.parent_id === selected);
  const directMembers = employees.filter((e) => e.dept_id === selected);

  const gradeDist = useMemo(() => {
    const ids = subtreeDeptIds(depts, selected);
    const members = employees.filter((e) => ids.includes(e.dept_id));
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.grade, (map.get(m.grade) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [depts, selected, employees]);

  if (loading) return <Spin style={{ display: 'block', padding: 80 }} />;
  if (!dept) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">组织架构</h1>
          <div className="page-subtitle">
            星野制造 · {depts.length - 1} 个部门 · 在编 {employees.length} 人
          </div>
        </div>
        <Tag style={{ borderRadius: 6, borderColor: 'var(--line)' }}>
          <AppstoreOutlined style={{ marginRight: 6 }} />
          点击左侧部门查看详情
        </Tag>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="部门树"
            size="small"
          >
            <Tree
              defaultExpandedKeys={['100', '300']}
              selectedKeys={[selected]}
              onSelect={(keys) => keys[0] && setSelected(keys[0] as string)}
              treeData={treeData}
              blockNode
            />
          </Card>
        </Col>

        <Col span={16}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <Typography.Title level={4} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>
                {dept.name}
              </Typography.Title>
              <Tag style={{ borderRadius: 6 }}>{TYPE_LABEL[dept.type]}</Tag>
              <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
                编号 {dept.id}
              </Tag>
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              负责人：
              {dept.manager_name ? (
                <Link to={`/app/employee-detail?id=${dept.manager_id}`}>
                  {dept.manager_name}
                </Link>
              ) : (
                '—'
              )}
            </div>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="子树在编" value={headcount(selected)} suffix="人" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="下属部门" value={childDepts.length} suffix="个" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="本部门成员" value={directMembers.length} suffix="人" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="职级种类" value={gradeDist.length} suffix="档" />
              </Card>
            </Col>
          </Row>

          {childDepts.length > 0 && (
            <Card
              variant="borderless"
              style={{ background: 'var(--surface)', marginBottom: 16 }}
              size="small"
              title="下属部门"
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {childDepts.map((c) => (
                  <Tag.CheckableTag
                    key={c.id}
                    checked={false}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: '4px 12px',
                      fontSize: 13,
                      color: 'var(--ink)',
                    }}
                    onClick={() => setSelected(c.id)}
                  >
                    {c.name}
                    <span className="num" style={{ color: 'var(--ink-3)', marginLeft: 6, fontSize: 12 }}>
                      {headcount(c.id)} 人
                    </span>
                  </Tag.CheckableTag>
                ))}
              </div>
            </Card>
          )}

          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            size="small"
            title={`本部门成员（${directMembers.length}）`}
          >
            {directMembers.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="该部门暂无在编成员"
                style={{ background: 'var(--surface-sunken)', borderColor: 'var(--line)' }}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {directMembers.map((m) => (
                  <Link key={m.id} to={`/app/employee-detail?id=${m.id}`}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-sunken)',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'var(--clay-soft)',
                          color: 'var(--clay-hover)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 600,
                          flex: 'none',
                        }}
                      >
                        {m.name.slice(0, 1)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {m.name}
                          <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                            {m.position}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {m.grade} · {m.family} 族
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
