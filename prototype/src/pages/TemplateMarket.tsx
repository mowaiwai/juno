import { Button, Card, Col, Row, Tag } from 'antd';
import { CheckCircleFilled, DownloadOutlined, StarFilled } from '@ant-design/icons';
import { templatePacks } from '@/mock/saas';
import { message } from 'antd';

const INDUSTRY_COLOR: Record<string, string> = {
  制造: 'var(--clay)',
  科技: 'var(--teal)',
  零售: 'var(--ochre)',
  大宗贸易: 'var(--sage)',
  通用: 'var(--ink-3)',
  医疗: 'var(--danger)',
};

export function TemplateMarket() {
  const installed = templatePacks.filter((t) => t.installed);

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
              {installed.map((t) => `${t.name} ${t.version}`).join('；')}。模板升级将在配置中心 diff 后合入。
            </div>
          </div>
        </div>
      </Card>

      <Card variant="borderless" style={{ background: 'var(--surface)' }} size="small" title="行业模板库">
        <Row gutter={[16, 16]}>
          {templatePacks.map((t) => (
            <Col span={8} key={t.id}>
              <div
                style={{
                  border: t.active ? '2px solid var(--sage)' : '1px solid var(--line)',
                  borderRadius: 10,
                  padding: 16,
                  height: '100%',
                  background: t.installed ? 'var(--sage-soft)' : 'var(--surface)',
                  opacity: t.status === 'off' ? 0.6 : 1,
                  position: 'relative',
                }}
              >
                {t.active && (
                  <Tag style={{ position: 'absolute', top: -10, right: 12, borderRadius: 6, background: 'var(--sage)', color: '#fff', borderColor: 'transparent', margin: 0, fontWeight: 700 }}>
                    当前生效
                  </Tag>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div className="font-serif" style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                  <Tag style={{ borderRadius: 6, background: INDUSTRY_COLOR[t.industry] + '22', color: INDUSTRY_COLOR[t.industry], borderColor: 'transparent', margin: 0 }}>
                    {t.industry}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7, minHeight: 42 }}>{t.desc}</div>
                <div style={{ display: 'flex', gap: 14, margin: '10px 0', fontSize: 12, color: 'var(--ink-3)' }}>
                  <span>版本 <b style={{ color: 'var(--ink)' }}>{t.version}</b></span>
                  <span>标准项 <b className="num" style={{ color: 'var(--ink)' }}>{t.standards}</b></span>
                  <span><StarFilled style={{ color: 'var(--ochre)' }} /> <b className="num" style={{ color: 'var(--ink)' }}>{t.rating}</b></span>
                  <span><DownloadOutlined /> <b className="num" style={{ color: 'var(--ink)' }}>{t.installs}</b></span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {t.status === 'off' ? (
                    <Button size="small" disabled block>暂未上架</Button>
                  ) : t.installed ? (
                    <Button size="small" block onClick={() => message.success(`已检查更新：${t.name} 为最新版本`)}>
                      {t.active ? '检查更新' : '启用此模板'}
                    </Button>
                  ) : (
                    <Button size="small" type="primary" block style={{ background: 'var(--charcoal)' }} onClick={() => message.loading(`正在导入 ${t.name}，导入后请到配置中心调整（模拟）`)}>
                      一键导入
                    </Button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8 }}>更新于 {t.updatedAt}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
