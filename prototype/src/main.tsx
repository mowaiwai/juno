import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppRoutes } from '@/AppRoutes';
import '@/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#d96a8e',
          colorLink: '#c7567c',
          colorSuccess: '#7fc49b',
          colorWarning: '#e3be6b',
          colorError: '#de7066',
          colorInfo: '#7fb5d6',
          colorTextBase: '#35313d',
          colorBgLayout: '#fbf8f4',
          borderRadius: 12,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Menu: {
            itemBorderRadius: 10,
            itemSelectedBg: '#fce9f1',
            itemSelectedColor: '#c7567c',
            groupTitleColor: '#a099aa',
          },
          Button: {
            primaryShadow: 'none',
            defaultShadow: 'none',
          },
          Table: {
            headerBg: '#f8f4f0',
          },
        },
      }}
    >
      <AntApp>
        <AppRoutes />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
