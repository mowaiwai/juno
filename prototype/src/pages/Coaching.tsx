import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Empty, Input, Row, Select, Space, Spin, Timeline, message,
} from 'antd';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { perfApi } from '@/api/perf';
import type { CoachingOut } from '@/api/perf';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';
import { useAuth } from '@/store/auth';
import { perfPermsForRef } from '@/auth/rbac';
import { ApiError } from '@/api/client';

interface ApiErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

function asApiError(e: unknown): ApiErrorLike {
  if (e instanceof ApiError) return e;
  if (e && typeof e === 'object') return e as ApiErrorLike;
  return { message: String(e) };
}

export function Coaching() {
  const [params] = useSearchParams();
  const { persona, activeRole } = useAuth();
  const perms = perfPermsForRef(activeRole);
  const canWrite = perms.resultEntry || perms.planManage;

  const [directory, setDirectory] = useState<EmployeeDirectoryItem[]>([]);
  const [empId, setEmpId] = useState(params.get('emp') ?? persona?.employeeId ?? '');
  const [records, setRecords] = useState<CoachingOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [happenedAt, setHappenedAt] = useState<dayjs.Dayjs>(dayjs());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await employeesApi.list();
        if (!cancelled) setDirectory(list.filter((e) => e.is_active));
      } catch {
        // 员工角色可能无目录权限：至少保留本人选项
        if (persona && !cancelled) {
          const selfNo = persona.employeeId ?? persona.id;
          setDirectory([
            {
              id: selfNo,
              employee_no: selfNo,
              name: persona.name,
              dept_id: '',
              position: '',
              family: '',
              sequence: '',
              grade: '',
              grade_since: null,
              perf_grade: null,
              manager_id: null,
              manager_name: null,
              is_active: true,
            },
          ]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona]);

  const reload = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const list = await perfApi.listCoaching(empId);
      setRecords(list);
    } catch (e) {
      message.error(asApiError(e).message ?? '加载辅导记录失败');
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const empName = useMemo(
    () => directory.find((e) => e.id === empId)?.name ?? persona?.name ?? '',
    [directory, empId, persona],
  );

  const save = async () => {
    if (!content.trim()) {
      message.warning('请填写辅导内容');
      return;
    }
    setSaving(true);
    try {
      await perfApi.createCoaching({
        employee_id: empId,
        content: content.trim(),
        happened_at: happenedAt.format('YYYY-MM-DD'),
      });
      message.success('辅导记录已保存');
      setContent('');
      setHappenedAt(dayjs());
      await reload();
    } catch (e) {
      message.error(asApiError(e).message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">辅导与回看</h1>
          <div className="page-subtitle">绩效辅导轻量记录 · 按员工回看</div>
        </div>
        <Select
          value={empId || undefined}
          onChange={setEmpId}
          style={{ width: 260 }}
          showSearch
          optionFilterProp="label"
          placeholder="选择员工"
          options={directory.map((e) => ({
            value: e.id,
            label: `${e.name} · ${e.employee_no}${e.position ? ` · ${e.position}` : ''}`,
          }))}
        />
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            variant="borderless"
            style={{ background: 'var(--surface)' }}
            title={`${empName || '员工'} 的辅导记录`}
            size="small"
          >
            <Spin spinning={loading}>
              {records.length === 0 ? (
                <Empty description="暂无辅导记录" style={{ padding: 40 }} />
              ) : (
                <Timeline
                  items={records.map((r) => ({
                    color: 'var(--ochre)',
                    children: (
                      <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                        <Space style={{ marginBottom: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {dayjs(r.happened_at).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </Space>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                          {r.content}
                        </div>
                      </div>
                    ),
                  }))}
                />
              )}
            </Spin>
          </Card>
        </Col>

        {canWrite && (
          <Col span={8}>
            <Card variant="borderless" style={{ background: 'var(--surface)' }} title="新增辅导记录" size="small">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <DatePicker
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  value={happenedAt}
                  onChange={(v) => v && setHappenedAt(v)}
                  style={{ width: '100%' }}
                />
                <Input.TextArea
                  rows={5}
                  placeholder="辅导内容（沟通要点、改进约定等）"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <Button
                  type="primary"
                  block
                  loading={saving}
                  onClick={save}
                  style={{ background: 'var(--charcoal)' }}
                >
                  保存记录
                </Button>
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
