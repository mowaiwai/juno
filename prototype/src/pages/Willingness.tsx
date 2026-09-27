import { useState } from 'react';
import { Button, Card, Col, Input, Radio, Row, Space, Table, Tag, message } from 'antd';
import { willingnessRecords, WILLINGNESS_LABEL } from '@/mock/succession';
import type { Willingness } from '@/mock/succession';

const WILLINGNESS_COLOR = { unconfirmed: 'var(--ink-4)', willing: 'var(--sage)', unwilling: 'var(--danger)' };

export function Willingness() {
  const [records, setRecords] = useState(willingnessRecords);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Willingness>('willing');
  const [note, setNote] = useState('');

  const unconfirmed = records.filter((r) => r.willingness === 'unconfirmed').length;
  const willing = records.filter((r) => r.willingness === 'willing').length;

  const submit = () => {
    if (!activeId) return;
    setRecords((p) => p.map((r) => r.id === activeId ? { ...r, willingness: answer, note, confirmedAt: new Date().toISOString().slice(0, 10) } : r));
    setActiveId(null);
    setNote('');
    message.success('意愿已确认');
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">意愿确认</h1>
          <div className="page-subtitle">候选人对继任目标岗位的意愿确认 · 入池前置条件</div>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>待确认</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ochre)' }}>{unconfirmed}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>愿意</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--sage)' }}>{willing}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>不愿意</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--danger)' }}>{records.length - unconfirmed - willing}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>总记录</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{records.length}</div>
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="意愿确认记录" size="small">
        <Table
          rowKey="id"
          dataSource={records}
          pagination={false}
          columns={[
            { title: '候选人', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.employeeName}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.position}</span>
              </Space>
            )},
            { title: '目标岗位', dataIndex: 'targetPosition' },
            {
              title: '意愿',
              dataIndex: 'willingness',
              render: (v: Willingness) => (
                <Tag style={{ borderRadius: 6, background: WILLINGNESS_COLOR[v] + '22', color: WILLINGNESS_COLOR[v], borderColor: 'transparent' }}>{WILLINGNESS_LABEL[v]}</Tag>
              ),
            },
            { title: '确认时间', dataIndex: 'confirmedAt', render: (v) => v ?? '-' },
            { title: '备注', dataIndex: 'note', render: (v) => v ?? '-' },
            {
              title: '操作',
              render: (_: unknown, r) => (
                <Button size="small" onClick={() => { setActiveId(r.id); setAnswer(r.willingness === 'unconfirmed' ? 'willing' : r.willingness); setNote(r.note ?? ''); }}>
                  {r.willingness === 'unconfirmed' ? '去确认' : '修改'}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {activeId && (
        <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="意愿确认" size="small">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>是否愿意接任「{records.find((r) => r.id === activeId)?.targetPosition}」？</div>
              <Radio.Group value={answer} onChange={(e) => setAnswer(e.target.value)}>
                <Radio value="willing">愿意</Radio>
                <Radio value="unwilling">不愿意</Radio>
              </Radio.Group>
            </div>
            <Input.TextArea rows={2} placeholder="备注（不愿意请说明原因）" value={note} onChange={(e) => setNote(e.target.value)} />
            <Space>
              <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={submit}>提交确认</Button>
              <Button onClick={() => setActiveId(null)}>取消</Button>
            </Space>
          </Space>
        </Card>
      )}
    </div>
  );
}
