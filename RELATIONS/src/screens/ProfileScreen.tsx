import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {Card, Avatar} from '../components/common';
import {initializeWatchService, getWatchSession, getUpcomingReminders, WatchReminder} from '../services/watch';

export default function ProfileScreen() {
  const {contacts} = useStore();
  const [watchSession, setWatchSession] = useState({
    isReachable: false,
    isPaired: false,
    isWatchAppInstalled: false,
  });
  const [upcomingReminders, setUpcomingReminders] = useState<WatchReminder[]>([]);

  const stats = {
    total: contacts.length,
    friends: contacts.filter((c) => c.relationType === 'friend').length,
    family: contacts.filter((c) => c.relationType === 'family').length,
    colleagues: contacts.filter((c) => c.relationType === 'colleague').length,
  };

  useEffect(() => {
    initializeWatchService().then(() => {
      getWatchSession().then(setWatchSession);
    });

    const reminders = getUpcomingReminders(contacts, 7);
    setUpcomingReminders(reminders);
  }, [contacts]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar name="我" size="xl" />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>我的主页</Text>
              <Text style={styles.profileSubtitle}>
                维护 {stats.total} 个关系
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>联系人</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.friends}</Text>
              <Text style={styles.statLabel}>朋友</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.family}</Text>
              <Text style={styles.statLabel}>家人</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.colleagues}</Text>
              <Text style={styles.statLabel}>同事</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>

          <Card padding="none">
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔔</Text>
              <Text style={styles.menuText}>通知设置</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔒</Text>
              <Text style={styles.menuText}>隐私设置</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>🎨</Text>
              <Text style={styles.menuText}>主题设置</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apple Watch 配套</Text>

          <Card padding="none">
            <View style={styles.watchStatusContainer}>
              <View style={styles.watchStatusRow}>
                <Text style={styles.watchStatusIcon}>
                  {watchSession.isPaired ? '⌚️' : '⌚️'}
                </Text>
                <View style={styles.watchStatusInfo}>
                  <Text style={styles.watchStatusTitle}>Apple Watch 连接状态</Text>
                  <Text style={styles.watchStatusDesc}>
                    {watchSession.isPaired
                      ? '已配对'
                      : '未配对'}
                    {' · '}
                    {watchSession.isWatchAppInstalled
                      ? '应用已安装'
                      : '应用未安装'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.watchStatusDot,
                    watchSession.isReachable
                      ? styles.watchStatusDotActive
                      : styles.watchStatusDotInactive,
                  ]}
                />
              </View>

              {upcomingReminders.length > 0 && (
                <View style={styles.watchRemindersSection}>
                  <Text style={styles.watchRemindersTitle}>
                    📅 未来7天提醒 ({upcomingReminders.length})
                  </Text>
                  {upcomingReminders.slice(0, 3).map((reminder) => (
                    <View key={reminder.id} style={styles.watchReminderItem}>
                      <Text style={styles.watchReminderText}>
                        {reminder.isUrgent ? '⚠️ ' : ''}
                        {reminder.contactName} - {reminder.dateLabel}
                      </Text>
                      <Text style={styles.watchReminderDays}>
                        {reminder.daysUntil === 0
                          ? '今天'
                          : `${reminder.daysUntil}天后`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据管理</Text>

          <Card padding="none">
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>📤</Text>
              <Text style={styles.menuText}>导出数据</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>📥</Text>
              <Text style={styles.menuText}>导入数据</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>🔄</Text>
              <Text style={styles.menuText}>同步设置</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>

          <Card padding="none">
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>ℹ️</Text>
              <Text style={styles.menuText}>关于我们</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>📖</Text>
              <Text style={styles.menuText}>使用指南</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuIcon}>⭐</Text>
              <Text style={styles.menuText}>给我们评分</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RELATIONS v1.0.0</Text>
          <Text style={styles.footerSubtext}>智能人际关系网络管理器</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h2,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  profileCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  profileSubtitle: {
    ...typography.caption,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.small,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  menuText: {
    ...typography.body,
    flex: 1,
  },
  menuChevron: {
    fontSize: 20,
    color: colors.textTertiary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 20 + spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xxl,
  },
  footerText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  footerSubtext: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  watchStatusContainer: {
    padding: spacing.lg,
  },
  watchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchStatusIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  watchStatusInfo: {
    flex: 1,
  },
  watchStatusTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  watchStatusDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  watchStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  watchStatusDotActive: {
    backgroundColor: colors.success,
  },
  watchStatusDotInactive: {
    backgroundColor: colors.textTertiary,
  },
  watchRemindersSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  watchRemindersTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  watchReminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  watchReminderText: {
    ...typography.small,
    color: colors.textPrimary,
    flex: 1,
  },
  watchReminderDays: {
    ...typography.small,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});
