import { Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useActiveRoleMeta } from '@/store/auth';

interface MaskedFieldProps {
  value?: string | number;
  /** 字段类别：薪酬 / 绩效 / 测评 / 完整画像 */
  kind?: 'salary' | 'perf' | 'assessment' | 'profile';
  format?: (v: string | number) => string;
}

/**
 * 敏感字段掩码原语：按激活角色决定明文或掩码。
 */
export function MaskedField({
  value,
  kind = 'salary',
  format,
}: MaskedFieldProps) {
  const meta = useActiveRoleMeta();
  const allowed =
    kind === 'salary'
      ? meta?.seeSalary
      : kind === 'perf'
        ? meta?.seePerf
        : meta?.seeFullProfile;

  if (allowed && value !== undefined) {
    return <span className="num">{format ? format(value) : value}</span>;
  }
  return (
    <Tooltip title="当前角色无权查看该敏感字段">
      <span style={{ color: 'var(--ink-4)' }}>
        <LockOutlined style={{ fontSize: 11, marginRight: 4 }} />
 ••••
      </span>
    </Tooltip>
  );
}
