import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Space, Steps, Tag, Timeline } from 'antd';
import { useAuth } from '@/store/auth';
import { employeeById } from '@/mock/people';
import { DIMENSION_NAME, PROFILE_DIMENSIONS, latestProfile, profileVersions } from '@/mock/profiles';
import { RadarChart } from '@/components/RadarChart';

const GRADE_COLOR: Record<string, string> = {
  优: 'var(--sage)',
  良: 'var(--teal)',
  达标: 'var(--ochre)',
  待改进: 'var(--danger)',
};

export function MyProfile() {
  const persona = useAuth((s) => s.persona);
  const emp = employeeById(persona?.employeeId);
  const versions = emp ? profileVersions(emp.id) : [];
  const latest = emp ? latestProfile(emp.id) : undefined;
  const [selected, setSelected] = useState(versions.length);
  const current = versions[selected - 1] ?? latest;

  if (!current) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <Empty description="画像数据生成中，请等待季度画像批次" />
      </div>
    );
  }

  const prev = versions[selected - 2];

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">我的画像</h1>
          <div className="page-subtitle">
            {current.version} · 生成于 {current.generatedAt} · 来源：{current.source} · 画像按周期生成、版本可追溯
          </div>
        </div>
      </div>

      <Row gutter={16}>
        <Col span={10}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }} title={`综合分 ${current.overall}`}>
            {versions.length > 1 && (
              <Steps
                size="small"
                current={selected - 1}
                onChange={(v) => setSelected(v + 1)}
                items={versions.map((v) => ({ title: v.version.replace('v', '') }))}
                style={{ marginBottom: 8 }}
              />
            )}
            <RadarChart
              height={280}
              series={[
                { name: '当前版本', values: PROFILE_DIMENSIONS.map((d) => current.dims[d.key].score), color: '#d96a8e' },
                ...(prev ? [{ name: '上一版本', values: PROFILE_DIMENSIONS.map((d) => prev.dims[d.key].score), color: '#7fb5d6' }] : []),
              ]}
            />
            {prev && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginTop: -4 }}>
                虚线为上一版本（{prev.version}，综合 {prev.overall}）· 较上版{' '}
                <span style={{ color: current.overall >= prev.overall ? 'var(--sage)' : 'var(--danger)' }}>
                  {current.overall >= prev.overall ? '+' : ''}
                  {current.overall - prev.overall}
                </span>
              </div>
            )}
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="画像版本历史" size="small">
            <Timeline
              items={versions
                .slice()
                .reverse()
                .map((v, idx) => ({
                  color: idx === 0 ? 'var(--clay)' : 'var(--teal)',
                  children: (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{v.version} · 综合 {v.overall}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {v.generatedAt} · {v.source}
                      </div>
                    </>
                  ),
                }))}
            />
          </Card>
        </Col>

        <Col span={14}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)', marginBottom: 16 }}
            title="AI 画像解读"
            extra={<span className="ai-badge">AI 生成 · 可溯源</span>}
          >
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 2 }}>{current.summary}</div>
          </Card>

          <Card variant="borderless" style={{ background: 'var(--surface)' }} title="七维明细">
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              {PROFILE_DIMENSIONS.map((dim) => {
                const cur = current.dims[dim.key];
                const p = prev?.dims[dim.key];
                const delta = p ? cur.score - p.score : undefined;
                return (
                  <div
                    key={dim.key}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px dashed var(--line)' }}
                  >
                    <span style={{ width: 64, fontSize: 13, fontWeight: 600 }}>{DIMENSION_NAME[dim.key]}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--surface-sunken)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${cur.score}%`, height: '100%', background: GRADE_COLOR[cur.grade], borderRadius: 4 }} />
                    </div>
                    <span className="num" style={{ width: 30, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>{cur.score}</span>
                    <Tag style={{ borderRadius: 6, borderColor: 'transparent', background: 'var(--surface-sunken)', color: GRADE_COLOR[cur.grade], fontSize: 11 }}>{cur.grade}</Tag>
                    <span style={{ width: 300, fontSize: 12, color: 'var(--ink-3)' }}>
                      {cur.note}
                      {delta !== undefined && delta !== 0 && (
                        <span style={{ color: delta > 0 ? 'var(--sage)' : 'var(--danger)', marginLeft: 6 }}>
                          （{delta > 0 ? '+' : ''}
                          {delta}）
                        </span>
                      )}
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
