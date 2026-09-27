# 人际关系网络管理应用 -RELATIONS

## 1. 项目概述

### 项目名称
**RELATIONS** - 智能人际关系网络管理器

### 核心价值
一款结合AI的人际关系网络管理应用，通过语音输入智能导入联系人，绘制可视化关系网络，并在重要时刻提供温馨提醒与故事回忆。

### 目标用户
- 注重人际关系维护的都市人群
- 人类学/社会学研究者
- 作家（人物关系管理）

### 技术栈
- **前端框架**: React Native + TypeScript
- **大模型**: 豆包API (字节跳动)
- **状态管理**: Zustand
- **本地存储**: AsyncStorage + SQLite
- **可视化**: React Native SVG / D3.js
- **语音**: 讯飞/百度语音识别

---

## 2. 功能模块

### 2.1 智能联系人导入与分析
**描述**: 用户通过语音描述一位联系人，AI自动提取关键信息并分析关系

**功能点**:
- 语音实时转文字（支持自然语言描述）
- AI自动提取：姓名、关系类型、认识时间、关键事件
- 关系强度评分（1-10）
- 与其他联系人的关联分析
- 自动生成关系标签（家人/同事/朋友/恋人等）

**AI交互示例**:
```
用户: "这是我大学室友张明，我们2018年在图书馆认识的，他帮我找过工作，现在偶尔一起吃饭喝酒"
系统解析出:
- 姓名: 张明
- 关系: 大学室友 → 朋友
- 认识时间: 2018年
- 关键事件: 帮忙找工作
- 当前状态: 偶尔联系
- 关系深度: 7/10
```

### 2.2 关系网络可视化
**描述**: 交互式可视化展示用户与所有联系人的关系网络

**功能点**:
- 力导向图布局（节点=联系人，边=关系）
- 点击节点切换视角（查看从该联系人视角出发的关系网络）
- 缩放、拖拽交互
- 关系类型颜色区分
- 关系强度通过节点大小/边粗细表示
- 搜索定位联系人

**视角切换**:
```
默认视角: 以用户为中心
切换到"张明"视角: 显示张明认识的所有人及其关系
```

### 2.3 重要日期提醒
**描述**: 管理和提醒与联系人的重要日子

**功能点**:
- 联系人生日提醒
- 认识纪念日
- 自定义重要日期（结婚纪念日、合作日期等）
- 节假日祝福提醒（春节/中秋/端午/圣诞等）
- 提醒时间自定义（提前1天/3天/7天）
- 本地推送通知

### 2.4 去年今日 - 故事生成
**描述**: 基于历史联系记录，AI生成文学化故事描述

**功能点**:
- 记录与联系人的互动（见面/通话/消息）
- 按时间轴展示"去年今日"
- AI采用多种文学手法：
  - 倒叙、插叙
  - 比喻、拟人
  - 场景描写、对话
- 故事风格可调（温馨/幽默/怀旧/诗意）
- 支持分享到社交媒体

**故事示例**:
```
【去年今日 - 与张明的故事】
那是一个春寒料峭的傍晚，咖啡馆的老式挂钟敲了六下。
张明推开门的瞬间，带进了一股夹杂着桂花香气的凉风。
我们相对而坐，聊起了毕业那年的夏天，那些为了论文
焦头烂额的日子，以及他即将启程的西藏之旅。
窗外，城市的灯火正一盏盏亮起来。
```

### 2.5 时间倒退与未来预测
**描述**: 基于时间维度的人际关系网络可视化与分析

**功能点**:
- **时间倒退**: 选择任意历史时间点，展示该时间点之前建立的人际关系
  - 时间选择器（年/月/日）
  - 根据 `knownDate` 筛选联系人
  - 动画过渡效果展示关系演变
- **预测未来**: 使用AI预测人际关系发展趋势
  - 用户描述关系发展计划
  - 或选择预设剧本（渐入佳境/逐渐疏远/重大转折/保持稳定）
  - 选择未来时间段（1年/3年/5年）
  - AI生成预测网络图和关系变化分析

