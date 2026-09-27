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
          colorPrimary: '#2b2825',
          colorLink: '#c2653f',
          colorSuccess: '#7e9b78',
          colorWarning: '#c2a05a',
          colorError: '#b5524a',
          colorInfo: '#7fa09b',
          colorTextBase: '#211f1c',
          colorBgLayout: '#f5f4ee',
          borderRadius: 10,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Menu: {
            itemBorderRadius: 8,
            itemSelectedBg: '#f7e8e1',
            itemSelectedColor: '#c2653f',
            groupTitleColor: '#8a857a',
          },
          Button: {
            primaryShadow: 'none',
            defaultShadow: 'none',
          },
          Table: {
            headerBg: '#faf9f5',
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
