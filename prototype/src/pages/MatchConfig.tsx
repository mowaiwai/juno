import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, InputNumber, Row, Space, Spin, message } from 'antd';
import { matchApi, MATCH_DIMS, DIM_LABEL, type MatchConfigOut } from '@/api/match';

export function MatchConfig() {
  const [cfg, setCfg] = useState<MatchConfigOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    matchApi.getConfig()
      .then(setCfg)
      .catch((e) => {
        if (e?.status === 403) setForbidden(true);
        else message.error(e?.message ?? '加载匹配配置失败');
      })
      .finally(() => setLoading(false));
  }, []);

  const setWeight = (key: string, v: number | null) =>
    setCfg((c) => c && { ...c, weights: { ...c.weights, [key]: v ?? 0 } });
  const setRequired = (key: string, v: number | null) =>
    setCfg((c) => c && { ...c, required: { ...c.required, [key]: v ?? 0 } });

  const weightSum = cfg ? Object.values(cfg.weights).reduce((s, w) => s + w, 0) : 0;
  const valid =
    !!cfg &&
    MATCH_DIMS.every((d) => (cfg.weights[d] ?? 0) >= 0) &&
    weightSum > 0 &&
    MATCH_DIMS.every((d) => (cfg.required[d] ?? 0) >= 1 && (cfg.required[d] ?? 0) <= 100) &&
    cfg.warn_threshold >= 0 &&
    cfg.warn_threshold < cfg.good_threshold &&
    cfg.good_threshold <= 100;

  const save = () => {
    if (!cfg || !valid) return;
    setSaving(true);
    matchApi.updateConfig({
      weights: cfg.weights,
      required: cfg.required,
      good_threshold: cfg.good_threshold,
      warn_threshold: cfg.warn_threshold,
    })
      .then((next) => {
        setCfg(next);
        message.success('匹配配置已保存');
      })
      .catch((e) => {
        if (e?.status === 403) message.error('当前角色无权修改匹配配置');
        else if (e?.status === 422) message.error('配置校验未通过：权重非负且总和>0，要求分 1-100，warn<good');
        else message.error(e?.message ?? '保存失败');
      })
      .finally(() => setSaving(false));
  };

  if (forbidden) {
    return (
      <div className="page" style={{ maxWidth: 960 }}>
        <Alert type="warning" showIcon message="当前角色无权查看匹配配置" description="匹配配置需 gap.manage 权限（HR/管理者角色）。" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">匹配配置</h1>
          <div className="page-subtitle">五要素权重 × 岗位要求基准 × 分级阈值 · 全平台匹配口径唯一来源</div>
        </div>
        <Button type="primary" style={{ background: 'var(--charcoal)' }} disabled={!valid} loading={saving} onClick={save}>
          保存配置
        </Button>
      </div>

      <Spin spinning={loading}>
        {cfg && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {cfg.is_default && (
              <Alert
                type="info"
                showIcon
                message="当前使用平台默认配置"
                description="保存后将生成本租户专属配置，即时生效于热力图、推荐与组队算分。"
              />
            )}

            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="五维权重" size="small">
              <Row gutter={16}>
                {MATCH_DIMS.map((d) => (
                  <Col span={4} key={d}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{DIM_LABEL[d]}</div>
                    <InputNumber
                      min={0}
                      step={0.05}
                      value={cfg.weights[d] ?? 0}
                      onChange={(v) => setWeight(d, v)}
                      style={{ width: '100%' }}
                    />
                  </Col>
                ))}
                <Col span={4}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>权重合计</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, color: weightSum > 0 ? 'var(--sage)' : 'var(--danger)', lineHeight: '32px' }}>
                    {weightSum.toFixed(2)}
                  </div>
                </Col>
              </Row>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                权重无需归一化，引擎按可算维自动重新归一；总和必须大于 0。
              </div>
            </Card>

            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="五维要求分（默认基准）" size="small">
              <Row gutter={16}>
                {MATCH_DIMS.map((d) => (
                  <Col span={4} key={d}>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>{DIM_LABEL[d]}</div>
                    <InputNumber
                      min={1}
                      max={100}
                      value={cfg.required[d] ?? 0}
                      onChange={(v) => setRequired(d, v)}
                      style={{ width: '100%' }}
                    />
                  </Col>
                ))}
              </Row>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                岗位要求优先取已发布标准；无标准维度回落到此默认基准。达成率 = min(实际/要求, 1)。
              </div>
            </Card>

            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="分级阈值" size="small">
              <Row gutter={16}>
                <Col span={6}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>错位预警线（warn）</div>
                  <InputNumber
                    min={0}
                    max={100}
                    value={cfg.warn_threshold}
                    onChange={(v) => setCfg({ ...cfg, warn_threshold: v ?? 0 })}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={6}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>匹配良好线（good）</div>
                  <InputNumber
                    min={0}
                    max={100}
                    value={cfg.good_threshold}
                    onChange={(v) => setCfg({ ...cfg, good_threshold: v ?? 0 })}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                得分 ≥ good 为「匹配良好」；warn ≤ 得分 &lt; good 为「观察/可培养」；&lt; warn 为「错位预警」。须满足 0 ≤ warn &lt; good ≤ 100。
              </div>
            </Card>
          </Space>
        )}
      </Spin>
    </div>
  );
}
