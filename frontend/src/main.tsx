import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App'
import '@fontsource/geist-sans'
import '@fontsource/geist-mono'
import './index.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#632CA6',
        colorSuccess: '#2DB88D',
        colorWarning: '#E2903C',
        colorError: '#E65C5C',
        colorInfo: '#632CA6',
        borderRadius: 6,
        borderRadiusLG: 10,
        fontFamily: 'Geist Sans, system-ui, -apple-system, sans-serif',
        fontSize: 13,
        colorBgContainer: '#ffffff',
        colorBorder: '#d8d8da',
        colorBorderSecondary: '#eeeeef',
        controlHeight: 36,
        paddingContentHorizontal: 16,
      },
      components: {
        Button: {
          borderRadius: 10,
          controlHeight: 40,
          paddingContentHorizontal: 20,
        },
        Input: {
          borderRadius: 10,
          controlHeight: 40,
        },
        Card: {
          borderRadiusLG: 20,
          paddingLG: 28,
        },
        Table: {
          borderRadiusLG: 16,
          headerBg: '#fafafa',
          headerColor: '#71717a',
        },
        Tag: {
          borderRadiusSM: 6,
        },
      },
    }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
