import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Row, Space, Steps, Tag, Timeline } from 'antd';
import { useAuth } from '@/store/auth';
import { profilesApi, type ProfileOut, type ProfileVersionItem } from '@/api/profiles';
import { RadarChart } from '@/components/RadarChart';
import { message } from 'antd';

const DIMENSION_NAME: Record<string, string> = {
  basic: '基本条件',
  biz: '业绩',
  contribution: '团队贡献',
  duty: '职责履行',
  knowledge: '知识技能',
  ability: '能力素质',
  perf: '绩效',
};

const DIM_KEYS = ['basic', 'biz', 'contribution', 'duty', 'knowledge', 'ability', 'perf'];

const GRADE_COLOR: Record<string, string> = {
  优: 'var(--sage)',
  良: 'var(--teal)',
  达标: 'var(--ochre)',
  待改进: 'var(--danger)',
};

export function MyProfile() {
  const persona = useAuth((s) => s.persona);
  const employeeId = persona?.employeeId;
  const [versions, setVersions] = useState<ProfileVersionItem[] | null>(null);
  const [latest, setLatest] = useState<ProfileOut | null>(null);
  const [selected, setSelected] = useState(1);
  const [current, setCurrent] = useState<ProfileOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setError('当前账号无员工档案');
      return;
    }
    Promise.all([
      profilesApi.versions(employeeId).catch(() => {
        message.error('画像版本加载失败');
        return [] as ProfileVersionItem[];
      }),
      profilesApi.latest(employeeId).catch(() => {
        message.error('最新画像加载失败');
        return null as ProfileOut | null;
      }),
    ]).then(([vers, lat]) => {
      setVersions(vers);
      setLatest(lat);
      if (vers.length > 0) {
        setSelected(vers[vers.length - 1].version_seq);
      }
      setCurrent(lat);
      setError(null);
    });
  }, [employeeId]);

  // 切换版本时加载对应快照
  useEffect(() => {
    if (!employeeId || !versions || selected === latest?.version_seq) {
      setCurrent(latest);
      return;
    }
    const found = versions.find((v) => v.version_seq === selected);
    if (!found) {
      setCurrent(latest);
      return;
    }
    profilesApi
      .versionDetail(employeeId, selected)
      .then((p) => setCurrent(p))
      .catch(() => {
        message.error('历史版本加载失败');
        setCurrent(latest);
      });
  }, [selected, employeeId, versions, latest]);

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Alert type="warning" showIcon message={error} />
      </div>
    );
  }

  if (versions === null) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Tag>画像加载中…</Tag>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Empty description="画像数据生成中，请等待季度画像批次" />
        <Button
          style={{ marginTop: 16 }}
          onClick={() => {
            if (!employeeId) return;
            profilesApi
              .regenerateMe()
              .then((p) => {
                setLatest(p);
                setCurrent(p);
                setVersions((prev) => [
                  ...(prev ?? []),
                  {
                    version_seq: p.version_seq,
                    source: p.source,
                    overall: p.overall,
                    generated_at: p.generated_at,
                  },
                ]);
                setSelected(p.version_seq);
                message.success('画像已重新生成');
              })
              .catch(() => message.error('画像生成失败'));
          }}
        >
          重新生成我的画像
        </Button>
      </div>
    );
  }

  const prev = versions && selected > 1
    ? versions.find((v) => v.version_seq === selected - 1)
    : undefined;

  const currentDims = new Map(current.dimensions.map((d) => [d.dimension_key, d]));
  const prevOverall = prev?.overall ?? null;
  const overallDelta = prevOverall !== null && current.overall !== null
    ? (current.overall as number) - (prevOverall as number)
    : undefined;

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的画像</h1>
          <div className="page-subtitle">
            v{current.version_seq} · 生成于 {current.generated_at?.slice(0, 10)} · 来源：{current.source} · 画像按周期生成、版本可追溯
          </div>
        </div>
        <Button
          onClick={() => {
            if (!employeeId) return;
            profilesApi
              .regenerateMe()
              .then((p) => {
                setLatest(p);
                setCurrent(p);
                message.success('画像已重新生成');
              })
              .catch(() => message.error('画像生成失败'));
          }}
        >
          重新生成
        </Button>
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title={`综合分 ${current.overall ?? '—'}`}>
            {versions && versions.length > 1 && (
              <Steps
                size="small"
                current={versions.findIndex((v) => v.version_seq === selected)}
                onChange={(v) => setSelected(versions[v].version_seq)}
                items={versions.map((v) => ({ title: `v${v.version_seq}` }))}
                style={{ marginBottom: 8 }}
              />
            )}
            <RadarChart
              height={280}
              series={[
                {
                  name: '当前版本',
                  values: DIM_KEYS.map((k) => currentDims.get(k)?.score ?? 0),
                  color: '#d96a8e',
                },
              ]}
            />
            {prev && prevOverall !== null && current.overall !== null && overallDelta !== undefined && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginTop: -4 }}>
                上一版综合 {prevOverall} · 较上版{' '}
                <span style={{ color: overallDelta >= 0 ? 'var(--sage)' : 'var(--danger)' }}>
                  {overallDelta >= 0 ? '+' : ''}
                  {overallDelta}
                </span>
              </div>
            )}
          </Card>

          {versions && versions.length > 0 && (
            <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="画像版本历史" size="small">
              <Timeline
                items={[...versions]
                  .reverse()
                  .map((v, idx) => ({
                    color: idx === 0 ? 'var(--clay)' : 'var(--teal)',
                    children: (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>v{v.version_seq} · 综合 {v.overall ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {v.generated_at?.slice(0, 10)} · {v.source}
                        </div>
                      </>
                    ),
                  }))}
              />
            </Card>
          )}
        </Col>

        <Col span={14}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title="画像维度明细"
            extra={<span className="ai-badge">AI 生成 · 可溯源</span>}
          >
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              {DIM_KEYS.map((key) => {
                const cur = currentDims.get(key);
                if (!cur) {
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px dashed var(--line)' }}>
                      <span style={{ width: 64, fontSize: 13, fontWeight: 600 }}>{DIMENSION_NAME[key]}</span>
                      <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>未测评</span>
                    </div>
                  );
                }
                const score = cur.score ?? 0;
                const gradeLabel = cur.grade_label ?? '';
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px dashed var(--line)' }}>
                    <span style={{ width: 64, fontSize: 13, fontWeight: 600 }}>{DIMENSION_NAME[key]}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--surface-sunken)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, height: '100%', background: GRADE_COLOR[gradeLabel] ?? 'var(--teal)', borderRadius: 4 }} />
                    </div>
                    <span className="num" style={{ width: 30, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{score}</span>
                    {gradeLabel && (
                      <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: 'var(--surface-sunken)', color: GRADE_COLOR[gradeLabel] ?? 'var(--ink-2)', fontSize: 11 }}>{gradeLabel}</Tag>
                    )}
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
                      {cur.note ?? ''}
                    </span>
                  </div>
                );
              })}
            </Space>
          </Card>

          <Link to="/app/my-gap">
            <Button style={{ marginTop: 16 }}>查看与标准的差距 →</Button>
          </Link>
        </Col>
      </Row>
    </div>
  );
}
