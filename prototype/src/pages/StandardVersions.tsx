import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Select,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { standards } from '@/mock/standards';

interface VersionRow {
  version: string;
  date: string;
  author: string;
  status: '已发布' | '评审中' | '草稿' | '已归档';
  changes: string[];
}

const VERSIONS: Record<string, VersionRow[]> = {
  std_sw: [
    {
      version: 'v2.3',
      date: '2026-08-12',
      author: '周敏（HRD）',
      status: '已发布',
      changes: [
        '知识技能：新增「分布式系统基础」L2 要求，对应填空题型',
        '履职要求：缺陷修复项的交付标准加入根因分析输出',
        '能力素质：系统思维 L1 行为锚点改写（AI 草案 + 委员会修订）',
      ],
    },
    {
      version: 'v2.2',
      date: '2026-04-02',
      author: '王建国（研发部经理）',
      status: '已发布',
      changes: ['编码实现一次通过率标准从 75% 上调至 80%'],
    },
    {
      version: 'v2.0',
      date: '2025-11-20',
      author: '人力资源部',
      status: '已发布',
      changes: ['对标宽带薪酬改革，职级带宽与薪级映射全面重排', 'P3 基本条件司龄由 2 年调整为 1 年'],
    },
    {
      version: 'v1.0',
      date: '2024-06-30',
      author: '创始团队',
      status: '已归档',
      changes: ['首次建立 SW 序列六职级标准框架'],
    },
  ],
};

const FLOW_STEPS = ['起草 / 修订', 'HR 初审', '委员会评审', '发布生效'];

export function StandardVersions() {
  const [stdId, setStdId] = useState('std_sw');
  const [flowStep, setFlowStep] = useState(1);

  const summary = standards.find((s) => s.id === stdId) ?? standards[0];
  const versions = useMemo(
    () => VERSIONS[stdId] ?? [
      {
        version: summary.version,
        date: summary.updatedAt,
        author: '人力资源部',
        status: summary.status === '生效' ? '已发布' : summary.status === '评审中' ? '评审中' : '草稿',
        changes: ['标准条款首次建档（原型简化展示）'],
      },
    ],
    [stdId, summary],
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">版本与发布</h1>
          <div className="page-subtitle">
            标准的修订历史与发布流转：起草 → HR 初审 → 委员会评审 → 发布生效
          </div>
        </div>
        <Select
          value={stdId}
          onChange={(v) => {
            setStdId(v);
            setFlowStep(1);
          }}
          style={{ minWidth: 220 }}
          options={standards.map((s) => ({
            value: s.id,
            label: `${s.sequenceName}（${s.version}）`,
          }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="当前发布流转"
            extra={
              <Tag style={{ borderRadius: 6, background: 'var(--ochre-soft)', color: 'var(--ochre)', borderColor: 'transparent' }}>
                {FLOW_STEPS[flowStep]}
              </Tag>
            }
          >
            <Steps
              current={flowStep}
              items={FLOW_STEPS.map((t, i) => ({
                title: t,
                description:
                  i === 0
                    ? 'HR / 业务专家'
                    : i === 1
                      ? '标准运营岗'
                      : i === 2
                        ? '任职资格委员会'
                        : '全员可见',
              }))}
            />
            <div
              style={{
                marginTop: 24,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <Button
                disabled={flowStep === 0}
                onClick={() => setFlowStep((s) => Math.max(0, s - 1))}
              >
                上一步
              </Button>
              <Button
                type="primary"
                disabled={flowStep === FLOW_STEPS.length - 1}
                onClick={() => {
                  const next = Math.min(FLOW_STEPS.length - 1, flowStep + 1);
                  setFlowStep(next);
                  if (next === FLOW_STEPS.length - 1) {
                    message.success('标准已发布生效（原型演示）');
                  }
                }}
              >
                {flowStep === FLOW_STEPS.length - 1 ? '已生效' : '流转下一步'}
              </Button>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                原型可点击模拟流转 · 实际流转受角色权限控制
              </span>
            </div>

            <Alert
              style={{
                marginTop: 20,
                background: 'var(--surface-sunken)',
                borderColor: 'var(--line)',
              }}
              type="info"
              showIcon
              message={
                <span>
                  <span className="ai-badge" style={{ marginRight: 8 }}>AI 协作</span>
                  修订草案由 AI 基于上版标准 + 绩效申诉数据 + 行业对标生成差异建议，
                  人工确认后进入流转。
                </span>
              }
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title="修订时间线"
          >
            <Timeline
              items={versions.map((v) => ({
                color: v.status === '已发布' ? 'green' : v.status === '已归档' ? 'gray' : 'orange',
                children: (
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="num" style={{ fontWeight: 700 }}>{v.version}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{v.date}</span>
                      <Tag
                        style={{
                          borderRadius: 6,
                          fontSize: 11,
                          borderColor: 'var(--line)',
                          background: 'var(--surface-sunken)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {v.status}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 8px' }}>
                      修订人：{v.author}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {v.changes.map((c, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              }))}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <CheckCircleOutlined style={{ color: 'var(--sage)', marginRight: 6 }} />
              已发布版本对全员可见；归档版本仅供追溯，不可作为认证依据。
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
