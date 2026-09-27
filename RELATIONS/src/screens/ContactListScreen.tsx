import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {RootStackParamList} from '../navigation';
import {Avatar, Card} from '../components/common';
import {Contact} from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

type SortType = 'lastContact' | 'depth' | 'name';

export default function ContactListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {getSortedContacts, getContactsByRelationType} = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortType>('lastContact');

  const filteredContacts = getContactsByRelationType(filterType || '').filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    switch (sortBy) {
      case 'lastContact':
        const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
        const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
        return dateB - dateA;
      case 'depth':
        return b.relationDepth - a.relationDepth;
      case 'name':
        return a.name.localeCompare(b.name, 'zh');
      default:
        return 0;
    }
  });

  const handleContactPress = (contact: Contact) => {
    navigation.navigate('ContactDetail', {contactId: contact.id});
  };

  const formatLastContact = (date?: string) => {
    if (!date) return '从未联系';
    const now = new Date();
    const contactDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };

  const formatKnownDate = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  };

  const getContactIcons = (contact: Contact) => {
    const icons: string[] = [];
    if (contact.contactInfo.phone) icons.push('📞');
    if (contact.contactInfo.email) icons.push('📧');
    if (contact.contactInfo.wechat) icons.push('💬');
    return icons;
  };

  const renderContact = ({item}: {item: Contact}) => (
    <TouchableOpacity
      onPress={() => handleContactPress(item)}
      activeOpacity={0.7}>
      <Card style={styles.contactCard}>
        <View style={styles.contactRow}>
          <Avatar
            name={item.name}
            avatar={item.avatar}
            relationType={item.relationType}
            size="lg"
          />
          <View style={styles.contactInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.contactName}>{item.name}</Text>
              <View style={styles.contactIcons}>
                {getContactIcons(item).map((icon, index) => (
                  <Text key={index} style={styles.contactIcon}>{icon}</Text>
                ))}
              </View>
            </View>

            <View style={styles.relationTag}>
              <View
                style={[
                  styles.relationDot,
                  {backgroundColor: colors.relation[item.relationType]},
                ]}
              />
              <Text style={styles.relationText}>
                {RELATION_LABELS[item.relationType]}
              </Text>
              <Text style={styles.depthText}>深度 {item.relationDepth}/10</Text>
            </View>

            {item.storySummary ? (
              <Text style={styles.storySummary} numberOfLines={1}>
                {item.storySummary}
              </Text>
            ) : null}

            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>
                🕐 {formatLastContact(item.lastContactDate)}
              </Text>
              {item.knownDate && (
                <Text style={styles.timeLabel}>
                  📅 {formatKnownDate(item.knownDate)}认识
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderFilterChips = () => {
    const types = [
      {key: null, label: '全部'},
      {key: 'friend', label: '朋友'},
      {key: 'family', label: '家人'},
      {key: 'colleague', label: '同事'},
      {key: 'lover', label: '恋人'},
    ];

    return (
      <View style={styles.filterContainer}>
        {types.map((type) => (
          <TouchableOpacity
            key={type.key || 'all'}
            style={[
              styles.filterChip,
              filterType === type.key && styles.filterChipActive,
            ]}
            onPress={() => setFilterType(type.key)}>
            <Text
              style={[
                styles.filterChipText,
                filterType === type.key && styles.filterChipTextActive,
              ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderSortTabs = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>排序:</Text>
      <TouchableOpacity
        style={[styles.sortTab, sortBy === 'lastContact' && styles.sortTabActive]}
        onPress={() => setSortBy('lastContact')}>
        <Text
          style={[
            styles.sortTabText,
            sortBy === 'lastContact' && styles.sortTabTextActive,
          ]}>
          最后联系
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortTab, sortBy === 'depth' && styles.sortTabActive]}
        onPress={() => setSortBy('depth')}>
        <Text
          style={[
            styles.sortTabText,
            sortBy === 'depth' && styles.sortTabTextActive,
          ]}>
          关系深度
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortTab, sortBy === 'name' && styles.sortTabActive]}
        onPress={() => setSortBy('name')}>
        <Text
          style={[
            styles.sortTabText,
            sortBy === 'name' && styles.sortTabTextActive,
          ]}>
          姓名
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>联系人</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddContact')}>
          <Text style={styles.addBtnText}>+ 添加</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索联系人..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {renderFilterChips()}
      {renderSortTabs()}

      {sortedContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>◯</Text>
          <Text style={styles.emptyTitle}>
            {filteredContacts.length === 0 ? '还没有联系人' : '没有找到匹配的联系人'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filteredContacts.length === 0
              ? '点击右上角添加第一位联系人'
              : '尝试其他搜索词或筛选条件'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedContacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h2,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  addBtnText: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.surface,
    fontWeight: '500',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortLabel: {
    ...typography.caption,
    marginRight: spacing.sm,
  },
  sortTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  sortTabActive: {
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.sm,
  },
  sortTabText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sortTabTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  contactCard: {
    padding: spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactIcons: {
    flexDirection: 'row',
  },
  contactIcon: {
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  relationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  relationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  relationText: {
    ...typography.caption,
    marginRight: spacing.sm,
  },
  depthText: {
    ...typography.small,
    color: colors.textTertiary,
  },
  storySummary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeLabel: {
    ...typography.small,
    color: colors.textTertiary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyIcon: {
    fontSize: 64,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
});
