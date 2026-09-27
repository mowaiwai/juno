import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {RootStackParamList} from '../navigation';
import {Card, Button, Avatar} from '../components/common';
import {generateOnThisDayStory, OnThisDayStoryParams} from '../services/doubao';
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

export default function OnThisDayScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {contacts} = useStore();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);

  useEffect(() => {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const contactsWithLastContact = contacts.filter((c) => {
      if (!c.lastContactDate) return false;
      const lastContact = new Date(c.lastContactDate);
      return (
        lastContact.getMonth() === oneYearAgo.getMonth() &&
        lastContact.getDate() === oneYearAgo.getDate()
      );
    });

    if (contactsWithLastContact.length > 0) {
      setSelectedContact(contactsWithLastContact[0]);
    } else if (contacts.length > 0) {
      const recentContact = [...contacts].sort((a, b) => {
        const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
        const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
        return dateB - dateA;
      })[0];
      setSelectedContact(recentContact);
    }
  }, [contacts]);

  const handleGenerateStory = async () => {
    if (!selectedContact) {
      Alert.alert('提示', '请先选择一位联系人');
      return;
    }

    setIsGenerating(true);
    setGeneratedStory('');

    try {
      const lastContactDate = selectedContact.lastContactDate
        ? new Date(selectedContact.lastContactDate)
        : new Date();
      const today = new Date();
      const daysSinceLastContact = Math.floor(
        (today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const params: OnThisDayStoryParams = {
        contactName: selectedContact.name,
        contactRelation: RELATION_LABELS[selectedContact.relationType] || selectedContact.relationType,
        relationDepth: selectedContact.relationDepth,
        interactionRecords: selectedContact.interactionRecords
          .filter((r) => r.description)
          .map((r) => ({
            type: r.type,
            description: r.description || '',
            date: r.date,
          })),
        stories: selectedContact.stories.map((s) => ({
          title: s.title,
          content: s.content,
          storyDate: s.storyDate,
        })),
        daysSinceLastContact,
      };

      const story = await generateOnThisDayStory(params);
      setGeneratedStory(story);
    } catch (error) {
      console.error('生成故事失败:', error);
      Alert.alert('生成失败', '抱歉，故事生成失败了，请稍后再试。');
      setGeneratedStory(getMockStory(selectedContact));
    } finally {
      setIsGenerating(false);
    }
  };

  const getMockStory = (contact: Contact): string => {
    return `【${contact.name}的故事】

那是去年今天的下午，阳光正好穿过咖啡店的落地窗，在桌面上投下温暖的光斑。

"${contact.name}"坐在我对面，手中的拿铁还冒着热气。我们聊起了大学时代的那些日子，那些曾经以为会很漫长、却转瞬即逝的岁月。

"你还记得那次社团活动吗？"他笑着问，眼中闪烁着回忆的光芒。

怎么可能忘记。那是一次意外让我们成为了朋友——我在图书馆找资料时不小心拿错了书，而那本书恰好是他正在苦苦寻觅的。

从那以后，我们的关系就像那本书一样，在彼此的生命中占据了特殊的位置。

如今，每当我看到咖啡，都会想起那个下午，想起那些轻松愉快的对话，想起那份珍贵的友谊。

"去年今日"，我们也是这样坐在一起，谈天说地。而今年今日，虽然忙碌让我们聚少离多，但那份情谊始终未变。

也许这就是友谊最美好的样子——不需要天天相见，却始终在心里为彼此留着一个位置。`;
  };

  const handleSaveStory = () => {
    if (!generatedStory || !selectedContact) return;

    const {addStory} = useStore.getState();
    const story = {
      id: Date.now().toString(),
      title: `去年今日 - ${selectedContact.name}`,
      content: generatedStory,
      images: [],
      storyDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addStory(selectedContact.id, story);
    Alert.alert('保存成功', '故事已保存到联系人档案中', [
      {text: '确定', onPress: () => navigation.goBack()},
    ]);
  };

  const contactsWithHistory = contacts
    .filter((c) => c.interactionRecords.length > 0 || c.stories.length > 0)
    .sort((a, b) => {
      const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
      const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>去年今日</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.introCard}>
          <Text style={styles.introTitle}>📖 回忆的力量</Text>
          <Text style={styles.introText}>
            每段关系都值得被记录。每次相遇都是独特的故事。
            让我们一起重温那些美好的时光，续写你们之间的故事。
          </Text>
        </Card>

        <Card style={styles.selectorCard}>
          <Text style={styles.sectionTitle}>选择一位联系人</Text>
          <TouchableOpacity
            style={styles.contactSelector}
            onPress={() => setShowContactPicker(!showContactPicker)}>
            {selectedContact ? (
              <View style={styles.selectedContact}>
                <Avatar
                  name={selectedContact.name}
                  avatar={selectedContact.avatar}
                  relationType={selectedContact.relationType}
                  size="md"
                />
                <View style={styles.selectedContactInfo}>
                  <Text style={styles.selectedContactName}>{selectedContact.name}</Text>
                  <Text style={styles.selectedContactRelation}>
                    {RELATION_LABELS[selectedContact.relationType]}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.selectPlaceholder}>点击选择联系人</Text>
            )}
            <Text style={styles.selectorArrow}>{showContactPicker ? '∧' : '∨'}</Text>
          </TouchableOpacity>

          {showContactPicker && (
            <View style={styles.contactList}>
              {contactsWithHistory.length === 0 ? (
                <Text style={styles.noContactsText}>
                  还没有互动记录，先去和联系人互动吧
                </Text>
              ) : (
                contactsWithHistory.slice(0, 5).map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[
                      styles.contactItem,
                      selectedContact?.id === contact.id && styles.contactItemActive,
                    ]}
                    onPress={() => {
                      setSelectedContact(contact);
                      setShowContactPicker(false);
                    }}>
                    <Avatar
                      name={contact.name}
                      avatar={contact.avatar}
                      relationType={contact.relationType}
                      size="sm"
                    />
                    <View style={styles.contactItemInfo}>
                      <Text style={styles.contactItemName}>{contact.name}</Text>
                      <Text style={styles.contactItemMeta}>
                        {contact.interactionRecords.length} 次互动 · {contact.stories.length} 个故事
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </Card>

        {selectedContact && (
          <Card style={styles.statsCard}>
            <Text style={styles.sectionTitle}>📊 关系档案</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedContact.relationDepth}</Text>
                <Text style={styles.statLabel}>关系深度</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedContact.interactionRecords.length}</Text>
                <Text style={styles.statLabel}>互动记录</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedContact.stories.length}</Text>
                <Text style={styles.statLabel}>故事数量</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {selectedContact.lastContactDate
                    ? Math.floor(
                        (Date.now() - new Date(selectedContact.lastContactDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : '?'}
                </Text>
                <Text style={styles.statLabel}>天前联系</Text>
              </View>
            </View>
          </Card>
        )}

        <Button
          title={isGenerating ? '生成中...' : '✨ 生成去年今日故事'}
          onPress={handleGenerateStory}
          disabled={isGenerating || !selectedContact}
          style={styles.generateBtn}
        />

        {isGenerating && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>正在用AI撰写你们的故事...</Text>
          </View>
        )}

        {generatedStory ? (
          <Card style={styles.storyCard}>
            <Text style={styles.storyHeader}>📖 {selectedContact?.name}的故事</Text>
            <Text style={styles.storyContent}>{generatedStory}</Text>
            <View style={styles.storyActions}>
              <Button
                title="💾 保存到档案"
                onPress={handleSaveStory}
                style={styles.saveBtn}
              />
              <Button
                title="📝 继续编辑"
                variant="outline"
                onPress={() => {
                  navigation.navigate('ContactDetail', {contactId: selectedContact!.id});
                }}
                style={styles.editBtn}
              />
            </View>
          </Card>
        ) : null}

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💡 小贴士</Text>
          <Text style={styles.tipText}>
            故事生成需要使用豆包API，请确保已配置有效的API Key。
          </Text>
          <Text style={styles.tipText}>
            生成的AI故事仅供参考，你可以继续编辑或保存到联系人档案中。
          </Text>
        </View>

        <View style={styles.bottomPadding} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '500',
  },
  headerTitle: {
    ...typography.h3,
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  introCard: {
    backgroundColor: colors.primary + '10',
    marginBottom: spacing.md,
  },
  introTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  introText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  selectorCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  contactSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  selectedContact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedContactInfo: {
    marginLeft: spacing.md,
  },
  selectedContactName: {
    ...typography.body,
    fontWeight: '600',
  },
  selectedContactRelation: {
    ...typography.caption,
  },
  selectPlaceholder: {
    ...typography.body,
    color: colors.textTertiary,
  },
  selectorArrow: {
    fontSize: 16,
    color: colors.textTertiary,
  },
  contactList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  contactItemActive: {
    backgroundColor: colors.primary + '15',
  },
  contactItemInfo: {
    marginLeft: spacing.sm,
  },
  contactItemName: {
    ...typography.body,
  },
  contactItemMeta: {
    ...typography.small,
    color: colors.textTertiary,
  },
  noContactsText: {
    ...typography.caption,
    textAlign: 'center',
    padding: spacing.md,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  generateBtn: {
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  storyCard: {
    marginBottom: spacing.md,
  },
  storyHeader: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  storyContent: {
    ...typography.body,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  storyActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  saveBtn: {
    flex: 1,
  },
  editBtn: {
    flex: 1,
  },
  tips: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  tipsTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
});