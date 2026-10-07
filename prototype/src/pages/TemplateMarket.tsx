import { useEffect, useState } from 'react';
import { Button, Card, Col, Row, Tag, message } from 'antd';
import { CheckCircleFilled, DownloadOutlined, StarFilled } from '@ant-design/icons';
import { saasApi, INDUSTRY_COLOR, type TemplatePackOut } from '@/api/saas';

export function TemplateMarket() {
  const [packs, setPacks] = useState<TemplatePackOut[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setPacks(await saasApi.listTemplates()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const installed = packs.filter((t) => t.installed);

  const install = async (t: TemplatePackOut) => {
    await saasApi.installTemplate(t.id);
    message.success(`已导入 ${t.name}，请到配置中心调整`);
    load();
  };
  const uninstall = async (t: TemplatePackOut) => {
    await saasApi.uninstallTemplate(t.id);
    message.success(`已卸载 ${t.name}`);
    load();
  };

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title font-serif">模板市场</h1>
          <div className="page-subtitle">行业包一键导入：标准库 / 通道 / 规则包 · 导入后在配置中心按自身企业调整</div>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'var(--sage-soft)', marginBottom: 16 }} size="small">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CheckCircleFilled style={{ color: 'var(--sage)', fontSize: 18 }} />
          <div>
            <div style={{ fontWeight: 700 }}>已安装 {installed.length} 个模板</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {installed.map((t) => `${t.name} ${t.version}`).join('；') || '暂无已安装模板'}。模板升级将在配置中心 diff 后合入。
            </div>
          </div>
        </div>
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="行业模板库">
        <Row gutter={[16, 16]}>
          {packs.map((t) => (
            <Col span={8} key={t.id}>
              <div style={{
                border: t.active ? '2px solid var(--sage)' : '1px solid var(--line)',
                borderRadius: 10, padding: 16, height: '100%',
                background: t.installed ? 'var(--sage-soft)' : 'var(--surface)',
                opacity: t.status === 'off' ? 0.6 : 1, position: 'relative',
              }}>
                {t.active && (
                  <Tag style={{ position: 'absolute', top: -10, right: 12, borderRadius: 6, background: 'var(--sage)', color: '#fff', borderColor: 'transparent', margin: 0, fontWeight: 700 }}>
                    当前生效
                  </Tag>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div className="font-serif" style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                  <Tag style={{ borderRadius: 6, background: (INDUSTRY_COLOR[t.industry] ?? 'var(--ink-3)') + '22', color: INDUSTRY_COLOR[t.industry] ?? 'var(--ink-3)', borderColor: 'transparent', margin: 0 }}>
                    {t.industry}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7, minHeight: 42 }}>{t.desc}</div>
                <div style={{ display: 'flex', gap: 14, margin: '10px 0', fontSize: 12, color: 'var(--ink-3)' }}>
                  <span>版本 <b style={{ color: 'var(--ink)' }}>{t.version}</b></span>
                  <span>标准项 <b className="num" style={{ color: 'var(--ink)' }}>{t.standards_count}</b></span>
                  <span><StarFilled style={{ color: 'var(--ochre)' }} /> <b className="num" style={{ color: 'var(--ink)' }}>{t.rating}</b></span>
                  <span><DownloadOutlined /> <b className="num" style={{ color: 'var(--ink)' }}>{t.installs}</b></span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {t.status === 'off' ? (
                    <Button size="small" disabled block>暂未上架</Button>
                  ) : t.installed ? (
                    <Button size="small" block onClick={() => uninstall(t)}>卸载</Button>
                  ) : (
                    <Button size="small" type="primary" block style={{ background: 'var(--charcoal)' }} loading={loading} onClick={() => install(t)}>
                      一键导入
                    </Button>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
