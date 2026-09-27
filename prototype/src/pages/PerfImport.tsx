import { Button, Card, Progress, Space, Table, Tag, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { perfImportBatches } from '@/mock/gap';

const STATUS_LABEL = { pending: '待导入', importing: '导入中', done: '已完成', failed: '部分失败' };
const STATUS_COLOR = { pending: 'var(--ink-4)', importing: 'var(--ochre)', done: 'var(--sage)', failed: 'var(--danger)' };

export function PerfImport() {
  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">绩效结果导入</h1>
          <div className="page-subtitle">接入外部绩效数据 · 自动回写画像与九宫格定位</div>
        </div>
        <Upload beforeUpload={() => { message.success('文件已上传，正在解析'); return false; }} showUploadList={false}>
          <Button type="primary" icon={<UploadOutlined />} style={{ background: 'var(--charcoal)' }}>上传绩效文件</Button>
        </Upload>
      </div>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} title="导入批次" size="small">
        <Table
          rowKey="id"
          dataSource={perfImportBatches}
          pagination={false}
          columns={[
            { title: '批次', render: (_: unknown, r) => (
              <Space direction="vertical" size={2}>
                <span style={{ fontWeight: 600 }}>{r.period}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{r.id}</span>
              </Space>
            )},
            { title: '总人数', dataIndex: 'total' },
            {
              title: '导入进度',
              render: (_: unknown, r) => (
                <Space>
                  <Progress percent={Math.round((r.imported / r.total) * 100)} size="small" strokeColor={STATUS_COLOR[r.status]} style={{ width: 120 }} showInfo={false} />
                  <span className="num" style={{ fontSize: 12 }}>{r.imported}/{r.total}</span>
                </Space>
              ),
            },
            { title: '异常数', dataIndex: 'errorCount', render: (v: number) => v > 0 ? <Tag color="red" style={{ borderRadius: 6 }}>{v}</Tag> : '0' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: 'pending' | 'importing' | 'done' | 'failed') => (
                <Tag style={{ borderRadius: 6, background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s], borderColor: 'transparent' }}>{STATUS_LABEL[s]}</Tag>
              ),
            },
            { title: '创建时间', dataIndex: 'createdAt' },
            {
              title: '操作',
              render: (_: unknown, r) => r.status === 'done' ? (
                <Button size="small" type="link" onClick={() => message.success('已回写画像')}>回写画像</Button>
              ) : (
                <Button size="small" onClick={() => message.info('继续导入')}>继续</Button>
              ),
            },
          ]}
        />
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)', marginTop: 16 }} title="导入说明" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.9 }}>
          <li>支持 Excel/CSV 格式，字段：工号、考核周期、绩效等级（S/A/B/C/D）、得分</li>
          <li>系统自动校验工号与周期合法性，异常数据单独标记</li>
          <li>导入完成后自动回写画像绩效维度，并触发九宫格定位重算</li>
          <li>S/A 需同时满足分数、比例、定义三条件</li>
        </ul>
      </Card>
    </div>
  );
}
