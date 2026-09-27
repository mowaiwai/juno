import {chatCompletion, ChatMessage} from './doubao';
import {ParsedContact, Contact, RelationType, RelationEdge, StoryStyleType} from '../types';

const SYSTEM_PROMPT = `你是一个专业的人际关系分析助手。用户会描述一个联系人，你需要从他的描述中提取关键信息并以JSON格式返回。

请分析以下信息：
- 姓名
- 关系类型（家人/朋友/同事/恋人/老师/客户/邻居/其他）
- 认识时间（如果提到）
- 认识渠道（如果提到）
- 关键事件（最多3个）
- 关系深度评分（1-10）

请用JSON格式返回，示例：
{
  "name": "张明",
  "relationType": "friend",
  "relationLabel": "朋友",
  "knownDate": "2018年6月",
  "knownChannel": "大学图书馆",
  "keyEvents": ["帮忙找工作", "一起旅行"],
  "relationDepth": 7
}`;

export async function parseContactFromVoice(voiceText: string): Promise<ParsedContact> {
  const messages: ChatMessage[] = [
    {role: 'system', content: SYSTEM_PROMPT},
    {role: 'user', content: `请分析以下描述：${voiceText}`},
  ];

  try {
    const response = await chatCompletion(messages);
    const content = response.choices[0]?.message?.content || '{}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedContact;
    }

    return {
      name: '',
      relationType: 'other' as RelationType,
      relationLabel: '其他',
      keyEvents: [],
      relationDepth: 5,
    };
  } catch (error) {
    console.error('Failed to parse contact:', error);
    return {
      name: '',
      relationType: 'other' as RelationType,
      relationLabel: '其他',
      keyEvents: [],
      relationDepth: 5,
    };
  }
}

export async function analyzeRelations(
  contact: Contact,
  allContacts: Contact[]
): Promise<{edges: RelationEdge[]; insights: string[]}> {
  const prompt = `
分析以下联系人的关系网络：
当前联系人：${contact.name}
所有联系人：${allContacts.map(c => c.name).join(', ')}

请分析哪些人可能相互认识，返回JSON格式：
{
  "edges": [
    {"from": "联系人A", "to": "联系人B", "relation": "同事关系", "strength": 6}
  ],
  "insights": ["他们可能在同一个公司工作"]
}
`;

  try {
    const response = await chatCompletion([
      {role: 'user', content: prompt},
    ]);
    const content = response.choices[0]?.message?.content || '{}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        edges: parsed.edges || [],
        insights: parsed.insights || [],
      };
    }
  } catch (error) {
    console.error('Failed to analyze relations:', error);
  }

  return {edges: [], insights: []};
}

const STORY_STYLES: Record<StoryStyleType, string> = {
  warm: '温馨感人，用细腻的笔触描写人物之间的情感',
  humor: '轻松幽默，带有一些有趣的细节和对话',
  nostalgic: '怀旧抒情，回忆往事，带着淡淡的感慨',
  poetic: '诗意盎然，用诗意的语言描绘场景和情感',
};

export async function generateStory(
  contact: Contact,
  interactions: {date: string; type: string; description?: string}[],
  style: StoryStyleType = 'warm'
): Promise<{title: string; story: string}> {
  const interactionsText = interactions
    .map((i) => `${i.date}: ${i.description || `进行了${i.type === 'meet' ? '见面' : i.type === 'call' ? '通话' : i.type === 'message' ? '消息交流' : '交换礼物'}`}`)
    .join('\n');

  const prompt = `
基于以下与${contact.name}的互动记录，用${STORY_STYLES[style]}的风格，写一个150-200字的小故事。

互动记录：
${interactionsText || '暂无详细记录，但回忆中充满了温暖的片段'}

关系背景：${contact.relationLabel}，认识于${contact.knownChannel || '某个场合'}。

请返回一个JSON格式：
{
  "title": "故事标题（不超过10个字）",
  "story": "故事内容..."
}
`;

  try {
    const response = await chatCompletion([
      {role: 'user', content: prompt},
    ]);
    const content = response.choices[0]?.message?.content || '{}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || `${contact.name}的故事`,
        story: parsed.story || '',
      };
    }
  } catch (error) {
    console.error('Failed to generate story:', error);
  }

  return {
    title: `${contact.name}的故事`,
    story: `那是与${contact.name}的一个特别时刻，${contact.relationLabel}之间的情谊在这一刻显得格外珍贵。`,
  };
}
