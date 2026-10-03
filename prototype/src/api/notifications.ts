/** 站内通知接口：认证流程节点自动投递。 */
import { api } from './client';
import { USE_MOCK } from './config';
import { noticesOf, type NoticeItem } from '@/mock/notifications';

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  payload: Record<string, string | number | null>;
  read_at: string | null;
  created_at: string;
}

/** 可执行动作类型（有跳转链接，归入「待办」） */
const ACTIONABLE_TYPES = new Set(['task_assigned', 'review_reminder']);

/** 后端 action → 前端路由 */
function linkOf(n: NotificationDTO): string | undefined {
  const appId = n.payload.application_id;
  switch (n.payload.action) {
    case 'manager_review':
      return '/app/cert-review';
    case 'edit_and_resubmit':
      return appId ? `/app/cert-apply?app=${appId}` : '/app/my-cert';
    case 'wait_committee':
    case 'wait_publish':
    case 'view_certificate':
      return '/app/my-cert';
    default:
      return undefined;
  }
}

const REJECT_CATEGORY_LABEL: Record<string, string> = {
  evidence_insufficient: '举证不足',
  self_assessment_mismatch: '自评与实际明显不符',
  ability_gap: '能力差距较大',
  tenure_not_ready: '历练不足',
  other: '其他',
};

/** 由 payload 推导描述文案 */
function descOf(n: NotificationDTO): string {
  const p = n.payload;
  switch (n.type) {
    case 'task_assigned':
      return `目标职级 ${p.target_grade ?? ''}，请及时完成初审。`;
    case 'review_reminder':
      return `初审截止临近（第 ${p.day ?? ''} 天提醒），请尽快处理。`;
    case 'manager_review_approved':
      return '初审已通过，申请进入认证评审环节，请等待评审结果。';
    case 'manager_review_rejected': {
      const cat = typeof p.reject_category === 'string' ? (REJECT_CATEGORY_LABEL[p.reject_category] ?? p.reject_category) : '';
      return `驳回类别：${cat}。${p.comment ?? ''}`.trim();
    }
    case 'decision_approved':
      return '评审终裁通过，等待 HR 发布，发布后职级当日生效。';
    case 'decision_rejected':
      return '评审终裁未通过，可基于最新标准重新发起申请。';
    case 'decision_published':
      return `认证结果已发布，新职级 ${p.new_grade ?? ''} 当日生效。`;
    default:
      return '';
  }
}

/** 后端 DTO → 页面 NoticeItem（真实模式专用适配） */
export function toNoticeItem(n: NotificationDTO): NoticeItem {
  const actionable = ACTIONABLE_TYPES.has(n.type);
  const done = n.read_at !== null;
  return {
    id: n.id,
    personaId: '',
    kind: actionable && !done ? 'todo' : 'msg',
    level: n.type === 'task_assigned' || n.type === 'review_reminder' ? 'urgent' : 'normal',
    title: n.title,
    desc: descOf(n),
    time: n.created_at.slice(0, 16).replace('T', ' '),
    link: linkOf(n),
    linkLabel: actionable ? '去处理' : '查看',
    doneAt: done ? n.read_at!.slice(0, 16).replace('T', ' ') : undefined,
  };
}

export const notificationsApi = {
  list: async (): Promise<NoticeItem[]> => {
    if (USE_MOCK) return Promise.resolve(noticesOf(''));
    const rows = await api.get<NotificationDTO[]>('/notifications');
    return rows.map(toNoticeItem);
  },
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: async (id: string): Promise<void> => {
    if (USE_MOCK) return Promise.resolve();
    await api.post(`/notifications/${id}/read`);
  },
};
