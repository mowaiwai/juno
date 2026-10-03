import { Card, Empty, Space, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import {
  SELF_LEVEL_META,
  type ApplicationDetailDTO,
} from '@/api/applications';

/** 申请材料只读视图：标准项 + 自评 + 举证清单（经理/评委/HR 共用） */
export function ApplicationMaterial({ detail }: { detail: ApplicationDetailDTO }) {
  if (detail.standard_items.length === 0) {
    return <Empty description="该申请无标准项" />;
  }

  const assessmentByCode = new Map(
    detail.self_assessments.map((a) => [a.standard_item_code, a]),
  );
  const evidencesByCode = (code: string) =>
    detail.evidences.filter((e) => e.standard_item_code === code);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {[...detail.standard_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => {
          const assessment = assessmentByCode.get(item.code);
          const files = evidencesByCode(item.code);
          return (
            <Card
              key={item.code}
              size="small"
              variant="borderless"
              style={{ background: 'var(--surface-sunken)' }}
              styles={{ body: { padding: 14 } }}
              title={
                <Space wrap size={8}>
                  <FileTextOutlined style={{ color: 'var(--clay)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 650 }}>
                    {item.name}
                  </span>
                  <Tag style={{ borderRadius: 6 }}>{item.code}</Tag>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    权重 {item.weight}%
                  </span>
                  {assessment && (
                    <Tag
                      style={{
                        borderRadius: 6,
                        borderColor: 'transparent',
                        color: SELF_LEVEL_META[assessment.self_level].color,
                        background: 'var(--surface)',
                      }}
                    >
                      自评：{SELF_LEVEL_META[assessment.self_level].label}
                    </Tag>
                  )}
                </Space>
              }
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--ink-2)',
                  lineHeight: 1.9,
                  marginBottom: 8,
                }}
              >
                <div>{item.description}</div>
                <div style={{ color: 'var(--ink-3)' }}>
                  达标要求：{item.requirement}
                </div>
              </div>
              {assessment?.self_comment && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-2)',
                    background: 'var(--surface)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 8,
                  }}
                >
                  {assessment.self_comment}
                </div>
              )}
              {files.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {files.map((f) => (
                    <Tag
                      key={f.id}
                      style={{
                        borderRadius: 6,
                        borderColor: 'var(--line)',
                        background: 'var(--surface)',
                        color: 'var(--ink-2)',
                      }}
                    >
                      <FileTextOutlined /> {f.file_name}
                    </Tag>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
    </Space>
  );
}
