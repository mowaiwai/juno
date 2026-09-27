import {Share, Platform} from 'react-native';
import {Contact, Story} from '../types';

export interface ShareContent {
  title: string;
  message: string;
  url?: string;
}

const RELATION_LABELS: Record<string, string> = {
  family: '家人',
  friend: '朋友',
  colleague: '同事',
  lover: '恋人',
  teacher: '老师',
  client: '客户',
  neighbor: '邻居',
  other: '其他',
};

export async function shareStory(
  story: Story,
  contact: Contact
): Promise<boolean> {
  try {
    const relationText = RELATION_LABELS[contact.relationType] || contact.relationType;
    const shareContent: ShareContent = {
      title: `📖 ${contact.name}的故事`,
      message: `📖 ${contact.name} - ${relationText}\n\n${story.title}\n\n${story.content}\n\n——来自 RELATIONS`,
    };

    const result = await Share.share(
      Platform.OS === 'ios'
        ? shareContent
        : {message: shareContent.message, title: shareContent.title},
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('分享失败:', error);
    return false;
  }
}

export async function shareContact(contact: Contact): Promise<boolean> {
  try {
    const relationText = RELATION_LABELS[contact.relationType] || contact.relationType;
    const lastContactText = contact.lastContactDate
      ? formatLastContact(contact.lastContactDate)
      : '暂无联系记录';

    const shareContent: ShareContent = {
      title: `👤 ${contact.name}`,
      message: `👤 ${contact.name}\n📌 关系: ${relationText}\n💎 深度: ${contact.relationDepth}/10\n🕐 最后联系: ${lastContactText}\n\n${contact.storySummary ? `📖 ${contact.storySummary}` : ''}\n\n——来自 RELATIONS`,
    };

    const result = await Share.share(
      Platform.OS === 'ios'
        ? shareContent
        : {message: shareContent.message, title: shareContent.title},
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('分享失败:', error);
    return false;
  }
}

export async function shareRelationshipNetwork(
  totalContacts: number,
  topRelations: Array<{name: string; relationType: string; relationDepth: number}>
): Promise<boolean> {
  try {
    const topRelationsText = topRelations
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.name} (${RELATION_LABELS[r.relationType] || r.relationType})`)
      .join('\n');

    const shareContent: ShareContent = {
      title: '🌐 我的人际关系网络',
      message: `🌐 我的人际关系网络\n\n📊 联系人总数: ${totalContacts}人\n\n🏆 关系最深的联系人:\n${topRelationsText}\n\n——来自 RELATIONS`,
    };

    const result = await Share.share(
      Platform.OS === 'ios'
        ? shareContent
        : {message: shareContent.message, title: shareContent.title},
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('分享失败:', error);
    return false;
  }
}

export async function shareReminder(
  contactName: string,
  dateLabel: string,
  dateValue: string
): Promise<boolean> {
  try {
    const shareContent: ShareContent = {
      title: `📅 提醒: ${contactName}的${dateLabel}`,
      message: `📅 ${contactName}的${dateLabel}\n📆 日期: ${dateValue}\n\n别忘了在这个特殊的日子送上祝福！\n\n——来自 RELATIONS`,
    };

    const result = await Share.share(
      Platform.OS === 'ios'
        ? shareContent
        : {message: shareContent.message, title: shareContent.title},
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('分享失败:', error);
    return false;
  }
}

function formatLastContact(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}