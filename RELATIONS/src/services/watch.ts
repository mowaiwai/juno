import {Platform} from 'react-native';

export interface WatchReminder {
  id: string;
  contactId: string;
  contactName: string;
  type: 'birthday' | 'anniversary' | 'custom';
  dateLabel: string;
  dateValue: string;
  isUrgent: boolean;
  daysUntil: number;
}

export interface WatchSession {
  isReachable: boolean;
  isPaired: boolean;
  isWatchAppInstalled: boolean;
}

class WatchService {
  private isSupported: boolean = false;
  private session: WatchSession = {
    isReachable: false,
    isPaired: false,
    isWatchAppInstalled: false,
  };

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('[WatchService] Watch is only supported on iOS');
      return false;
    }

    this.isSupported = true;
    console.log('[WatchService] Initialized');

    return true;
  }

  async getSession(): Promise<WatchSession> {
    if (Platform.OS !== 'ios') {
      return {
        isReachable: false,
        isPaired: false,
        isWatchAppInstalled: false,
      };
    }

    return this.session;
  }

  async sendRemindersToWatch(reminders: WatchReminder[]): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('[WatchService] Watch not supported');
      return false;
    }

    try {
      console.log('[WatchService] Sending reminders to watch:', reminders.length);
      return true;
    } catch (error) {
      console.error('[WatchService] Failed to send reminders:', error);
      return false;
    }
  }

  async sendQuickContactToWatch(
    contactId: string,
    contactName: string,
    relationType: string,
    relationDepth: number
  ): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    try {
      console.log('[WatchService] Sending contact to watch:', contactName);
      return true;
    } catch (error) {
      console.error('[WatchService] Failed to send contact:', error);
      return false;
    }
  }

  async updateWatchSession(): Promise<void> {
    console.log('[WatchService] Updating watch session');
  }

  isWatchSupported(): boolean {
    return this.isSupported;
  }
}

export const watchService = new WatchService();

export async function initializeWatchService(): Promise<boolean> {
  return watchService.initialize();
}

export async function getWatchSession(): Promise<WatchSession> {
  return watchService.getSession();
}

export async function sendRemindersToWatch(reminders: WatchReminder[]): Promise<boolean> {
  return watchService.sendRemindersToWatch(reminders);
}

export async function sendContactToWatch(
  contactId: string,
  contactName: string,
  relationType: string,
  relationDepth: number
): Promise<boolean> {
  return watchService.sendQuickContactToWatch(contactId, contactName, relationType, relationDepth);
}

export function isWatchSupported(): boolean {
  return watchService.isWatchSupported();
}

export const WATCH_SERVICE_NOTES = `
================================================================================
                        Apple Watch 配套功能说明
================================================================================

本服务提供 Apple Watch 配套应用的基础架构，用于快捷查看人际关系提醒。

--------------------------------------------------------------------------------
1. 功能概述
--------------------------------------------------------------------------------
- 在 Apple Watch 上快速查看今日/本周重要提醒
- 显示即将到来的生日、纪念日等重要日期
- 支持一键查看联系人关系深度
- 通过 WatchConnectivity 与 iOS 主应用同步数据

--------------------------------------------------------------------------------
2. 技术架构
--------------------------------------------------------------------------------
需要创建两个独立的应用目标:
1. iOS 主应用 (RELATIONS) - 使用 React Native
2. watchOS 配套应用 (RELATIONS Watch) - 使用 SwiftUI

通信方式:
- WatchConnectivity Framework 用于双向通信
- WCSession 实现应用间的数据传输

--------------------------------------------------------------------------------
3. 推荐的第三方库
--------------------------------------------------------------------------------
对于 React Native 项目，推荐使用:

1) react-native-watch-connectivity
   - 封装了 WatchConnectivity Framework
   - 支持双向消息传递

安装命令:
   npm install react-native-watch-connectivity

--------------------------------------------------------------------------------
4. watchOS 应用开发要求
--------------------------------------------------------------------------------
watchOS 应用需要:
- Xcode 14.0+
- watchOS 9.0+ 部署目标
- SwiftUI 进行 UI 开发
- WatchConnectivity 框架进行通信

--------------------------------------------------------------------------------
5. 当前实现状态
--------------------------------------------------------------------------------
当前实现为模拟版本，提供了接口定义和数据结构。

真正的 Apple Watch 集成需要:

1) 在 Xcode 中创建独立的 watchOS 应用目标
2. 配置 WatchConnectivity 能力
3. 实现 SwiftUI 界面
4. 使用 WCSession 进行数据传输
5. 在主应用中配置 WatchConnectivity 通信

================================================================================
`;

export function formatWatchReminderForDisplay(reminder: WatchReminder): string {
  if (reminder.isUrgent) {
    return `⚠️ ${reminder.contactName} - ${reminder.dateLabel}`;
  }
  if (reminder.daysUntil === 0) {
    return `📅 今天: ${reminder.contactName}的${reminder.dateLabel}`;
  }
  if (reminder.daysUntil === 1) {
    return `📅 明天: ${reminder.contactName}的${reminder.dateLabel}`;
  }
  return `📅 ${reminder.daysUntil}天后: ${reminder.contactName}的${reminder.dateLabel}`;
}

export function getUpcomingReminders(
  contacts: Array<{
    id: string;
    name: string;
    customDates: Array<{
      id: string;
      label: string;
      date: string;
      type: string;
    }>;
  }>,
  daysAhead: number = 7
): WatchReminder[] {
  const reminders: WatchReminder[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  contacts.forEach((contact) => {
    contact.customDates.forEach((date) => {
      const [month, day] = date.date.split('-').map(Number);
      const reminderDate = new Date(today.getFullYear(), month - 1, day);
      reminderDate.setHours(0, 0, 0, 0);

      const diffTime = reminderDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= daysAhead) {
        reminders.push({
          id: date.id,
          contactId: contact.id,
          contactName: contact.name,
          type: date.type as 'birthday' | 'anniversary' | 'custom',
          dateLabel: date.label,
          dateValue: date.date,
          isUrgent: diffDays === 0,
          daysUntil: diffDays,
        });
      }
    });
  });

  return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
}