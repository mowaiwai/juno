import {
  Alert,
  Button,
  Card,
  Descriptions,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftOutlined, FileDoneOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { standards, swP3Standard } from '@/mock/standards';
import { Can } from '@/components/Can';
import { useAuth } from '@/store/auth';
import { ROLE_META } from '@/auth/rbac';

const KNOWLEDGE_TYPE: Record<number, string> = {
  1: '通用知识',
  2: '公司知识',
  3: '专业知识',
  4: '工具知识',
};

const MASTERY_LABEL: Record<number, string> = {
  1: '了解',
  2: '理解',
  3: '掌握',
  4: '精通',
};

function LevelDots({ level, max = 4 }: { level: number; max?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < level ? 'var(--clay)' : 'var(--line)',
          }}
        />
      ))}
      <span className="num" style={{ marginLeft: 6, fontSize: 12, color: 'var(--ink-3)' }}>
        L{level}
      </span>
    </span>
  );
}

export function StandardDetail() {
  const [params] = useSearchParams();
  const stdId = params.get('std') ?? 'std_sw';
  const persona = useAuth((s) => s.persona);
  const role = useAuth((s) => s.activeRole);

  const summary = standards.find((s) => s.id === stdId) ?? standards[0];
  const std = swP3Standard;

  const dutyColumns: ColumnsType<(typeof std.duties)[number]> = [
    {
      title: '履职项',
      dataIndex: 'name',
      width: 160,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    { title: '工作任务', dataIndex: 'task' },
    {
      title: '交付标准（举证锚点）',
      dataIndex: 'standard',
      render: (v: string) => (
        <span style={{ color: 'var(--ink-2)' }}>
          <FileDoneOutlined style={{ color: 'var(--sage)', marginRight: 6 }} />
          {v}
        </span>
      ),
    },
    {
      title: '职责层级',
      dataIndex: 'level',
      width: 130,
      render: (v: number) => <LevelDots level={v} max={5} />,
    },
  ];

  const knowledgeColumns: ColumnsType<(typeof std.knowledges)[number]> = [
    {
      title: '知识点',
      dataIndex: 'name',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '知识类型',
      dataIndex: 'type',
      width: 120,
      render: (v: number) => (
        <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
          {KNOWLEDGE_TYPE[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '掌握程度',
      dataIndex: 'mastery',
      width: 150,
      render: (v: number) => (
        <span>
          <LevelDots level={v} />
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            {MASTERY_LABEL[v]}
          </span>
        </span>
      ),
    },
    {
      title: '认证题型',
      dataIndex: 'examMode',
      width: 100,
      render: (v: string) => (
        <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
          {v}
        </Tag>
      ),
    },
  ];

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <Link to="/app/standards-list">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 8, paddingLeft: 0 }}>
          返回标准库
        </Button>
      </Link>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Space size={10} align="center">
              <Typography.Title level={3} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>
                {summary.sequenceName} · {std.grade} 标准
              </Typography.Title>
              <Tag style={{ borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'transparent' }}>
                {summary.status}
              </Tag>
            </Space>
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>
              当前版本 {std.version} · 更新于 {summary.updatedAt} ·
              适用对象：{std.sequence} 序列 {std.grade} 及以上任职者
            </div>
          </div>
          <Can roles={['committee', 'hr']}>
            <Space>
              {role && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {ROLE_META[role].label}可发起流转
                </span>
              )}
              <Button onClick={() => message.info('原型演示：修订工作流见「版本与发布」页')}>
                修订
              </Button>
              <Button
                type="primary"
                onClick={() =>
                  message.success('已提交委员会评审（原型演示流转）')
                }
              >
                提交评审
              </Button>
            </Space>
          </Can>
        </div>
      </Card>

      <Alert
        type="info"
        showIcon
        style={{
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
        }}
        message="原型内置 SW-P3 完整条款数据；其余职级沿用同一结构，集成版将提供全部职级 × 序列的完整矩阵。"
      />

      <Card variant="borderless" style={{ background: 'var(--surface)' }}>
        <Tabs
          defaultActiveKey="basic"
          items={[
            {
              key: 'basic',
              label: '基本条件',
              children: (
                <div>
                  <Descriptions
                    column={2}
                    bordered
                    size="middle"
                    labelStyle={{ width: 160, background: 'var(--surface-sunken)' }}
                    items={[
                      { key: 'edu', label: '学历要求', children: std.basic.education },
                      { key: 'work', label: '工作经验', children: std.basic.workYears },
                      { key: 'company', label: '司龄要求', children: std.basic.companyYears },
                      { key: 'cert', label: '持证要求', children: std.basic.certificates },
                      {
                        key: 'perf',
                        label: '绩效门槛',
                        children: (
                          <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                            {std.perfCondition}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 14, fontSize: 12, marginBottom: 0 }}
                  >
                    基本条件为「申报门槛」：不满足者无法发起认证申请，但不计入评分。
                  </Typography.Paragraph>
                </div>
              ),
            },
            {
              key: 'duties',
              label: '履职要求',
              children: (
                <Table
                  rowKey="name"
                  size="middle"
                  columns={dutyColumns}
                  dataSource={std.duties}
                  pagination={false}
                />
              ),
            },
            {
              key: 'knowledges',
              label: '知识技能',
              children: (
                <div>
                  <Table
                    rowKey="name"
                    size="middle"
                    columns={knowledgeColumns}
                    dataSource={std.knowledges}
                    pagination={false}
                  />
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 14, fontSize: 12, marginBottom: 0 }}
                  >
                    认证题型映射：掌握 L1-L2 → 选择/填空（系统判分），L3 以上 → 问答（AI 辅助初评 + 评委复核）。
                  </Typography.Paragraph>
                </div>
              ),
            },
            {
              key: 'abilities',
              label: '能力素质',
              children: (
                <div style={{ display: 'grid', gap: 12 }}>
                  {std.abilities.map((a) => (
                    <div
                      key={a.name}
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                        padding: '12px 16px',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        background: 'var(--surface-sunken)',
                      }}
                    >
                      <div style={{ width: 110 }}>
                        <div style={{ fontWeight: 650 }}>{a.name}</div>
                      </div>
                      <div style={{ width: 150 }}>
                        <LevelDots level={a.level} max={5} />
                      </div>
                      <div style={{ flex: 1, color: 'var(--ink-2)', fontSize: 13 }}>
                        行为锚点：{a.behavior}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'contribution',
              label: '团队贡献',
              children: (
                <div>
                  <div
                    style={{
                      padding: 20,
                      border: '1px dashed var(--line-strong)',
                      borderRadius: 12,
                      background: 'var(--surface-sunken)',
                      fontSize: 14,
                      color: 'var(--ink)',
                      lineHeight: 1.8,
                    }}
                  >
                    {std.contribution}
                  </div>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 14, fontSize: 12, marginBottom: 0 }}
                  >
                    团队贡献以举证材料 + 直属上级确认方式认证，可被追溯到知识库 / 带教记录（批次 8 联动）。
                  </Typography.Paragraph>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {persona && role === 'employee' && (
        <Alert
          style={{
            marginTop: 16,
            background: 'var(--clay-soft)',
            borderColor: 'var(--clay-soft)',
          }}
          type="info"
          showIcon
          message="员工视角：你可以在「我的差距」（批次 3）中对照本标准逐条查看达标情况。"
        />
      )}
    </div>
  );
}