**AI预测交互示例**:
```
用户: "我和张明计划明年一起创业"
时间段: 1年后
系统预测:
- 关系深度: 7 → 9 (密切合作)
- 关系类型变化: 朋友 → 同事/朋友
- 可能新联系人: 创业者、投资人
- 网络图更新显示新的关系节点
```

### 2.6 自定义关系故事撰写
**描述**: 用户可以自己撰写与联系人的关系故事，并上传图片

**功能点**:
- 富文本故事编辑器
- 每次故事最多上传7张图片
- 图片支持本地选择
- 故事自动保存到联系人档案
- 支持故事时间戳（记录故事发生时间）
- 故事列表按时间排序

### 2.7 增强联系人列表
**描述**: 全面的联系人信息管理

**功能点**:
- 联系人列表展示：
  - 姓名和头像
  - 关系类型标签
  - 联系方式（电话/邮箱/微信）
  - 故事总结（一句话描述关系）
  - 最初认识时间
  - 最后一次联系时间
- 排序功能：按最后联系时间/关系深度/姓名
- 筛选功能：按关系类型/时间段

---

## 3. UI/UX 设计规范

### 3.1 设计理念
**简约、温馨、高级** - 参考 Claude Code 风格

### 3.2 色彩系统
```
Primary:      #6366F1 (靛蓝色 - 主操作/重点)
Secondary:    #8B5CF6 (紫罗兰 - 次要强调)
Accent:       #F59E0B (琥珀色 - 提醒/重要)
Background:   #FAFAFA (米白 - 主背景)
Surface:      #FFFFFF (纯白 - 卡片)
Text Primary: #1F2937 (深灰 - 主文字)
Text Secondary: #6B7280 (中灰 - 次要文字)
Success:      #10B981 (绿色 - 成功)
Warning:      #F59E0B (琥珀 - 警告)
Error:        #EF4444 (红色 - 错误)

关系色系:
- 家人:   #EC4899 (粉色)
- 朋友:   #3B82F6 (蓝色)
- 同事:   #10B981 (绿色)
- 恋人:   #F43F5E (玫红)
- 老师:   #8B5CF6 (紫色)
- 客户:   #F59E0B (金色)
```

### 3.3 字体系统
```
主字体: System (iOS: SF Pro, Android: Roboto)
标题 H1: 28px, Bold, #1F2937
标题 H2: 24px, SemiBold, #1F2937
标题 H3: 20px, SemiBold, #1F2937
正文: 16px, Regular, #1F2937
辅助文字: 14px, Regular, #6B7280
小字: 12px, Regular, #9CA3AF
```

