import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { standards } from '@/mock/standards';
import { USE_MOCK } from '@/api/config';
import { ApiError } from '@/api/client';
import { standardsApi, type StandardSetDTO } from '@/api/standards';
import { useAuth } from '@/store/auth';

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
      author: '温晚晴（HRD）',
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
      author: '陆行舟（研发部经理）',
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

function MockStandardVersions() {
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

// ---------- 真实后端分支 ----------

const REAL_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const REAL_STATUS_COLOR: Record<string, string> = {
  draft: 'orange',
  published: 'green',
  archived: 'gray',
};

function RealStandardVersions() {
  const role = useAuth((s) => s.activeRole);
  const [sets, setSets] = useState<StandardSetDTO[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const reload = () => {
    setErrorMsg(null);
    return standardsApi
      .list()
      .then((rows) => setSets(rows))
      .catch((e: unknown) => {
        setSets([]);
        setErrorMsg(e instanceof ApiError ? e.message : '标准集加载失败');
        message.error('版本数据加载失败');
      });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 按 序列+职级 分组，组内按版本倒序
  const groups = useMemo(() => {
    const map = new Map<string, StandardSetDTO[]>();
    for (const s of sets ?? []) {
      const key = `${s.sequence} · ${s.target_grade}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.version - a.version);
    return map;
  }, [sets]);

  const groupKeys = useMemo(() => [...groups.keys()], [groups]);
  const activeKey = groupKey ?? groupKeys[0] ?? null;
  const activeVersions = activeKey ? groups.get(activeKey) ?? [] : [];
  const currentPublished = activeVersions.find((v) => v.status === 'published');

  const onPublish = async (id: string) => {
    setPublishingId(id);
    try {
      const d = await standardsApi.publish(id);
      message.success(`已发布 v${d.version}，同键旧发布版自动归档`);
      await reload();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '发布失败');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">版本与发布</h1>
          <div className="page-subtitle">
            草稿 → 发布 → 归档 · 同一序列职级至多一个已发布版本
          </div>
        </div>
        {groupKeys.length > 0 && (
          <Select
            value={activeKey}
            onChange={(v) => setGroupKey(v)}
            style={{ minWidth: 220 }}
            options={groupKeys.map((k) => ({ value: k, label: k }))}
          />
        )}
      </div>

      {errorMsg && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="无法加载标准集"
          description={errorMsg}
        />
      )}

      {sets === null ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : activeVersions.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="暂无标准集版本记录" />
        </Card>
      ) : (
        <Row gutter={16}>
          <Col span={14}>
            <Card
              variant="borderless"
              style={{ background: 'var(--surface)' }}
              title="当前生效版本"
            >
              {currentPublished ? (
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                      v{currentPublished.version}
                    </span>
                    <Tag
                      style={{
                        borderRadius: 6,
                        background: 'var(--sage-soft)',
                        color: 'var(--sage)',
                        borderColor: 'transparent',
                      }}
                    >
                      已发布
                    </Tag>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 8 }}>
                    发布于 {currentPublished.published_at?.slice(0, 10)} ·{' '}
                    {currentPublished.items.length} 个标准项 · 权重合计{' '}
                    {currentPublished.items.reduce((s, i) => s + Number(i.weight), 0)}%
                  </div>
                  <ul style={{ margin: '16px 0 0', paddingLeft: 18 }}>
                    {currentPublished.items.map((i) => (
                      <li
                        key={i.id}
                        style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}
                      >
                        <span className="num" style={{ fontWeight: 600 }}>{i.code}</span>
                        {' '}{i.name}（{i.weight}%）— {i.requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty description="该序列职级暂无已发布版本" />
              )}
            </Card>
          </Col>

          <Col span={10}>
            <Card
              variant="borderless"
              style={{ background: 'var(--surface)' }}
              title="版本时间线"
            >
              <Timeline
                items={activeVersions.map((v) => ({
                  color: REAL_STATUS_COLOR[v.status] ?? 'gray',
                  children: (
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="num" style={{ fontWeight: 700 }}>
                          v{v.version}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {v.published_at ? v.published_at.slice(0, 10) : '未发布'}
                        </span>
                        <Tag
                          style={{
                            borderRadius: 6,
                            fontSize: 11,
                            borderColor: 'var(--line)',
                            background: 'var(--surface-sunken)',
                            color: 'var(--ink-2)',
                          }}
                        >
                          {REAL_STATUS_LABEL[v.status] ?? v.status}
                        </Tag>
                        {role === 'hr_coe_otd' && v.status === 'draft' && (
                          <Button
                            size="small"
                            type="link"
                            loading={publishingId === v.id}
                            onClick={() => onPublish(v.id)}
                          >
                            发布
                          </Button>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                        {v.items.length} 个标准项
                      </div>
                    </div>
                  ),
                }))}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                <CheckCircleOutlined style={{ color: 'var(--sage)', marginRight: 6 }} />
                已发布版本全员可见；归档版本仅供追溯，不可作为认证依据。
              </Typography.Text>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export function StandardVersions() {
  return USE_MOCK ? <MockStandardVersions /> : <RealStandardVersions />;
}
