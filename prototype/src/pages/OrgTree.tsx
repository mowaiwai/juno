import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Col, Row, Statistic, Tag, Tree, Typography, Alert } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { AppstoreOutlined } from '@ant-design/icons';
import { departments, subtreeDeptIds } from '@/mock/org';
import { employeeById } from '@/mock/people';
import { employees as allEmployees } from '@/mock/people';
import { useDataScope } from '@/store/auth';
import { MaskedField } from '@/components/MaskedField';

const TYPE_LABEL: Record<string, string> = {
  func: '职能',
  biz: '业务',
  tech: '技术',
};

/** 组织树节点（ AntD Tree 需要 title 可渲染） */
function buildTreeData(
  headcount: (deptId: string) => number,
): DataNode[] {
  const build = (parentId: string): DataNode[] =>
    departments
      .filter((d) => d.parentId === parentId)
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
  const scope = useDataScope();
  const visible = useMemo(() => scope(allEmployees), [scope]);
  const [selected, setSelected] = useState<string>('300');

  const headcount = useMemo(() => {
    return (deptId: string) => {
      const ids = subtreeDeptIds(deptId);
      return visible.filter((e) => ids.includes(e.deptId)).length;
    };
  }, [visible]);

  const treeData = useMemo(() => buildTreeData(headcount), [headcount]);

  const dept = departments.find((d) => d.id === selected);
  const childDepts = departments.filter((d) => d.parentId === selected);
  const directMembers = visible.filter((e) => e.deptId === selected);
  const corePositions = useMemo(() => {
    // 该部门子树内的核心岗位在编人数
    const ids = subtreeDeptIds(selected);
    return new Set(visible.filter((e) => ids.includes(e.deptId) && e.isCorePosition).map((e) => e.id)).size;
  }, [selected, visible]);

  const gradeDist = useMemo(() => {
    const ids = subtreeDeptIds(selected);
    const members = visible.filter((e) => ids.includes(e.deptId));
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.grade, (map.get(m.grade) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [selected, visible]);

  if (!dept) return null;
  const manager = dept.managerId ? employeeById(dept.managerId) : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">组织架构</h1>
          <div className="page-subtitle">
            华砺精工 · {departments.length - 1} 个部门 ·
            当前视角可见 {visible.length} 人（数据范围外的部门人数以掩码显示）
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
              {manager ? (
                <>
                  <Link to={`/app/employee-detail?id=${manager.id}`}>{manager.name}</Link>
                  <span style={{ marginLeft: 8 }}>{manager.position} · {manager.grade}</span>
                </>
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
                <Statistic title="核心岗位在编" value={corePositions} suffix="人" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="下属部门" value={childDepts.length} suffix="个" />
              </Card>
            </Col>
            <Col span={6}>
              <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                <Statistic title="职级种类" value={gradeDist.length} suffix="档" />
              </Card>
            </Col>
          </Row>

          {/* 剧本故事：软件研发部哑铃型结构 */}
          {selected === '305' && (
            <Alert
              type="warning"
              showIcon
              style={{
                marginBottom: 16,
                background: 'var(--ochre-soft)',
                borderColor: 'var(--ochre-soft)',
              }}
              message={
                <span>
                  <span className="ai-badge" style={{ marginRight: 8 }}>AI 观察</span>
                  软件研发部呈「哑铃型」结构：P2 新人 3 人、P4 高级 2 人，中坚 P3 仅 2 人，
                  建议在下一轮认证中优先补齐 P3-P4 层级断层。
                </span>
              }
            />
          )}

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
                message="当前视角下该部门无可见成员（数据范围限制或部门为管理节点）"
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
                          {m.grade} · 司龄 {m.years} 年
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12 }}>
                        <div style={{ color: 'var(--ink-3)' }}>月薪</div>
                        <MaskedField value={m.salary} format={(v) => `¥ ${Number(v).toLocaleString()}`} />
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
