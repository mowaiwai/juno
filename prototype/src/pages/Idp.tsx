import { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, Progress, Row, Select, Space, Tag, Timeline, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { idpApi, IDP_STATUS_LABEL_MAP, type IDPOut } from '@/api/idp';
import { employeesApi, type EmployeeDirectoryItem } from '@/api/employees';

const KB_STATUS = { done: { label: '已完成', color: 'var(--sage)' }, doing: { label: '进行中', color: 'var(--clay)' }, todo: { label: '待开始', color: 'var(--ink-4)' } } as const;

export function Idp() {
  const [params] = useSearchParams();
  const persona = useAuth((s) => s.persona);
  const [emps, setEmps] = useState<EmployeeDirectoryItem[]>([]);
  const [empId, setEmpId] = useState<string>('');
  const [idps, setIdps] = useState<IDPOut[]>([]);

  useEffect(() => {
    employeesApi.list().then((dir) => {
      setEmps(dir);
      const paramEmp = params.get('emp');
      const defaultEmp = paramEmp ?? persona?.employeeId ?? (dir.length ? dir[0].id : '');
      if (defaultEmp) setEmpId(defaultEmp);
    }).catch(() => message.error('加载员工目录失败'));
  }, []);

  useEffect(() => {
    if (!empId) return;
    idpApi.list(empId)
      .then(setIdps)
      .catch(() => message.error('加载 IDP 数据失败'));
  }, [empId]);

  const emp = emps.find((e) => e.id === empId);

  const handleGenerate = () => {
    if (!empId) return;
    const period = `2026 Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    idpApi.generate({ employee_id: empId, period })
      .then((newIdp) => {
        setIdps((prev) => [newIdp, ...prev]);
        message.success('AI 已基于画像差距生成 IDP 草稿');
      })
      .catch(() => message.error('AI 生成 IDP 失败'));
  };

  const handleConfirm = (idpId: string) => {
    idpApi.confirm(idpId)
      .then((updated) => {
        setIdps((prev) => prev.map((i) => (i.id === idpId ? updated : i)));
        message.success('IDP 已确认，进入执行跟踪');
      })
      .catch(() => message.error('确认失败'));
  };

  const handleSubmitReview = (idpId: string) => {
    idpApi.submitReview(idpId, '复盘进行中')
      .then((updated) => {
        setIdps((prev) => prev.map((i) => (i.id === idpId ? updated : i)));
        message.info('已提交复盘');
      })
      .catch(() => message.error('提交复盘失败'));
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">IDP 个人发展计划</h1>
          <div className="page-subtitle">能力差距→发展目标→关键行为计划→复盘（员工季度 / 管理者半年）</div>
        </div>
        <Select
          value={empId}
          onChange={setEmpId}
          style={{ width: 240 }}
          showSearch
          optionFilterProp="label"
          placeholder={emps.length ? '选择员工' : '暂无员工'}
          options={emps.map((e) => ({ value: e.id, label: `${e.name} · ${e.position}` }))}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>员工</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp?.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{emp?.position} · {emp?.grade}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>IDP 数量</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--clay)' }}>{idps.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>周期类型</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', marginTop: 2 }}>{idps[0]?.period_type === 2 ? '管理者半年' : '员工季度'}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>状态</div>
            <Tag style={{ borderRadius: 6, marginTop: 4 }}>{idps[0] ? IDP_STATUS_LABEL_MAP[idps[0].status] : '无'}</Tag>
          </Card>
        </Col>
      </Row>

      {idps.length === 0 ? (
        <Card variant="borderless" style={{ background: 'var(--surface)' }}>
          <Empty description="该员工暂无 IDP" style={{ padding: 40 }}>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>AI 生成 IDP 草稿</Button>
          </Empty>
        </Card>
      ) : (
        idps.map((idp) => {
          const doneCount = idp.key_behaviors.filter((k) => k.status === 'done').length;
          const progress = Math.round((doneCount / idp.key_behaviors.length) * 100);
          return (
            <Card key={idp.id} variant="borderless" style={{ background: 'var(--surface)', marginBottom: 16 }} title={`${idp.period} IDP`} size="small">
              <Row gutter={16}>
                <Col span={10}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>发展目标</div>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {idp.goals.map((g, i) => (
                      <div key={i} style={{ padding: 10, background: 'var(--clay-soft)', borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, color: 'var(--clay)' }}>{g.ability}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{g.target}</div>
                      </div>
                    ))}
                  </Space>
                </Col>
                <Col span={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600 }}>关键行为计划</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>进度 {progress}%</span>
                  </div>
                  <Progress percent={progress} strokeColor="var(--clay)" style={{ marginBottom: 14 }} />
                  <Timeline
                    items={idp.key_behaviors.map((k) => ({
                      color: KB_STATUS[k.status].color,
                      children: (
                        <Space direction="vertical" size={2}>
                          <Space>
                            <span style={{ fontWeight: 600 }}>{k.behavior}</span>
                            <Tag style={{ borderRadius: 6, background: KB_STATUS[k.status].color + '22', color: KB_STATUS[k.status].color, borderColor: 'transparent' }}>{KB_STATUS[k.status].label}</Tag>
                          </Space>
                          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{k.plan}</span>
                        </Space>
                      ),
                    }))}
                  />
                </Col>
              </Row>

              {idp.review_result && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--teal-soft)', borderRadius: 8, fontSize: 13 }}>
                  <b>复盘结论：</b>{idp.review_result}
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <Space>
                  {idp.status === 'draft' && (
                    <Button type="primary" style={{ background: 'var(--charcoal)' }} onClick={() => handleConfirm(idp.id)}>确认 IDP</Button>
                  )}
                  {idp.status === 'confirmed' && (
                    <Button onClick={() => handleSubmitReview(idp.id)}>提交复盘</Button>
                  )}
                  <Button icon={<ThunderboltOutlined />} onClick={handleGenerate}>AI 生成新 IDP</Button>
                </Space>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
