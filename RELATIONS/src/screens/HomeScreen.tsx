import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Svg, {Circle, Line, Text as SvgText, G} from 'react-native-svg';
import {useStore} from '../store';
import {colors, spacing, typography} from '../theme';
import {RootStackParamList} from '../navigation';
import {Avatar, Card, Button} from '../components/common';
import {Contact, TimeViewMode, PREDICTION_SCENARIOS} from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const NETWORK_SIZE = SCREEN_WIDTH - spacing.lg * 2;
const CENTER_X = NETWORK_SIZE / 2;
const CENTER_Y = NETWORK_SIZE / 2;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {
    contacts,
    currentViewContactId,
    setCurrentViewContactId,
    timeViewMode,
    setTimeViewMode,
    timeTravelDate,
    setTimeTravelDate,
    futureYears,
    setFutureYears,
    getContactsAtTime,
  } = useStore();

  const [scale, setScale] = useState(1);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showFutureModal, setShowFutureModal] = useState(false);
  const [pastYear, setPastYear] = useState('2020');
  const [pastMonth, setPastMonth] = useState('1');
  const [futurePlan, setFuturePlan] = useState('');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);

  const getDisplayContacts = useCallback(() => {
    if (timeViewMode === 'past' && timeTravelDate) {
      return getContactsAtTime(timeTravelDate);
    }
    if (timeViewMode === 'future') {
      return contacts.map((c) => ({
        ...c,
        relationDepth: Math.min(10, c.relationDepth + (futureYears * 0.5)),
      }));
    }
    return contacts;
  }, [contacts, timeViewMode, timeTravelDate, futureYears, getContactsAtTime]);

  const getCurrentViewContact = useCallback(() => {
    if (currentViewContactId) {
      return contacts.find((c) => c.id === currentViewContactId);
    }
    return null;
  }, [contacts, currentViewContactId]);

  const currentViewContact = getCurrentViewContact();
  const displayContacts = getDisplayContacts();

  const getNodePosition = (
    index: number,
    total: number,
    isCenter: boolean = false
  ) => {
    if (isCenter) {
      return {x: CENTER_X, y: CENTER_Y, size: 60};
    }

    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    const radius = 120 * scale;
    const size = 40 + Math.random() * 10;

    return {
      x: CENTER_X + radius * Math.cos(angle),
      y: CENTER_Y + radius * Math.sin(angle),
      size,
    };
  };

  const handleNodePress = (contact: Contact) => {
    if (currentViewContactId === contact.id) {
      setCurrentViewContactId(null);
    } else {
      setCurrentViewContactId(contact.id);
    }
  };

  const handleTimeTravel = () => {
    const dateStr = `${pastYear}-${pastMonth.padStart(2, '0')}-01`;
    setTimeTravelDate(dateStr);
    setTimeViewMode('past');
    setShowTimeModal(false);
  };

  const handlePredictFuture = () => {
    setTimeViewMode('future');
    setShowFutureModal(false);
  };

  const handleResetToPresent = () => {
    setTimeViewMode('present');
    setTimeTravelDate(null);
    setCurrentViewContactId(null);
  };

  const renderNetwork = () => {
    if (displayContacts.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>◎</Text>
          <Text style={styles.emptyTitle}>
            {timeViewMode === 'past' ? '该时期还没有联系人' : '还没有联系人'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {timeViewMode === 'past'
              ? '选择更早的时间查看'
              : '点击右下角添加第一位联系人'}
          </Text>
        </View>
      );
    }

    const showContacts = currentViewContactId
      ? displayContacts.filter((c) => c.id !== currentViewContactId)
      : displayContacts.slice(0, 8);
    const centerContact = currentViewContactId
      ? displayContacts.find((c) => c.id === currentViewContactId)
      : null;

    return (
      <Svg width={NETWORK_SIZE} height={NETWORK_SIZE}>
        <G>
          {showContacts.map((contact, index) => {
            const pos = getNodePosition(index, showContacts.length);
            const relationColor = colors.relation[contact.relationType];
            const displayDepth =
              timeViewMode === 'future'
                ? Math.min(10, contact.relationDepth + futureYears * 0.5)
                : contact.relationDepth;
            const nodeSize = 30 + displayDepth * 2;

            return (
              <G key={contact.id}>
                {centerContact && (
                  <Line
                    x1={CENTER_X}
                    y1={CENTER_Y}
                    x2={pos.x}
                    y2={pos.y}
                    stroke={relationColor}
                    strokeWidth={2}
                    strokeOpacity={0.3}
                  />
                )}
                <Circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeSize / 2}
                  fill={relationColor}
                  opacity={0.9}
                  onPress={() => handleNodePress(contact)}
                />
                <SvgText
                  x={pos.x}
                  y={pos.y + nodeSize / 2 + 14}
                  fontSize={11}
                  fill={colors.textSecondary}
                  textAnchor="middle">
                  {contact.name.length > 4
                    ? contact.name.slice(0, 4) + '...'
                    : contact.name}
                </SvgText>
              </G>
            );
          })}

          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={30}
            fill={currentViewContactId ? colors.secondary : colors.primary}
            onPress={() => setCurrentViewContactId(null)}
          />
          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 5}
            fontSize={14}
            fill={colors.surface}
            textAnchor="middle"
            fontWeight="600">
            {currentViewContactId ? '你' : '我'}
          </SvgText>
        </G>
      </Svg>
    );
  };

  const getTimeModeLabel = () => {
    switch (timeViewMode) {
      case 'past':
        return `⏪ ${pastYear}年${pastMonth}月`;
      case 'future':
        return `⏩ ${futureYears}年后`;
      default:
        return '现在';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>RELATIONS</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.timeTravelBtn}
            onPress={() => setShowTimeModal(true)}>
            <Text style={styles.timeTravelIcon}>⏪</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.timeTravelBtn}
            onPress={() => setShowFutureModal(true)}>
            <Text style={styles.timeTravelIcon}>🔮</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationBtn}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {timeViewMode !== 'present' && (
        <TouchableOpacity
          style={styles.modeBanner}
          onPress={handleResetToPresent}>
          <Text style={styles.modeBannerText}>
            {timeViewMode === 'past' ? '📅 时间倒退模式' : '🔮 未来预测模式'}
          </Text>
          <Text style={styles.modeBannerSubtext}>
            {getTimeModeLabel()} · 点击返回现在
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.networkCard} padding="md">
          <View style={styles.networkHeader}>
            <Text style={styles.networkTitle}>人际关系网络</Text>
            <View style={styles.timeModeTag}>
              <Text style={styles.timeModeTagText}>{getTimeModeLabel()}</Text>
            </View>
          </View>

          <View style={styles.networkContainer}>{renderNetwork()}</View>

          {currentViewContact && (
            <View style={styles.viewSwitchBanner}>
              <Avatar
                name={currentViewContact.name}
                relationType={currentViewContact.relationType}
                size="sm"
              />
              <Text style={styles.viewSwitchText}>
                以 {currentViewContact.name} 的视角查看
              </Text>
              <TouchableOpacity
                onPress={() => setCurrentViewContactId(null)}
                style={styles.resetViewBtn}>
                <Text style={styles.resetViewText}>重置</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {timeViewMode === 'future' && (
          <Card style={styles.predictionCard}>
            <Text style={styles.predictionTitle}>🔮 预测分析</Text>
            <View style={styles.predictionStats}>
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>关系平均深度</Text>
                <Text style={styles.predictionValue}>
                  {(
                    displayContacts.reduce((sum, c) => sum + c.relationDepth, 0) /
                    displayContacts.length
                  ).toFixed(1)}
                </Text>
              </View>
              <View style={styles.predictionItem}>
                <Text style={styles.predictionLabel}>预计新增联系人</Text>
                <Text style={styles.predictionValue}>
                  ~{Math.floor(futureYears * 2.5)}
                </Text>
              </View>
            </View>
            {futurePlan ? (
              <View style={styles.planContainer}>
                <Text style={styles.planLabel}>发展计划:</Text>
                <Text style={styles.planText}>{futurePlan}</Text>
              </View>
            ) : null}
          </Card>
        )}

        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{displayContacts.length}</Text>
            <Text style={styles.statLabel}>联系人</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {displayContacts.filter((c) => c.relationType === 'friend').length}
            </Text>
            <Text style={styles.statLabel}>朋友</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {
                new Set(
                  displayContacts
                    .filter((c) => c.knownDate)
                    .map((c) => c.knownDate?.split('-')[0])
                ).size
              }
            </Text>
            <Text style={styles.statLabel}>认识年份</Text>
          </Card>
        </View>

        <TouchableOpacity
          style={styles.onThisDayCard}
          onPress={() => navigation.navigate('OnThisDay')}
          activeOpacity={0.8}>
          <View style={styles.onThisDayContent}>
            <Text style={styles.onThisDayIcon}>📖</Text>
            <View style={styles.onThisDayText}>
              <Text style={styles.onThisDayTitle}>去年今日</Text>
              <Text style={styles.onThisDaySubtitle}>重温与联系人的美好回忆</Text>
            </View>
          </View>
          <Text style={styles.onThisDayArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddContact')}
        activeOpacity={0.9}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={showTimeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⏪ 时间倒退</Text>
            <Text style={styles.modalSubtitle}>
              选择一个过去的时间点，查看当时的人际关系
            </Text>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>年份</Text>
                <TextInput
                  style={styles.input}
                  value={pastYear}
                  onChangeText={setPastYear}
                  placeholder="2020"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>月份</Text>
                <TextInput
                  style={styles.input}
                  value={pastMonth}
                  onChangeText={setPastMonth}
                  placeholder="1"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="取消"
                variant="outline"
                onPress={() => setShowTimeModal(false)}
                style={styles.modalBtn}
              />
              <Button
                title="穿越"
                onPress={handleTimeTravel}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFutureModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFutureModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔮 预测未来</Text>
            <Text style={styles.modalSubtitle}>
              选择时间跨度，预测未来人际关系变化
            </Text>

            <View style={styles.yearSelector}>
              {[1, 3, 5].map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearBtn,
                    futureYears === year && styles.yearBtnActive,
                  ]}
                  onPress={() => setFutureYears(year)}>
                  <Text
                    style={[
                      styles.yearBtnText,
                      futureYears === year && styles.yearBtnTextActive,
                    ]}>
                    {year}年
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.scenarioLabel}>或选择预设剧本:</Text>
            <View style={styles.scenarioGrid}>
              {PREDICTION_SCENARIOS.map((scenario) => (
                <TouchableOpacity
                  key={scenario.id}
                  style={[
                    styles.scenarioBtn,
                    selectedScenario === scenario.id && styles.scenarioBtnActive,
                  ]}
                  onPress={() => setSelectedScenario(scenario.id)}>
                  <Text style={styles.scenarioIcon}>{scenario.icon}</Text>
                  <Text style={styles.scenarioName}>{scenario.name}</Text>
                  <Text style={styles.scenarioDesc}>{scenario.description}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>自定义发展计划 (可选)</Text>
            <TextInput
              style={[styles.input, styles.planInput]}
              value={futurePlan}
              onChangeText={setFuturePlan}
              placeholder="描述你的关系发展计划..."
              multiline
            />

            <View style={styles.modalActions}>
              <Button
                title="取消"
                variant="outline"
                onPress={() => setShowFutureModal(false)}
                style={styles.modalBtn}
              />
              <Button
                title="预测"
                onPress={handlePredictFuture}
                style={styles.modalBtn}
              />
            </View>
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
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeTravelBtn: {
    padding: spacing.sm,
  },
  timeTravelIcon: {
    fontSize: 20,
  },
  notificationBtn: {
    padding: spacing.sm,
  },
  notificationIcon: {
    fontSize: 20,
  },
  modeBanner: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  modeBannerText: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  modeBannerSubtext: {
    color: colors.surface,
    opacity: 0.8,
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  networkCard: {
    marginBottom: spacing.lg,
  },
  networkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  networkTitle: {
    ...typography.h3,
  },
  timeModeTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  timeModeTagText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  networkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: NETWORK_SIZE,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: NETWORK_SIZE * 0.6,
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
  viewSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
  },
  viewSwitchText: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.sm,
  },
  resetViewBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  resetViewText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  predictionCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.secondary + '10',
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  predictionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  predictionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  predictionItem: {
    alignItems: 'center',
  },
  predictionLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  predictionValue: {
    ...typography.h2,
    color: colors.secondary,
  },
  planContainer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  planLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  planText: {
    ...typography.body,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statNumber: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: colors.surface,
    fontWeight: '300',
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
  },
  modalTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
  },
  yearSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  yearBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearBtnText: {
    ...typography.body,
    fontWeight: '600',
  },
  yearBtnTextActive: {
    color: colors.surface,
  },
  scenarioLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  scenarioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scenarioBtn: {
    width: '48%',
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scenarioBtnActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '10',
  },
  scenarioIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  scenarioName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  scenarioDesc: {
    ...typography.small,
    color: colors.textSecondary,
  },
  onThisDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary + '10',
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  onThisDayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onThisDayIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  onThisDayText: {
    flex: 1,
  },
  onThisDayTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  onThisDaySubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  onThisDayArrow: {
    fontSize: 24,
    color: colors.primary,
  },
});
