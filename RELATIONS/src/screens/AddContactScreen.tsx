import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useStore} from '../store';
import {colors, spacing, typography, borderRadius} from '../theme';
import {RootStackParamList} from '../navigation';
import {Card, Avatar, Button} from '../components/common';
import {Contact, RelationType, ParsedContact} from '../types';
import {
  startVoiceRecognition,
  stopVoiceRecognition,
  cancelVoiceRecognition,
  setVoiceRecognitionCallback,
  setVoiceStatusCallback,
  initializeVoiceService,
  VoiceRecognitionResult,
} from '../services/voice';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RELATION_OPTIONS: {key: RelationType; label: string}[] = [
  {key: 'friend', label: '朋友'},
  {key: 'family', label: '家人'},
  {key: 'colleague', label: '同事'},
  {key: 'lover', label: '恋人'},
  {key: 'teacher', label: '老师'},
  {key: 'client', label: '客户'},
  {key: 'neighbor', label: '邻居'},
  {key: 'other', label: '其他'},
];

export default function AddContactScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {addContact} = useStore();

  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedContact | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeVoiceService();

    setVoiceStatusCallback((status) => {
      console.log('[AddContact] Voice status:', status);
    });

    setVoiceRecognitionCallback((result, error) => {
      if (error) {
        console.error('[AddContact] Voice error:', error);
        Alert.alert('语音识别错误', error.message);
        setIsRecording(false);
        return;
      }

      if (result) {
        setVoiceText(result.text);
      }
    });

    return () => {
      cancelVoiceRecognition();
    };
  }, []);

  const startRecordingHandler = async () => {
    const success = await startVoiceRecognition();
    if (success) {
      setIsRecording(true);
      setVoiceText('');
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  };

  const stopRecordingHandler = async () => {
    setIsRecording(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    const result = await stopVoiceRecognition();
    if (result && result.text.trim()) {
      analyzeVoiceText(result.text);
    } else if (!voiceText.trim()) {
      Alert.alert('提示', '没有识别到语音内容，请重试或手动输入');
      setShowManualInput(true);
    }
  };

  const cancelRecordingHandler = async () => {
    setIsRecording(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setVoiceText('');
    await cancelVoiceRecognition();
  };

  const analyzeVoiceText = async (text: string) => {
    setIsAnalyzing(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockParsed: ParsedContact = {
      name: '张明',
      relationType: 'friend',
      relationLabel: '朋友',
      knownDate: '2018-06-20',
      knownChannel: '大学图书馆',
      keyEvents: ['帮忙找工作', '一起旅行'],
      relationDepth: 7,
    };

    setParsedData(mockParsed);
    setIsAnalyzing(false);
    setShowManualInput(true);
  };

  const handleManualInput = () => {
    setShowManualInput(true);
    setParsedData({
      name: '',
      relationType: 'friend',
      relationLabel: '朋友',
      keyEvents: [],
      relationDepth: 5,
    });
  };

  const handleSave = () => {
    if (!parsedData || !parsedData.name.trim()) {
      Alert.alert('提示', '请输入联系人姓名');
      return;
    }

    const contact: Contact = {
      id: Date.now().toString(),
      name: parsedData.name,
      avatar: undefined,
      relationType: parsedData.relationType,
      relationLabel: parsedData.relationLabel,
      relationDepth: parsedData.relationDepth,
      knownDate: parsedData.knownDate,
      knownChannel: parsedData.knownChannel,
      keyEvents: parsedData.keyEvents,
      customDates: [],
      interactionRecords: [],
      contactInfo: { phone: '', email: '', wechat: '' },
      storySummary: '',
      stories: [],
      lastContactDate: undefined,
      currentStatus: '',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addContact(contact);
    Alert.alert('成功', `已添加联系人 "${parsedData.name}"`, [
      {text: '确定', onPress: () => navigation.goBack()},
    ]);
  };

  const updateParsedData = (updates: Partial<ParsedContact>) => {
    setParsedData((prev) => (prev ? {...prev, ...updates} : null));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.voiceCard}>
          <Text style={styles.sectionTitle}>🎤 语音添加联系人</Text>
          <Text style={styles.sectionSubtitle}>
            描述一下这位联系人，例如："我的大学同学张明，我们在图书馆认识，关系很好"
          </Text>

          <View style={styles.voiceInputContainer}>
            {isRecording ? (
              <Animated.View
                style={[
                  styles.voiceCircle,
                  {transform: [{scale: pulseAnim}]},
                ]}>
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={stopRecordingHandler}>
                  <Text style={styles.stopBtnText}>按住说话</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={styles.recordBtn}
                onPress={startRecordingHandler}>
                <Text style={styles.recordIcon}>🎤</Text>
                <Text style={styles.recordBtnText}>开始说话</Text>
              </TouchableOpacity>
            )}

            {voiceText.length > 0 && (
              <View style={styles.voiceTextContainer}>
                <Text style={styles.voiceText}>{voiceText}</Text>
              </View>
            )}

            {isAnalyzing && (
              <View style={styles.analyzingContainer}>
                <Animated.View
                  style={[styles.dot, styles.dot1]}
                />
                <Animated.View
                  style={[styles.dot, styles.dot2]}
                />
                <Animated.View
                  style={[styles.dot, styles.dot3]}
                />
                <Text style={styles.analyzingText}>AI分析中...</Text>
              </View>
            )}
          </View>

          {isRecording && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={cancelRecordingHandler}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          )}
        </Card>

        <TouchableOpacity
          style={styles.manualToggle}
          onPress={handleManualInput}>
          <Text style={styles.manualToggleText}>
            {showManualInput ? '收起手动输入' : '手动输入联系人信息'}
          </Text>
        </TouchableOpacity>

        {showManualInput && parsedData && (
          <Card style={styles.formCard}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>姓名 *</Text>
              <TextInput
                style={styles.input}
                value={parsedData.name}
                onChangeText={(text) => updateParsedData({name: text})}
                placeholder="输入联系人姓名"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>关系</Text>
              <View style={styles.relationGrid}>
                {RELATION_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.relationChip,
                      parsedData.relationType === option.key &&
                        styles.relationChipActive,
                    ]}
                    onPress={() =>
                      updateParsedData({
                        relationType: option.key,
                        relationLabel: option.label,
                      })
                    }>
                    <Text
                      style={[
                        styles.relationChipText,
                        parsedData.relationType === option.key &&
                          styles.relationChipTextActive,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>认识时间</Text>
              <TextInput
                style={styles.input}
                value={parsedData.knownDate || ''}
                onChangeText={(text) =>
                  updateParsedData({knownDate: text})
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>认识渠道</Text>
              <TextInput
                style={styles.input}
                value={parsedData.knownChannel || ''}
                onChangeText={(text) =>
                  updateParsedData({knownChannel: text})
                }
                placeholder="例如: 大学社团、公司活动"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>关系深度</Text>
              <View style={styles.depthSelector}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.depthDot,
                      parsedData.relationDepth >= level &&
                        styles.depthDotActive,
                    ]}
                    onPress={() =>
                      updateParsedData({relationDepth: level})
                    }
                  />
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>关键事件</Text>
              <View style={styles.keyEventsContainer}>
                {parsedData.keyEvents.map((event, index) => (
                  <View key={index} style={styles.keyEventChip}>
                    <Text style={styles.keyEventText}>{event}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        updateParsedData({
                          keyEvents: parsedData.keyEvents.filter(
                            (_, i) => i !== index
                          ),
                        })
                      }>
                      <Text style={styles.removeEvent}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TextInput
                  style={styles.addEventInput}
                  placeholder="添加关键事件"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={(e) => {
                    const text = e.nativeEvent.text.trim();
                    if (text) {
                      updateParsedData({
                        keyEvents: [...parsedData.keyEvents, text],
                      });
                    }
                  }}
                />
              </View>
            </View>

            <Button
              title="保存联系人"
              onPress={handleSave}
              disabled={!parsedData.name.trim()}
            />
          </Card>
        )}
      </ScrollView>
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
    padding: spacing.lg,
  },
  voiceCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  voiceInputContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  recordBtn: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  recordIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  recordBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
  },
  voiceCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    alignItems: 'center',
  },
  stopBtnText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 16,
  },
  voiceTextContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  voiceText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: 2,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  analyzingText: {
    ...typography.caption,
    marginLeft: spacing.sm,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  manualToggle: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  manualToggleText: {
    color: colors.primary,
    fontSize: 14,
  },
  formCard: {
    backgroundColor: colors.surface,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  relationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  relationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  relationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  relationChipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  relationChipTextActive: {
    color: colors.surface,
    fontWeight: '500',
  },
  depthSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  depthDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  depthDotActive: {
    backgroundColor: colors.primary,
  },
  keyEventsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  keyEventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  keyEventText: {
    fontSize: 13,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  removeEvent: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  addEventInput: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    fontSize: 13,
    minWidth: 100,
  },
});