### 3.4 间距系统
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
xxl: 48px
```

### 3.5 页面结构

#### 3.5.1 首页/关系网络页
```
┌─────────────────────────────┐
│ [≡]  RELATIONS       [🔔]   │  <- Header
├─────────────────────────────┤
│                             │
│     ┌───┐                   │
│    /     \    [可视化网络图]  │
│   │  你  │ ─── Node ───     │
│    \     /                  │
│     └───┘                   │
│                             │
├─────────────────────────────┤
│ [网络] [列表] [日历] [我的]   │  <- Bottom Tab
└─────────────────────────────┘
```

#### 3.5.2 添加联系人页（语音输入）
```
┌─────────────────────────────┐
│ [←] 添加联系人               │
├─────────────────────────────┤
│                             │
│     ┌─────────────────┐     │
│     │                 │     │
│     │   🎤 录音动画    │     │
│     │                 │     │
│     │ "长按开始说话..." │     │
│     │                 │     │
│     └─────────────────┘     │
│                             │
│  [已识别]: 这是我大学室友...  │
│                             │
│  ┌─────────────────────────┐│
│  │ 📝 解析结果              ││
│  │ 姓名: 张明               ││
│  │ 关系: 朋友               ││
│  │ 认识时间: 2018年         ││
│  │ ...                     ││
│  └─────────────────────────┘│
│                             │
│      [ 保存联系人 ]          │
└─────────────────────────────┘
```

#### 3.5.3 联系人详情页
```
┌─────────────────────────────┐
│ [←]  张明                   │
├─────────────────────────────┤
│         ┌───┐               │
│        /     \              │
│       │  头像 │              │
│        \     /              │
│         └───┘               │
│       张明                  │
│       朋友 · 关系深度 7/10   │
├─────────────────────────────┤
│ [📞] [💬] [📅] [✏️]         │ <- 操作按钮
├─────────────────────────────┤
│ 📅 重要日期                  │
│ ├─ 🎂 生日: 8月15日         │
│ ├─ 📆 认识纪念日: 6月20日    │
│ └─ ➕ 添加日期               │
├─────────────────────────────┤
│ 📝 关系档案                  │
│ 认识渠道: 大学图书馆          │
│ 关键事件: 帮忙找工作           │
│ 当前状态: 偶尔联系             │
│ 备注: ...                   │
├─────────────────────────────┤
│ 📖 去年今日                  │
│ "那是一个春寒料峭的傍晚..."   │
└─────────────────────────────┘
```

#### 3.5.4 日历提醒页
```
┌─────────────────────────────┐
│ [←]  日历                   │
├─────────────────────────────┤
│      < May 2026 >           │
│  日  一  二  三  四  五  六  │
│  ·  ·  ·  ·   1   2   3     │
│  4   5   6   7   8   9  10   │
│ ...                         │
├─────────────────────────────┤
│ 📅 5月10日 明天              │
│ ├─ 🎂 张明 生日              │
│ └─ 📌 项目启动纪念日          │
│                             │
│ 📅 5月15日                   │
│ └─ 🎁 端午节                 │
└─────────────────────────────┘
```

### 3.6 组件规范

#### 按钮
```
Primary Button:
- Background: #6366F1
- Text: #FFFFFF
- Padding: 12px 24px
- Border Radius: 12px
- Hover: #5558E3
- Active: #4F46E5
- Shadow: 0 4px 12px rgba(99, 102, 241, 0.3)

Secondary Button:
- Background: #F3F4F6
- Text: #1F2937
- Border: 1px solid #E5E7EB
```

#### 卡片
```
- Background: #FFFFFF
- Border Radius: 16px
- Shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
- Padding: 16px
```

#### 节点（关系网络）
```
- 用户节点: 60px, #6366F1, 居中
- 一级联系人: 48px, 关系对应色
- 二级联系人: 36px, 关系对应色
- 边: 2px, 渐变透明
```

---

## 4. 数据模型

### 4.1 Contact (联系人)
```typescript
interface Contact {
  id: string;
  name: string;
  avatar?: string;
  relationType: RelationType;
  relationLabel: string;
  relationDepth: number; // 1-10
  knownDate?: string; // ISO date - 最初认识时间
  lastContactDate?: string; // ISO date - 最后联系时间
  contactInfo: ContactInfo; // 联系方式
  storySummary: string; // 一句话故事总结
  knownChannel?: string; // 认识渠道
  keyEvents: string[]; // 关键事件
  currentStatus?: string; // 当前状态
  notes?: string; // 备注
  customDates: CustomDate[];
  stories: Story[]; // 自定义故事列表
  interactionRecords: Interaction[];
  createdAt: string;
  updatedAt: string;
}

interface ContactInfo {
  phone?: string;
  email?: string;
  wechat?: string;
}

