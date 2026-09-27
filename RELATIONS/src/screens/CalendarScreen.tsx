import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {Card, Avatar} from '../components/common';
import {CustomDate, Contact} from '../types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const getDateString = (date: string): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CalendarScreen() {
  const {contacts} = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getAllCustomDates = (): Array<{contact: Contact; customDate: CustomDate}> => {
    const result: Array<{contact: Contact; customDate: CustomDate}> = [];

    contacts.forEach((contact) => {
      contact.customDates.forEach((customDate) => {
        const customMonth = parseInt(customDate.date.split('-')[0], 10) - 1;
        if (customMonth === month) {
          result.push({contact, customDate});
        }
      });
    });

    return result.sort((a, b) => {
      const dayA = parseInt(a.customDate.date.split('-')[1], 10);
      const dayB = parseInt(b.customDate.date.split('-')[1], 10);
      return dayA - dayB;
    });
  };

  const upcomingDates = getAllCustomDates();
  const today = new Date();
  const todayStr = getDateString(today.toISOString());

  const renderCalendarDays = () => {
    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const hasReminder = upcomingDates.some((item) => {
        const itemDay = parseInt(item.customDate.date.split('-')[1], 10);
        return itemDay === day;
      });

      days.push(
        <View key={day} style={styles.dayCell}>
          <View
            style={[
              styles.dayCircle,
              isToday && styles.dayCircleToday,
              hasReminder && !isToday && styles.dayCircleHasReminder,
            ]}>
            <Text
              style={[
                styles.dayText,
                isToday && styles.dayTextToday,
                hasReminder && !isToday && styles.dayTextHasReminder,
              ]}>
              {day}
            </Text>
          </View>
          {hasReminder && !isToday && <View style={styles.reminderDot} />}
        </View>
      );
    }

    return days;
  };

  const getDateLabel = (customDate: CustomDate): string => {
    const day = parseInt(customDate.date.split('-')[1], 10);
    const today = new Date();
    const targetDate = new Date(year, month, day);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '明天';
    if (diffDays === 2) return '后天';
    return `${diffDays}天后`;
  };

  const getHolidayName = (month: number, day: number): string | null => {
    const holidays: Record<string, string> = {
      '1-1': '元旦',
      '5-1': '劳动节',
      '5-5': '端午节',
      '8-15': '中秋节',
      '10-1': '国庆节',
      '12-25': '圣诞节',
      '2-14': '情人节',
    };
    return holidays[`${month + 1}-${day}`] || null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>日历</Text>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => (
              <Text
                key={day}
                style={[
                  styles.weekdayText,
                  index === 0 && styles.weekdayTextWeekend,
                  index === 6 && styles.weekdayTextWeekend,
                ]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>{renderCalendarDays()}</View>
        </Card>

        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>
            {MONTHS[month]} 月的重要日期
          </Text>

          {upcomingDates.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>本月没有设置重要日期</Text>
            </Card>
          ) : (
            upcomingDates.map(({contact, customDate}) => (
              <Card key={customDate.id} style={styles.reminderCard}>
                <View style={styles.reminderRow}>
                  <Avatar
                    name={contact.name}
                    relationType={contact.relationType}
                    size="md"
                  />
                  <View style={styles.reminderInfo}>
                    <Text style={styles.reminderName}>{contact.name}</Text>
                    <Text style={styles.reminderLabel}>{customDate.label}</Text>
                  </View>
                  <View style={styles.reminderDate}>
                    <Text style={styles.reminderDay}>
                      {parseInt(customDate.date.split('-')[1], 10)}日
                    </Text>
                    <Text style={styles.reminderTimeLabel}>
                      {getDateLabel(customDate)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={styles.holidaysSection}>
          <Text style={styles.sectionTitle}>法定节假日</Text>
          <Card style={styles.holidaysCard}>
            <Text style={styles.holidayText}>暂无节假日信息</Text>
          </Card>
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
  calendarCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navBtn: {
    padding: spacing.sm,
  },
  navBtnText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
  },
  monthTitle: {
    ...typography.h3,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  weekdayTextWeekend: {
    color: colors.error,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    backgroundColor: colors.primary,
  },
  dayCircleHasReminder: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dayText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  dayTextToday: {
    color: colors.surface,
    fontWeight: '600',
  },
  dayTextHasReminder: {
    color: colors.accent,
    fontWeight: '600',
  },
  reminderDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  upcomingSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
  },
  reminderCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reminderName: {
    ...typography.body,
    fontWeight: '600',
  },
  reminderLabel: {
    ...typography.caption,
  },
  reminderDate: {
    alignItems: 'flex-end',
  },
  reminderDay: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  reminderTimeLabel: {
    ...typography.small,
    color: colors.accent,
  },
  holidaysSection: {
    marginBottom: spacing.xxl,
  },
  holidaysCard: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  holidayText: {
    ...typography.caption,
  },
});
