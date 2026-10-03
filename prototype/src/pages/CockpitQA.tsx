import { useRef, useState } from 'react';
import { Avatar, Button, Card, Input, Space, Spin, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { cockpitApi, type CockpitAnswer } from '@/api/cockpit';
import { ApiError } from '@/api/client';

interface QaItem {
  q: string
  a: CockpitAnswer
}

export function CockpitQA() {
  const [items, setItems] = useState<QaItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const answer = await cockpitApi.ask(q);
      setItems((p) => [...p, { q, a: answer }]);
      setInput('');
      requestAnimationFrame(() =>
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight }),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setItems((p) => [
          ...p,
          {
            q,
            a: {
              answer: 'AI 助手尚未配置模型密钥，请联系管理员在系统设置中配置后再试。',
              sources: [],
              model: 'unavailable',
            },
          },
        ]);
      } else {
        setItems((p) => [
          ...p,
          {
            q,
            a: {
              answer:
                e instanceof ApiError ? e.message : 'AI 服务暂时不可用，请稍后重试。',
              sources: [],
              model: 'error',
            },
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">驾驶舱问答</h1>
          <div className="page-subtitle">自然语言提问，AI 基于盘点/结构/继任数据给出可溯源回答</div>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink-3)' }}>试试这些问题：</div>
        <Space wrap>
          {cockpitApi.preset.map((q) => (
            <Tag
              key={q}
              style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 16, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}
              onClick={() => ask(q)}
            >
              {q}
            </Tag>
          ))}
        </Space>
      </Card>

      <div ref={listRef} style={{ maxHeight: '50vh', overflowY: 'auto', marginBottom: 16 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {items.map((it, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <div style={{ maxWidth: '80%', background: 'var(--charcoal)', color: '#fff', padding: '10px 14px', borderRadius: '12px 12px 2px 12px' }}>
                  {it.q}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Avatar style={{ background: 'var(--clay)' }}>AI</Avatar>
                <div style={{ flex: 1, background: 'var(--surface-sunken)', padding: '12px 16px', borderRadius: '2px 12px 12px 12px' }}>
                  <div style={{ color: 'var(--ink-2)', lineHeight: 1.8 }}>{it.a.answer}</div>
                  {it.a.sources.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>数据来源：</span>
                      {it.a.sources.map((s) => (
                        <Tag key={s} style={{ fontSize: 11, borderRadius: 4, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>{s}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar style={{ background: 'var(--clay)' }}>AI</Avatar>
              <div style={{ background: 'var(--surface-sunken)', padding: '14px 16px', borderRadius: '2px 12px 12px 12px' }}>
                <Spin size="small" /> <span style={{ marginLeft: 8, color: 'var(--ink-3)', fontSize: 13 }}>正在分析组织数据…</span>
              </div>
            </div>
          )}
        </Space>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', padding: '12px 0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="large"
            placeholder="输入你的问题，如：哪些部门继任覆盖率不足？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => ask(input)}
          />
          <Button type="primary" size="large" icon={<SendOutlined />} style={{ background: 'var(--charcoal)' }} loading={loading} onClick={() => ask(input)}>
            发送
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
}