interface Story {
  id: string;
  title: string;
  content: string;
  images: string[]; // 本地图片URI列表，最多7张
  storyDate?: string; // 故事发生时间
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 RelationType (关系类型)
```typescript
type RelationType =
  | 'family'      // 家人
  | 'friend'      // 朋友
  | 'colleague'   // 同事
  | 'lover'       // 恋人
  | 'teacher'     // 老师/导师
  | 'client'      // 客户
  | 'neighbor'    // 邻居
  | 'other';      // 其他
```

### 4.3 CustomDate (自定义日期)
```typescript
interface CustomDate {
  id: string;
  type: 'birthday' | 'anniversary' | 'custom';
  label: string;
  date: string; // MM-DD
  remindDays: number[]; // 提前提醒天数 [1, 3, 7]
}
```

### 4.4 Interaction (互动记录)
```typescript
interface Interaction {
  id: string;
  contactId: string;
  type: 'meet' | 'call' | 'message' | 'gift';
  date: string;
  description?: string;
  storyGenerated?: string; // AI生成的故事
}
```

### 4.5 RelationEdge (关系边)
```typescript
interface RelationEdge {
  id: string;
  from: string; // contactId
  to: string; // contactId
  relation?: string; // 两人之间的关系描述
  strength: number; // 1-10
}
```

---

## 5. API设计 (豆包集成)

### 5.1 联系人解析
```
POST /api/ai/parse-contact
Request: { voiceText: string }
Response: {
  success: boolean;
  data: {
    name: string;
    relationType: RelationType;
    relationLabel: string;
    knownDate?: string;
    knownChannel?: string;
    keyEvents: string[];
    relationDepth: number;
  }
}
```

### 5.2 关系分析
```
POST /api/ai/analyze-relations
Request: {
  contactId: string;
  allContacts: Contact[];
}
Response: {
  success: boolean;
  data: {
    edges: RelationEdge[];
    insights: string[];
  }
}
```

### 5.3 故事生成
```
POST /api/ai/generate-story
Request: {
  contactId: string;
  interactions: Interaction[];
  style: 'warm' | 'humor' | 'nostalgic' | 'poetic';
}
Response: {
  success: boolean;
  data: {
    story: string;
    title: string;
  }
}
```

---

## 6. 项目结构

```
RELATIONS/
├── src/
│   ├── components/         # 可复用组件
│   │   ├── common/        # 通用组件 (Button, Card, Input...)
│   │   ├── network/       # 关系网络组件
│   │   ├── contact/       # 联系人相关组件
│   │   └── calendar/      # 日历相关组件
│   ├── screens/           # 页面
│   │   ├── HomeScreen/   # 首页/关系网络
│   │   ├── ContactList/  # 联系人列表
│   │   ├── ContactDetail/# 联系人详情
│   │   ├── AddContact/   # 添加联系人
│   │   ├── Calendar/     # 日历提醒
│   │   └── Profile/      # 我的/设置
│   ├── navigation/       # 路由配置
│   ├── store/            # Zustand 状态管理
│   ├── services/         # API 服务
│   │   ├── api.ts        # API 封装
│   │   └── doubao.ts     # 豆包 API
│   ├── utils/            # 工具函数
│   ├── hooks/            # 自定义 Hooks
│   ├── types/            # TypeScript 类型
│   ├── constants/        # 常量配置
│   └── theme/            # 主题配置
├── App.tsx
└── index.js
```

---

## 7. 开发计划

### Phase 1: 基础框架搭建
- [ ] 初始化 React Native 项目
- [ ] 配置 TypeScript
- [ ] 设置主题系统和色彩规范
- [ ] 配置导航 (React Navigation)
- [ ] 创建基础组件库

### Phase 2: 核心功能
- [ ] 联系人数据模型和本地存储
- [ ] 联系人列表页面
- [ ] 添加联系人页面 (语音输入)
- [ ] 豆包 API 集成 (联系人解析)

### Phase 3: 关系网络可视化
- [ ] 关系网络图组件
- [ ] 节点交互 (点击/缩放/拖拽)
- [ ] 视角切换功能
- [ ] 关系边展示

### Phase 4: 提醒功能
- [ ] 日历组件
- [ ] 重要日期管理
- [ ] 消息推送集成
- [ ] 提醒逻辑

### Phase 5: 故事生成
- [ ] 互动记录管理
- [ ] 豆包 API 故事生成
- [ ] 故事展示页面
- [ ] 分享功能

### Phase 6: 优化完善
- [ ] 动画和过渡
- [ ] 错误处理
- [ ] 性能优化
- [ ] 测试

---

## 8. 后续功能优化建议

1. **智能关系建议**: 基于互动频率建议保持联系
2. **群组功能**: 支持创建群组（家人群、大学同学群）
3. **互动提醒**: 久未联系时提醒用户
4. **数据导出**: 导出关系网络图（PNG/JSON）
5. **多语言支持**: 中文/英文/粤语
6. **暗色模式**: 支持深色主题
7. **Apple Watch 配套**: 快捷查看和提醒
