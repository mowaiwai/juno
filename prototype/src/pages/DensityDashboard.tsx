import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  orgApi,
  type DensityOut,
  type ClassificationSummary,
  type ImbalanceItem,
  type OptimizeAdviceOut,
} from '@/api/orgDiagnosis';
import { CHART } from '@/charts/palette';

const SHAPE_COLOR: Record<string, string> = {
  dumbbell: 'var(--danger)',
  diamond: 'var(--ochre)',
  pyramid: 'var(--teal)',
  healthy: 'var(--sage)',
};

const CATEGORY_COLOR: Record<string, string> = {
  core: '#52c41a',
  competent: '#1890ff',
  transformable: '#faad14',
  optimize: '#ff4d4f',
  unclassified: '#bfbfbf',
};

const CATEGORY_LABEL: Record<string, string> = {
  core: '核心',
  competent: '胜任',
  transformable: '可转型',
  optimize: '待优化',
  unclassified: '未分类',
};

const SEQ_LABEL: Record<string, string> = {
  SW: '软件序列',
  ENG: '机械序列',
  OP: '工艺序列',
  MGT: '管理序列',
  SAL: '营销序列',
  PUR: '采购序列',
  HR: 'HR 序列',
  OPS: '运维序列',
};

export function DensityDashboard() {
  const [density, setDensity] = useState<DensityOut | null>(null);
  const [summary, setSummary] = useState<ClassificationSummary | null>(null);
  const [imbalance, setImbalance] = useState<ImbalanceItem[]>([]);
  const [advice, setAdvice] = useState<OptimizeAdviceOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState('');
  const [advising, setAdvising] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      orgApi.density(),
      orgApi.classificationSummary(),
      orgApi.imbalance(),
    ])
      .then(([d, s, i]) => {
        setDensity(d);
        setSummary(s);
        setImbalance(i);
      })
      .catch(() => message.error('加载结构数据失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const getAdvice = () => {
    setAdvising(true);
    orgApi
      .optimizeAdvice({ focus: focus.trim() || undefined })
      .then(setAdvice)
      .catch(() => message.error('获取建议失败'))
      .finally(() => setAdvising(false));
  };

  // 四分类饼图
  const pieOption = summary
    ? {
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, textStyle: { color: CHART.ink2 } },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}\n{c}人 ({d}%)', color: CHART.ink2 },
            data: [
              { value: summary.core, name: CATEGORY_LABEL.core, itemStyle: { color: CATEGORY_COLOR.core } },
              { value: summary.competent, name: CATEGORY_LABEL.competent, itemStyle: { color: CATEGORY_COLOR.competent } },
              { value: summary.transformable, name: CATEGORY_LABEL.transformable, itemStyle: { color: CATEGORY_COLOR.transformable } },
              { value: summary.optimize, name: CATEGORY_LABEL.optimize, itemStyle: { color: CATEGORY_COLOR.optimize } },
              ...(summary.unclassified > 0 ? [{ value: summary.unclassified, name: CATEGORY_LABEL.unclassified, itemStyle: { color: CATEGORY_COLOR.unclassified } }] : []),
            ],
          },
        ],
      }
    : {};

  // 序列分布柱状图
  const seqOption = density
    ? {
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: 'category',
          data: Object.keys(density.sequence_dist).map((s) => SEQ_LABEL[s] || s),
          axisLabel: { color: CHART.ink2 },
        },
        yAxis: { type: 'value', axisLabel: { color: CHART.ink2 } },
        series: [
          {
            type: 'bar',
            data: Object.values(density.sequence_dist),
            itemStyle: { color: CHART.primary, borderRadius: [4, 4, 0, 0] },
            barWidth: 32,
          },
        ],
      }
    : {};

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">人才密度仪表盘</h1>
          <div className="page-subtitle">
            维度自动分类 · 密度指标 · 冗余/缺口识别 · AI 优化建议
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        {density && summary && (
          <>
            {/* 指标卡片 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总人数</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                    {density.total}
                  </div>
                </Card>
              </Col>
              <Col span={5}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>核心人才占比</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: CATEGORY_COLOR.core }}>
                    {Math.round(density.core_ratio * 100)}%
                  </div>
                </Card>
              </Col>
              <Col span={5}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>结构类型</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: SHAPE_COLOR[density.shape] }}>
                    {density.shape_label}
                  </div>
                </Card>
              </Col>
              <Col span={5}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>高潜人数（L1）</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--teal)' }}>
                    {density.high_potential}
                  </div>
                </Card>
              </Col>
              <Col span={5}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>风险人数（D）</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>
                    {density.risk_count}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 四分类 + 序列分布 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }} title="人才结构四分类">
                  <ReactECharts option={pieOption} style={{ height: 320 }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card variant="borderless" style={{ background: 'var(--surface)' }} title="序列分布">
                  <ReactECharts option={seqOption} style={{ height: 320 }} />
                </Card>
              </Col>
            </Row>

            {/* 冗余/缺口 + AI 建议 */}
            <Row gutter={16}>
              <Col span={12}>
                <Card
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title="冗余/缺口识别"
                  size="small"
                >
                  {imbalance.length === 0 ? (
                    <Alert
                      type="success"
                      showIcon
                      message="结构平衡"
                      description="当前各序列层级供需匹配，无显著冗余或缺口。"
                    />
                  ) : (
                    <Table
                      rowKey={(r) => `${r.sequence}-${r.level_order}-${r.type}`}
                      dataSource={imbalance}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: '类型',
                          dataIndex: 'type',
                          render: (t: string) => (
                            <Tag
                              color={t === 'shortage' ? 'red' : 'green'}
                              style={{ borderRadius: 6 }}
                            >
                              {t === 'shortage' ? '缺口' : '冗余'}
                            </Tag>
                          ),
                        },
                        { title: '明细', dataIndex: 'detail' },
                      ]}
                    />
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  variant="borderless"
                  style={{ background: 'var(--surface)' }}
                  title="AI 结构优化建议"
                  size="small"
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      icon={<BulbOutlined />}
                      loading={advising}
                      onClick={getAdvice}
                    >
                      生成建议
                    </Button>
                  }
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="输入管理者关注点（如：研发序列扩张、成本优化等），AI 将据此调整建议方向"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    style={{ marginBottom: 12 }}
                  />
                  {advice ? (
                    <Alert
                      type="info"
                      showIcon
                      message={
                        <span>
                          {advice.source === 'ai_generated' ? 'AI 生成建议' : '规则建议'}
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 8 }}>
                            {new Date(advice.generated_at).toLocaleString()}
                          </span>
                        </span>
                      }
                      description={advice.advice}
                    />
                  ) : (
                    <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '16px 0' }}>
                      点击「生成建议」获取基于当前人才结构的 AI 优化建议。
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}
