import { useState } from 'react';
import { Avatar, Button, Card, Input, Space, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { employees } from '@/mock/people';
import { threeCharts } from '@/mock/inventory';

interface QaItem {
  q: string;
  a: string;
  sources: string[];
}

const PRESET: QaItem[] = [
  {
    q: '软件研发部为什么是哑铃型？有什么风险？',
    a: '软件研发部共 8 人，其中 P2 级 3 人、P3 级 3 人、P4 级 2 人，中坚层（P3）占比 37.5% 低于 40% 阈值，且 P3→P4 通过率不足。风险：中坚断层导致项目交付过度依赖 2 名 P4，一旦流失将直接影响数字化转型专项。建议加速许云清、温以宁的 P3→P4 认证，并启动外部招聘。',
    sources: ['人才结构图-研发中心', '盘点批次 inv_2026_h1', '认证记录-许云清 P3→P4'],
  },
  {
    q: '本期有多少意愿度异常员工？分别是谁？',
    a: `本期识别到 ${threeCharts.talent.willingnessAnomaly.length} 名意愿度异常员工（能力≥75 但业绩<78）：${threeCharts.talent.willingnessAnomaly.map((id) => employees.find((e) => e.id === id)?.name).join('、')}。这类员工能力强但业绩未达预期，通常是意愿度或岗位匹配问题，建议 HRBP 逐一介入面谈，结合 IDP 调整工作内容或激励方式。`,
    sources: ['人才图-能力×业绩散点', '员工画像-能力维度'],
  },
  {
    q: '核心岗位断层风险最高的是哪个？建议如何补位？',
    a: `断层风险最高的是「高级软件工程师」（研发中心），4 个编制仅 2 人在岗，中坚通过率不足且 1 人有流失风险。建议：① 加速许云清、温以宁的 P3→P4 认证（90 天内）；② 启动外部招聘 2 名 P4；③ 对顾屿白启动保留面谈，避免核心流失。销售部「大客户经理」为单岗风险，需同步启动继任与外部猎聘。`,
    sources: ['断层预警清单', '继任矩阵-核心岗位'],
  },
  {
    q: '高潜人才池有多少人？分布在哪些部门？',
    a: `本期高潜（潜力 HIGH）共 ${threeCharts.talent.highPotentialCount} 人，占盘点总人数约 ${Math.round((threeCharts.talent.highPotentialCount / employees.length) * 100)}%。主要分布在研发中心、制造中心与职能部门，构成核心人才池。建议纳入高潜培养计划，配导师、给核心项目，每季度复盘成长。`,
    sources: ['九宫格看板-高潜区', '盘点批次 inv_2026_h1'],
  },
];

export function CockpitQA() {
  const [items, setItems] = useState<QaItem[]>([]);
  const [input, setInput] = useState('');

  const ask = (q: string) => {
    const found = PRESET.find((p) => p.q === q);
    if (found) {
      setItems((p) => [...p, found]);
      setInput('');
    }
  };

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">驾驶舱问答</h1>
          <div className="page-subtitle">自然语言提问，AI 基于盘点/结构/断层数据给出可溯源回答</div>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} size="small">
        <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--ink-3)' }}>试试这些问题：</div>
        <Space wrap>
          {PRESET.map((p) => (
            <Tag
              key={p.q}
              style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 16, background: 'var(--clay-soft)', color: 'var(--clay)', borderColor: 'transparent' }}
              onClick={() => ask(p.q)}
            >
              {p.q}
            </Tag>
          ))}
        </Space>
      </Card>

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
                <div style={{ color: 'var(--ink-2)', lineHeight: 1.8 }}>{it.a}</div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>数据来源：</span>
                  {it.sources.map((s) => (
                    <Tag key={s} style={{ fontSize: 11, borderRadius: 4, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>{s}</Tag>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Space>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', padding: '12px 0', marginTop: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="large"
            placeholder="输入你的问题，如：哪些部门继任覆盖率不足？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => input && ask(PRESET[0].q)}
          />
          <Button type="primary" size="large" icon={<SendOutlined />} style={{ background: 'var(--charcoal)' }} onClick={() => input && ask(PRESET[0].q)}>
            发送
          </Button>
        </Space.Compact>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>演示版本仅支持预设问题，输入任意内容将返回默认回答</div>
      </div>
    </div>
  );
}
