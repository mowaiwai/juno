import { useState } from 'react';
import { Card, Col, Row, Select, Space, Table, Tag } from 'antd';
import { learnMap, LEARN_TYPE_LABEL, MASTERY_LABEL } from '@/mock/gap';

const LEARN_TYPE_COLOR = { 1: 'var(--clay)', 2: 'var(--teal)', 3: 'var(--ochre)' };

export function LearnMap() {
  const positions = Array.from(new Set(learnMap.map((l) => l.position)));
  const [position, setPosition] = useState(positions[0]);
  const [grade, setGrade] = useState<string>('all');

  const grades = Array.from(new Set(learnMap.filter((l) => l.position === position).map((l) => l.grade)));
  const list = learnMap.filter((l) => l.position === position && (grade === 'all' || l.grade === grade));

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">学习地图</h1>
          <div className="page-subtitle">岗位×职级→学什么 · 知识四档（了解/掌握/熟练/精通）对应考试题型</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>当前岗位</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--clay)', marginTop: 2 }}>{position}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>课程总数</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)' }}>{list.length}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>必修课程</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ochre)' }}>{list.filter((l) => l.learnType === 1).length}</div>
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Select value={position} onChange={setPosition} style={{ width: 200 }} options={positions.map((p) => ({ value: p, label: p }))} />
        <Select
          value={grade}
          onChange={setGrade}
          style={{ width: 160 }}
          options={[{ value: 'all', label: '全部职级' }, ...grades.map((g) => ({ value: g, label: g }))]}
        />
      </Space>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="课程清单" size="small">
        <Table
          rowKey="id"
          dataSource={list}
          pagination={false}
          columns={[
            { title: '课程名称', dataIndex: 'courseName', render: (v, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{v}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position} · {r.grade}</span>
              </Space>
            )},
            {
              title: '课程类型',
              dataIndex: 'learnType',
              render: (v: 1 | 2 | 3) => (
                <Tag style={{ borderRadius: 6, background: LEARN_TYPE_COLOR[v] + '22', color: LEARN_TYPE_COLOR[v], borderColor: 'transparent' }}>
                  {LEARN_TYPE_LABEL[v]}
                </Tag>
              ),
            },
            {
              title: '掌握层级',
              dataIndex: 'mastery',
              render: (v: 1 | 2 | 3 | 4) => (
                <Tag style={{ borderRadius: 6, background: 'var(--teal-soft)', color: 'var(--teal)', borderColor: 'transparent' }}>
                  {MASTERY_LABEL[v]}
                </Tag>
              ),
            },
            { title: '考试题型', dataIndex: 'examMode' },
            { title: '学时', dataIndex: 'duration' },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="知识四档出题规则" size="small">
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9 }}>
          <b style={{ color: 'var(--clay)' }}>了解</b> → 选择题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>掌握</b> → 填空题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>熟练掌握</b> → 问答题 &nbsp;·&nbsp;
          <b style={{ color: 'var(--clay)' }}>精通</b> → 答辩
        </div>
      </Card>
    </div>
  );
}
