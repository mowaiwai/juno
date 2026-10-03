import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Progress, Row, Space, Spin, Tag } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { gapApi, GAP_DIM_LABEL, ACTION_LABEL, ACTION_COLOR, type GapOut } from '@/api/gap';

type Severity = 'high' | 'mid' | 'low' | 'none';

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  high: <CloseCircleFilled style={{ color: 'var(--danger)' }} />,
  mid: <ExclamationCircleFilled style={{ color: 'var(--ochre)' }} />,
  low: <ExclamationCircleFilled style={{ color: 'var(--ochre)' }} />,
  none: <CheckCircleFilled style={{ color: 'var(--sage)' }} />,
};

const SEVERITY_TAG: Record<Severity, { text: string; bg: string; color: string }> = {
  high: { text: '差距大', bg: 'var(--danger-soft)', color: 'var(--danger)' },
  mid: { text: '有差距', bg: 'var(--ochre-soft)', color: 'var(--ochre)' },
  low: { text: '轻微', bg: 'var(--ochre-soft)', color: 'var(--ochre)' },
  none: { text: '达标', bg: 'var(--sage-soft)', color: 'var(--sage)' },
};

const DEFAULT_TAG = { text: '未知', bg: 'var(--surface-sunken)', color: 'var(--ink-3)' };
const DEFAULT_ICON = <ExclamationCircleFilled style={{ color: 'var(--ink-3)' }} />;

function normalizeSeverity(s: string): Severity {
  const v = (s ?? '').toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'mid' || v === 'medium') return 'mid';
  if (v === 'low') return 'low';
  return 'none';
}

const ACTION_SUGGESTION: Record<string, string> = {
  perf_improvement: '制定绩效改进计划，与上级对齐目标，按月复盘关键节点。',
  process_supervision: '加强职责履行与流程监督，定期检查履职情况并辅导改进。',
  behavior_improve: '针对能力短板制定行为改善计划，通过训练、轮岗与导师辅导提升。',
  team_contribution: '增加团队协作与贡献，参与跨部门项目或承担带教任务。',
  learn_knowledge: '补充知识技能短板，制定学习计划并考取相关认证。',
};

export function MyGap() {
  const [gaps, setGaps] = useState<GapOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // gap.ts 中的标签映射使用 enum 类型作为 key，此处转为 string 索引以适配 GapOut 的 string 字段
  const DIM_LABEL = GAP_DIM_LABEL as Record<string, string>;
  const ACT_LABEL = ACTION_LABEL as Record<string, string>;
  const ACT_COLOR = ACTION_COLOR as Record<string, string>;

  useEffect(() => {
    gapApi
      .mine()
      .then((list) => setGaps(list))
      .catch(() => {
        setGaps([]);
        setError('差距数据加载失败');
      });
  }, []);

  if (gaps === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin />
      </div>
    );
  }

  const totalItems = gaps.length;
  const overall = totalItems > 0
    ? Math.round(((1 - totalItems / Math.max(totalItems + 4, 7))) * 100)
    : 100;

  // group by dimension
  const byDimension = new Map<string, GapOut[]>();
  for (const g of gaps) {
    const list = byDimension.get(g.dimension) ?? [];
    list.push(g);
    byDimension.set(g.dimension, list);
  }

  const dimensions = ['perf', 'duty', 'ability', 'contribution', 'knowledge'];

  return (
    <div className="page" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的差距</h1>
          <div className="page-subtitle">
            基于人才画像七维 + 绩效等级识别的差距记录 · 达标值来源于认证标准
          </div>
        </div>
      </div>

      {error && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />
      )}

      <Row gutter={16}>
        <Col span={16}>
          {gaps.length === 0 ? (
            <Card variant="borderless" style={{ background: 'var(--surface)' }}>
              <Empty description="暂无差距记录。画像分析与差距识别由 HR 发起，生成后此处会展示各维度的差距详情。" />
            </Card>
          ) : (
            dimensions.map((dim) => {
              const list = byDimension.get(dim);
              if (!list || list.length === 0) return null;
              return (
                <Card
                  key={dim}
                  variant="borderless"
                  style={{ background: 'var(--surface)', marginBottom: 16 }}
                  title={DIM_LABEL[dim] ?? dim}
                  size="small"
                >
                  {list.map((g) => {
                    const sev = normalizeSeverity(g.severity);
                    const tagMeta = SEVERITY_TAG[sev] ?? DEFAULT_TAG;
                    const icon = SEVERITY_ICON[sev] ?? DEFAULT_ICON;
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px dashed var(--line)' }}>
                        <div style={{ paddingTop: 2 }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {g.detail}
                            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400, marginLeft: 10 }}>
                              要求：{g.standard} · 当前：{g.current}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.8 }}>
                            改进动作：{ACT_LABEL[g.action] ?? g.action}
                            {ACTION_SUGGESTION[g.action] && ` · ${ACTION_SUGGESTION[g.action]}`}
                          </div>
                        </div>
                        <Tag style={{ borderRadius: 6, borderColor: 'transparent', fontSize: 11, background: tagMeta.bg, color: tagMeta.color }}>
                          {tagMeta.text}
                        </Tag>
                      </div>
                    );
                  })}
                </Card>
              );
            })
          )}
        </Col>

        <Col span={8}>
          {/* 总体达标度 */}
          <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16, textAlign: 'center' }} title="达标度概览">
            <Progress type="circle" percent={overall} size={130} strokeColor="var(--clay)" />
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
              差距记录 {totalItems} 项
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.9 }}>
              {totalItems === 0
                ? '当前无差距记录。差距分析由 HR 发起后，此处会展示各维度的达标情况与改进动作。'
                : '已识别的差距均已路由到对应改进动作，可进入 IDP 或认证举证推进。'}
            </div>
          </Card>

          {/* 差距路由 */}
          {gaps.length > 0 && (
            <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title="差距 → 动作路由" size="small">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {gaps.slice(0, 3).map((g) => (
                  <div key={g.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-sunken)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', color: ACT_COLOR[g.action] ?? 'var(--ink-2)', borderColor: 'transparent', fontSize: 11 }}>
                        {ACT_LABEL[g.action] ?? g.action}
                      </Tag>
                      {g.detail}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
                      要求 {g.standard} · 当前 {g.current}
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {/* 迈向下一职级 */}
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="迈向下一职级" size="small">
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 2 }}>
              晋升条件：通过目标职级标准认证 + 答辩；近两年绩效达标。
              <br />
              差距分析由 HR 发起后，此处会展示你与目标职级的差距及改进路径。
            </div>
            <Link to="/app/cert-apply">
              <Button type="primary" block style={{ marginTop: 10, background: 'var(--charcoal)' }}>进入认证举证</Button>
            </Link>
            <Link to="/app/idp" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--clay-hover)' }}>
              查看 IDP 个人发展计划
            </Link>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
