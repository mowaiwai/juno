import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Modal,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {RootStackParamList} from '../navigation';
import {Card, Avatar, Button} from '../components/common';
import {CustomDate, Interaction, Story} from '../types';
import {shareStory} from '../services/share';

type RouteProps = RouteProp<RootStackParamList, 'ContactDetail'>;
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

const MAX_IMAGES = 7;

export default function ContactDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const {contactId} = route.params;
  const {contacts, updateContact, deleteContact, addCustomDate, deleteCustomDate, addInteraction, addStory, deleteStory} =
    useStore();

  const contact = contacts.find((c) => c.id === contactId);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(contact?.name || '');
  const [editedStatus, setEditedStatus] = useState(contact?.currentStatus || '');
  const [editedNotes, setEditedNotes] = useState(contact?.notes || '');
  const [editedStorySummary, setEditedStorySummary] = useState(contact?.storySummary || '');
  const [editedPhone, setEditedPhone] = useState(contact?.contactInfo.phone || '');
  const [editedEmail, setEditedEmail] = useState(contact?.contactInfo.email || '');
  const [editedWechat, setEditedWechat] = useState(contact?.contactInfo.wechat || '');
  const [showAddDate, setShowAddDate] = useState(false);
  const [newDateLabel, setNewDateLabel] = useState('');
  const [newDateValue, setNewDateValue] = useState('');
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [newInteractionType, setNewInteractionType] = useState<Interaction['type']>('meet');
  const [newInteractionDesc, setNewInteractionDesc] = useState('');
  const [showAddStory, setShowAddStory] = useState(false);
  const [showStoryDetail, setShowStoryDetail] = useState<Story | null>(null);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryContent, setNewStoryContent] = useState('');
  const [newStoryImages, setNewStoryImages] = useState<string[]>([]);
  const [newStoryDate, setNewStoryDate] = useState('');

  if (!contact) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>联系人不存在</Text>
      </View>
    );
  }

  const handleSave = () => {
    updateContact(contactId, {
      name: editedName,
      currentStatus: editedStatus,
      notes: editedNotes,
      storySummary: editedStorySummary,
      contactInfo: {
        phone: editedPhone,
        email: editedEmail,
        wechat: editedWechat,
      },
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert('确认删除', `确定要删除联系人"${contact.name}"吗？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          deleteContact(contactId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleAddDate = () => {
    if (!newDateLabel || !newDateValue) return;

    const customDate: CustomDate = {
      id: Date.now().toString(),
      type: 'custom',
      label: newDateLabel,
      date: newDateValue,
      remindDays: [1, 3],
    };

    addCustomDate(contactId, customDate);
    setNewDateLabel('');
    setNewDateValue('');
    setShowAddDate(false);
  };

  const handleAddInteraction = () => {
    if (!newInteractionDesc) return;

    const interaction: Interaction = {
      id: Date.now().toString(),
      contactId,
      type: newInteractionType,
      date: new Date().toISOString(),
      description: newInteractionDesc,
    };

    addInteraction(contactId, interaction);
    setNewInteractionDesc('');
    setShowAddInteraction(false);
  };

  const handleAddStory = () => {
    if (!newStoryContent.trim()) {
      Alert.alert('提示', '请输入故事内容');
      return;
    }

    const story: Story = {
      id: Date.now().toString(),
      title: newStoryTitle || '我们的故事',
      content: newStoryContent,
      images: newStoryImages,
      storyDate: newStoryDate || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addStory(contactId, story);
    setNewStoryTitle('');
    setNewStoryContent('');
    setNewStoryImages([]);
    setNewStoryDate('');
    setShowAddStory(false);
  };

  const handleDeleteStory = (storyId: string) => {
    Alert.alert('确认删除', '确定要删除这个故事吗？', [
      {text: '取消', style: 'cancel'},
      {
        text: '删除',
        style: 'destructive',
        onPress: () => deleteStory(contactId, storyId),
      },
    ]);
  };

  const handleAddDemoImage = () => {
    if (newStoryImages.length >= MAX_IMAGES) {
      Alert.alert('提示', `最多只能上传${MAX_IMAGES}张图片`);
      return;
    }
    const demoImages = [
      'https://picsum.photos/200/200?random=1',
      'https://picsum.photos/200/200?random=2',
      'https://picsum.photos/200/200?random=3',
    ];
    const randomDemo = demoImages[Math.floor(Math.random() * demoImages.length)];
    setNewStoryImages([...newStoryImages, randomDemo]);
  };

  const handleRemoveImage = (index: number) => {
    const updated = [...newStoryImages];
    updated.splice(index, 1);
    setNewStoryImages(updated);
  };

  const getRelationDepthColor = (depth: number) => {
    if (depth >= 7) return colors.success;
    if (depth >= 4) return colors.warning;
    return colors.error;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <Avatar
            name={contact.name}
            avatar={contact.avatar}
            relationType={contact.relationType}
            size="xl"
          />
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="姓名"
            />
          ) : (
            <Text style={styles.name}>{contact.name}</Text>
          )}
          <Text style={styles.relation}>
            {RELATION_LABELS[contact.relationType]} · 关系深度 {contact.relationDepth}/10
          </Text>

          <View style={styles.depthBar}>
            <View
              style={[
                styles.depthFill,
                {
                  width: `${contact.relationDepth * 10}%`,
                  backgroundColor: getRelationDepthColor(contact.relationDepth),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.actionText}>拨打电话</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>发送消息</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionText}>安排见面</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionText}>{isEditing ? '取消' : '编辑'}</Text>
          </TouchableOpacity>
        </View>

        {isEditing && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📝 联系方式</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>📱 电话</Text>
              <TextInput
                style={styles.input}
                value={editedPhone}
                onChangeText={setEditedPhone}
                placeholder="手机号码"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>📧 邮箱</Text>
              <TextInput
                style={styles.input}
                value={editedEmail}
                onChangeText={setEditedEmail}
                placeholder="邮箱地址"
                keyboardType="email-address"
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>💬 微信</Text>
              <TextInput
                style={styles.input}
                value={editedWechat}
                onChangeText={setEditedWechat}
                placeholder="微信号"
              />
            </View>
          </Card>
        )}

        {!isEditing && (contact.contactInfo.phone || contact.contactInfo.email || contact.contactInfo.wechat) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>📱 联系方式</Text>
            <View style={styles.contactInfoRow}>
              {contact.contactInfo.phone && (
                <View style={styles.contactInfoItem}>
                  <Text style={styles.contactInfoIcon}>📱</Text>
                  <Text style={styles.contactInfoText}>{contact.contactInfo.phone}</Text>
                </View>
              )}
              {contact.contactInfo.email && (
                <View style={styles.contactInfoItem}>
                  <Text style={styles.contactInfoIcon}>📧</Text>
                  <Text style={styles.contactInfoText}>{contact.contactInfo.email}</Text>
                </View>
              )}
              {contact.contactInfo.wechat && (
                <View style={styles.contactInfoItem}>
                  <Text style={styles.contactInfoIcon}>💬</Text>
                  <Text style={styles.contactInfoText}>{contact.contactInfo.wechat}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📖 故事总结</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.storySummaryInput]}
              value={editedStorySummary}
              onChangeText={setEditedStorySummary}
              placeholder="用一句话描述你们的关系..."
              multiline
            />
          ) : (
            <Text style={styles.storySummaryText}>
              {contact.storySummary || '暂无故事总结'}
            </Text>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📚 我们的故事</Text>
            <TouchableOpacity onPress={() => setShowAddStory(true)}>
              <Text style={styles.addLink}>+ 写故事</Text>
            </TouchableOpacity>
          </View>

          {contact.stories.length === 0 ? (
            <Text style={styles.emptyText}>还没有故事，记录你们的回忆吧</Text>
          ) : (
            contact.stories
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((story) => (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyItem}
                  onPress={() => setShowStoryDetail(story)}>
                  <View style={styles.storyHeader}>
                    <Text style={styles.storyTitle}>{story.title}</Text>
                    {story.storyDate && (
                      <Text style={styles.storyDate}>{formatDate(story.storyDate)}</Text>
                    )}
                  </View>
                  <Text style={styles.storyPreview} numberOfLines={2}>
                    {story.content}
                  </Text>
                  {story.images.length > 0 && (
                    <View style={styles.storyImagesPreview}>
                      {story.images.slice(0, 3).map((img, idx) => (
                        <Image key={idx} source={{uri: img}} style={styles.storyThumbnail} />
                      ))}
                      {story.images.length > 3 && (
                        <View style={styles.moreImages}>
                          <Text style={styles.moreImagesText}>+{story.images.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 重要日期</Text>
            <TouchableOpacity onPress={() => setShowAddDate(!showAddDate)}>
              <Text style={styles.addLink}>+ 添加</Text>
            </TouchableOpacity>
          </View>

          {showAddDate && (
            <View style={styles.addForm}>
              <TextInput
                style={styles.input}
                placeholder="日期名称 (如: 生日)"
                value={newDateLabel}
                onChangeText={setNewDateLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="日期 (MM-DD)"
                value={newDateValue}
                onChangeText={setNewDateValue}
              />
              <Button title="保存" onPress={handleAddDate} />
            </View>
          )}

          {contact.customDates.length === 0 ? (
            <Text style={styles.emptyText}>还没有设置重要日期</Text>
          ) : (
            contact.customDates.map((date) => (
              <View key={date.id} style={styles.dateRow}>
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>{date.label}</Text>
                  <Text style={styles.dateValue}>{date.date}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteCustomDate(contactId, date.id)}>
                  <Text style={styles.deleteLink}>删除</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 关系档案</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>认识渠道</Text>
            <Text style={styles.fieldValue}>{contact.knownChannel || '未设置'}</Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>认识时间</Text>
            <Text style={styles.fieldValue}>
              {contact.knownDate
                ? formatDate(contact.knownDate)
                : '未设置'}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>当前状态</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.inlineInput]}
                value={editedStatus}
                onChangeText={setEditedStatus}
                placeholder="当前状态"
              />
            ) : (
              <Text style={styles.fieldValue}>{contact.currentStatus || '未设置'}</Text>
            )}
          </View>

          {contact.keyEvents.length > 0 && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>关键事件</Text>
              <View style={styles.tagsContainer}>
                {contact.keyEvents.map((event, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{event}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>备注</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="添加备注..."
                multiline
              />
            ) : (
              <Text style={styles.fieldValue}>{contact.notes || '暂无备注'}</Text>
            )}
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🤝 互动记录</Text>
            <TouchableOpacity onPress={() => setShowAddInteraction(!showAddInteraction)}>
              <Text style={styles.addLink}>+ 记录</Text>
            </TouchableOpacity>
          </View>

          {showAddInteraction && (
            <View style={styles.addForm}>
              <View style={styles.typeSelector}>
                {(['meet', 'call', 'message', 'gift'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeBtn,
                      newInteractionType === type && styles.typeBtnActive,
                    ]}
                    onPress={() => setNewInteractionType(type)}>
                    <Text
                      style={[
                        styles.typeBtnText,
                        newInteractionType === type && styles.typeBtnTextActive,
                      ]}>
                      {type === 'meet' ? '见面' : type === 'call' ? '通话' : type === 'message' ? '消息' : '礼物'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="描述这次互动..."
                value={newInteractionDesc}
                onChangeText={setNewInteractionDesc}
              />
              <Button title="保存记录" onPress={handleAddInteraction} />
            </View>
          )}

          {contact.interactionRecords.length === 0 ? (
            <Text style={styles.emptyText}>还没有互动记录</Text>
          ) : (
            contact.interactionRecords
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((record) => (
                <View key={record.id} style={styles.recordRow}>
                  <View style={styles.recordIcon}>
                    <Text>
                      {record.type === 'meet'
                        ? '🤝'
                        : record.type === 'call'
                        ? '📞'
                        : record.type === 'message'
                        ? '💬'
                        : '🎁'}
                    </Text>
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordDesc}>{record.description}</Text>
                    <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                  </View>
                </View>
              ))
          )}
        </Card>

        {isEditing && (
          <View style={styles.editActions}>
            <Button title="保存修改" onPress={handleSave} />
            <Button
              title="删除联系人"
              variant="outline"
              onPress={handleDelete}
              style={styles.deleteBtn}
              textStyle={styles.deleteBtnText}
            />
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={showAddStory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddStory(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✍️ 写故事</Text>

            <TextInput
              style={styles.input}
              placeholder="故事标题 (可选)"
              value={newStoryTitle}
              onChangeText={setNewStoryTitle}
            />

            <TextInput
              style={[styles.input, styles.storyContentInput]}
              placeholder="写下你们的故事..."
              value={newStoryContent}
              onChangeText={setNewStoryContent}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="故事发生日期 (YYYY-MM-DD，可选)"
              value={newStoryDate}
              onChangeText={setNewStoryDate}
            />

            <View style={styles.imagesSection}>
              <View style={styles.imagesSectionHeader}>
                <Text style={styles.imagesSectionTitle}>
                  📷 图片 (最多{MAX_IMAGES}张)
                </Text>
                <Text style={styles.imagesCount}>
                  {newStoryImages.length}/{MAX_IMAGES}
                </Text>
              </View>

              <View style={styles.imagesGrid}>
                {newStoryImages.map((img, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{uri: img}} style={styles.storyImage} />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => handleRemoveImage(index)}>
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {newStoryImages.length < MAX_IMAGES && (
                  <TouchableOpacity
                    style={styles.addImageBtn}
                    onPress={handleAddDemoImage}>
                    <Text style={styles.addImageText}>+ 添加图片</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="取消"
                variant="outline"
                onPress={() => setShowAddStory(false)}
                style={styles.modalBtn}
              />
              <Button
                title="保存"
                onPress={handleAddStory}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!showStoryDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStoryDetail(null)}>
        <View style={styles.storyModalOverlay}>
          <View style={styles.storyModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.closeStoryBtn}
                onPress={() => setShowStoryDetail(null)}>
                <Text style={styles.closeStoryText}>×</Text>
              </TouchableOpacity>

              {showStoryDetail && (
                <>
                  <Text style={styles.storyDetailTitle}>{showStoryDetail.title}</Text>
                  {showStoryDetail.storyDate && (
                    <Text style={styles.storyDetailDate}>
                      {formatDate(showStoryDetail.storyDate)}
                    </Text>
                  )}

                  {showStoryDetail.images.length > 0 && (
                    <ScrollView
                      horizontal
                      style={styles.storyDetailImages}
                      showsHorizontalScrollIndicator={false}>
                      {showStoryDetail.images.map((img, idx) => (
                        <Image
                          key={idx}
                          source={{uri: img}}
                          style={styles.storyDetailImage}
                        />
                      ))}
                    </ScrollView>
                  )}

                  <Text style={styles.storyDetailContent}>
                    {showStoryDetail.content}
                  </Text>

                  <View style={styles.storyDetailActions}>
                    <TouchableOpacity
                      style={styles.shareStoryBtn}
                      onPress={() => shareStory(showStoryDetail, contact)}>
                      <Text style={styles.shareStoryText}>📤 分享故事</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteStoryBtn}
                      onPress={() => {
                        handleDeleteStory(showStoryDetail.id);
                        setShowStoryDetail(null);
                      }}>
                      <Text style={styles.deleteStoryText}>删除故事</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 100,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
  },
  name: {
    ...typography.h2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  nameInput: {
    ...typography.h2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.xs,
    minWidth: 150,
  },
  relation: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  depthBar: {
    width: '60%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  depthFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionText: {
    ...typography.small,
  },
  section: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  addLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  contactInfoRow: {
    gap: spacing.sm,
  },
  contactInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  contactInfoIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  contactInfoText: {
    ...typography.body,
  },
  storySummaryText: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  storySummaryInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  storyItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  storyTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  storyDate: {
    ...typography.small,
    color: colors.textTertiary,
  },
  storyPreview: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  storyImagesPreview: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  storyThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  moreImages: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: {
    ...typography.caption,
    fontWeight: '600',
  },
  addForm: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    ...typography.body,
    marginBottom: 2,
  },
  dateValue: {
    ...typography.caption,
  },
  deleteLink: {
    color: colors.error,
    fontSize: 14,
  },
  fieldRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    ...typography.body,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.small,
    color: colors.primary,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recordIcon: {
    width: 40,
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
  },
  recordDesc: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  recordDate: {
    ...typography.small,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  typeBtnTextActive: {
    color: colors.surface,
    fontWeight: '500',
  },
  editActions: {
    padding: spacing.lg,
  },
  deleteBtn: {
    marginTop: spacing.md,
    borderColor: colors.error,
  },
  deleteBtnText: {
    color: colors.error,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  modalTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
  storyContentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagesSection: {
    marginTop: spacing.sm,
  },
  imagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  imagesSectionTitle: {
    ...typography.body,
    fontWeight: '500',
  },
  imagesCount: {
    ...typography.caption,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageWrapper: {
    position: 'relative',
  },
  storyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  storyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  storyModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  closeStoryBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeStoryText: {
    fontSize: 20,
    fontWeight: '600',
  },
  storyDetailTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
    paddingRight: 40,
  },
  storyDetailDate: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  storyDetailImages: {
    marginBottom: spacing.md,
  },
  storyDetailImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: spacing.sm,
  },
  storyDetailContent: {
    ...typography.body,
    lineHeight: 24,
  },
  deleteStoryBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteStoryText: {
    color: colors.error,
    fontSize: 16,
  },
  storyDetailActions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  shareStoryBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  shareStoryText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '500',
  },
});
