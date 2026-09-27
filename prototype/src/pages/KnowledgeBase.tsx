import { useMemo, useState } from 'react';
import { Card, Col, Row, Segmented, Tag } from 'antd';
import { EyeOutlined, LikeOutlined } from '@ant-design/icons';
import { KnowledgeItem, knowledgeItems } from '@/mock/training';

type Filter = 'all' | 'published' | 'extracting' | 'draft';

const STATUS_META: Record<KnowledgeItem['status'], { label: string; bg: string; color: string }> = {
  published: { label: '已发布', bg: 'var(--sage-soft)', color: 'var(--sage)' },
  extracting: { label: 'AI 萃取中', bg: 'var(--clay-soft)', color: 'var(--clay)' },
  draft: { label: '草稿', bg: 'var(--surface-sunken)', color: 'var(--ink-3)' },
};

export function KnowledgeBase() {
  const [filter, setFilter] = useState<Filter>('all');
  const list = useMemo(() => knowledgeItems.filter((k) => filter === 'all' || k.status === filter), [filter]);

  const totalReads = knowledgeItems.reduce((s, k) => s + k.reads, 0);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">经验萃取库</h1>
          <div className="page-subtitle">专家访谈萃取 + AI 自动萃取 · 组织经验沉淀为可检索资产</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {[
          { label: '知识条目', value: knowledgeItems.length, sub: '覆盖 5 个领域' },
          { label: '已发布', value: knowledgeItems.filter((k) => k.status === 'published').length, sub: '全员可检索' },
          { label: '累计阅读', value: totalReads, sub: '本季度 +18%' },
          { label: 'AI 萃取中', value: knowledgeItems.filter((k) => k.status === 'extracting').length, sub: '来自会议纪要与报表' },
        ].map((s) => (
          <Col span={6} key={s.label}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        variant="borderless"
        style={{ background: 'var(--surface)' }}
        size="small"
        title="知识条目"
        extra={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { label: '全部', value: 'all' },
              { label: '已发布', value: 'published' },
              { label: 'AI 萃取中', value: 'extracting' },
              { label: '草稿', value: 'draft' },
            ]}
          />
        }
      >
        <Row gutter={[16, 16]}>
          {list.map((k) => (
            <Col span={8} key={k.id}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, height: '100%', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <Tag style={{ borderRadius: 6, background: STATUS_META[k.status].bg, color: STATUS_META[k.status].color, borderColor: 'transparent', margin: 0 }}>
                    {STATUS_META[k.status].label}
                  </Tag>
                  <Tag style={{ borderRadius: 6, background: 'var(--surface-sunken)', color: 'var(--ink-2)', borderColor: 'var(--line)', margin: 0 }}>
                    {k.category}
                  </Tag>
                </div>
                <div className="font-serif" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{k.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7, minHeight: 40 }}>{k.summary}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {k.way === 'ai' ? 'AI 访谈萃取' : '专家访谈'} · {k.author}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    <EyeOutlined /> <span className="num">{k.reads}</span>
                    <LikeOutlined style={{ marginLeft: 8 }} /> <span className="num">{k.likes}</span>
                  </span>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
