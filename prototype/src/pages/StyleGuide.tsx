import type { ReactNode } from 'react';
import {
  Card,
  Button,
  Tag,
  Space,
  Divider,
  Input,
  Select,
  DatePicker,
  Switch,
  Checkbox,
  Slider,
  Tabs,
  Avatar,
  Badge,
  Alert,
  Tooltip,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Can } from '@/components/Can';
import { MaskedField } from '@/components/MaskedField';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card
      variant="borderless"
      style={{ background: 'var(--surface)', marginBottom: 16 }}
      title={<span style={{ fontSize: 15 }}>{title}</span>}
    >
      {children}
    </Card>
  );
}

function Swatch({
  name,
  value,
  ink,
}: {
  name: string;
  value: string;
  ink?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    >
      <div
        style={{
          height: 64,
          background: value,
          color: ink ?? 'var(--ink)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 8,
          fontSize: 11,
        }}
      >
        {value}
      </div>
      <div style={{ padding: '8px 10px', fontSize: 12 }}>{name}</div>
    </div>
  );
}

export function StyleGuide() {
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">样式总览</h1>
          <div className="page-subtitle">
            柔和马卡龙 · 奶油底 × 多彩低饱和 × 超大圆角 — 全产品组件基线
          </div>
        </div>
      </div>

      <Section title="色彩 · 纸 / 墨 / 强调">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
          }}
        >
          <Swatch name="纸面 paper" value="var(--paper)" />
          <Swatch name="卡片 surface" value="var(--surface)" />
          <Swatch name="沉底 surface-sunken" value="var(--surface-sunken)" />
          <Swatch name="莓粉 primary" value="var(--clay)" ink="#fff" />
          <Swatch name="莓粉深 primary-hover" value="var(--clay-hover)" ink="#fff" />
          <Swatch name="莓粉软 primary-soft" value="var(--clay-soft)" />
          <Swatch name="梅紫 plum" value="var(--charcoal)" ink="#fff" />
          <Swatch name="墨 ink" value="var(--ink)" ink="#fff" />
          <Swatch name="墨 2" value="var(--ink-2)" ink="#fff" />
          <Swatch name="墨 3" value="var(--ink-3)" ink="#fff" />
          <Swatch name="描边 line" value="var(--line)" />
        </div>
        <Divider />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 10,
          }}
        >
          <Swatch name="薄荷绿 mint" value="var(--sage)" ink="#fff" />
          <Swatch name="奶油黄 butter" value="var(--ochre)" ink="#fff" />
          <Swatch name="天空蓝 sky" value="var(--teal)" ink="#fff" />
          <Swatch name="薰衣草紫 lilac" value="var(--blush)" ink="#fff" />
          <Swatch name="草莓红 danger" value="var(--danger)" ink="#fff" />
          <Swatch name="大屏 night" value="var(--night)" ink="#fff" />
        </div>
      </Section>

      <Section title="字阶">
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Display · 让人才判断有依据
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ fontSize: 26, fontWeight: 650 }}>
          H1 · 年度人才盘点
        </div>
        <div style={{ fontSize: 20, fontWeight: 650, marginTop: 8 }}>
          H2 · 九宫格定位
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>
          H3 · 继任矩阵
        </div>
        <div style={{ color: 'var(--ink-2)', marginTop: 8 }}>
          Body · 业绩条件不满足：近一年评价 C 级，建议进入绩效改进计划
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
          Caption · 数据截至 2026-09-27 · 来源：人才盘点批次 inv_2026
        </div>
        <div className="num" style={{ marginTop: 8, color: 'var(--ink-2)' }}>
          数字等宽：0123456789 · ¥ 23,000 · 88.5%
        </div>
      </Section>

      <Section title="按钮">
        <Space wrap>
          <Button type="primary">主要按钮</Button>
          <Button>次级按钮</Button>
          <Button type="text">文字按钮</Button>
          <Button type="link">链接按钮</Button>
          <Button danger>危险操作</Button>
          <Button disabled>禁用</Button>
          <Button icon={<PlusOutlined />}>新建</Button>
          <Tooltip title="莓粉为强调色，用于关键高亮动作">
            <Button
              style={{
                background: 'var(--clay)',
                borderColor: 'var(--clay)',
                color: '#fff',
              }}
            >
              莓粉强调
            </Button>
          </Tooltip>
        </Space>
      </Section>

      <Section title="标签 / 徽章 / AI 标记">
        <Space wrap>
          <Tag style={{ borderRadius: 6 }}>默认</Tag>
          <Tag color="green" style={{ borderRadius: 6 }}>
            通过
          </Tag>
          <Tag color="red" style={{ borderRadius: 6 }}>
            不通过
          </Tag>
          <Tag color="orange" style={{ borderRadius: 6 }}>
            审批中
          </Tag>
          <Tag
            style={{
              borderRadius: 6,
              background: 'var(--clay-soft)',
              color: 'var(--clay-hover)',
              borderColor: 'transparent',
            }}
          >
            核心人才
          </Tag>
          <span className="ai-badge">
            <RobotOutlined /> AI 生成 · 待审核
          </span>
          <Badge count={12}>
            <Avatar shape="square" size={36}>
              待
            </Avatar>
          </Badge>
          <Badge status="warning" text="中风险" />
        </Space>
      </Section>

      <Section title="表单控件">
        <Space wrap size="large">
          <Input placeholder="请输入关键字" style={{ width: 200 }} prefix={<InfoCircleOutlined />} />
          <Select
            defaultValue="sw"
            style={{ width: 160 }}
            options={[
              { value: 'sw', label: '软件研发序列' },
              { value: 'eng', label: '机械工程序列' },
              { value: 'op', label: '工艺操作序列' },
            ]}
          />
          <DatePicker />
          <Switch defaultChecked />
          <Checkbox defaultChecked>本人确认</Checkbox>
          <div style={{ width: 180 }}>
            <Slider defaultValue={60} />
          </div>
        </Space>
      </Section>

      <Section title="Tabs / 提示 / 进度 / 掩码原语">
        <Tabs
          defaultActiveKey="1"
          items={[
            { key: '1', label: '基本条件', children: '本科及以上 / 司龄满 1 年' },
            { key: '2', label: '履职要求', children: '4 项履职，等级 独当一面' },
            { key: '3', label: '知识技能', children: '4 个知识点，四档映射题型' },
          ]}
        />
        <Space wrap size="large" style={{ marginTop: 8 }}>
          <Alert
            style={{ background: 'var(--surface-sunken)', borderColor: 'var(--line)' }}
            message="规则引擎硬校验：近一年绩效需 B 级以上"
            type="warning"
            showIcon
          />
          <Progress type="circle" percent={72} size={64} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
              MaskedField（按角色掩码）
            </div>
            <MaskedField value={23000} format={(v) => `¥ ${Number(v).toLocaleString()}`} />
          </div>
        </Space>
        <Divider />
        <Can roles={['hr']}>
          <Tag color="green">Can 原语：仅 HR 可见此元素</Tag>
        </Can>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 8 }}>
          （切到 HR 视角可验证 Can 元素）
        </span>
      </Section>
    </div>
  );
}
