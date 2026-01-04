# 測試指南

## 測試架構

```
src/test/
├── unit/                    # 單元測試（不需要 VS Code）
│   ├── index.ts             # 單元測試入口
│   ├── rules-engine.test.ts # 規則引擎測試
│   ├── circuit-breaker.test.ts # 斷路器測試
│   ├── countdown.test.ts    # 倒數計時測試
│   └── i18n.test.ts         # 國際化測試
│
├── smoke/                   # 冒煙測試（快速驗證）
│   └── extension.smoke.test.ts
│
├── e2e/                     # E2E 測試（完整流程）
│   ├── auto-approve.e2e.test.ts
│   ├── quota-monitor.e2e.test.ts
│   └── dashboard.e2e.test.ts
│
└── suite/                   # VS Code 測試入口
    └── index.ts
```

## 測試命令

```bash
# 編譯
npm run compile

# 單元測試（快速，不需要 VS Code）
npm run test:unit

# 冒煙測試
npm run test:smoke

# E2E 測試
npm run test:e2e

# 所有 VS Code 測試
npm run test

# 全部測試
npm run test:all
```

## 測試覆蓋範圍

### 單元測試 (Unit Tests)
- **rules-engine.test.ts**: 規則引擎
  - 硬編碼黑名單阻擋
  - 用戶黑名單阻擋
  - 白名單允許
  - 預設行為

- **circuit-breaker.test.ts**: 斷路器
  - 初始狀態
  - 失敗計數和狀態轉換
  - 超時後恢復
  - 重置功能

- **countdown.test.ts**: 倒數計時
  - 時間格式化
  - 過期處理

- **i18n.test.ts**: 國際化
  - 語言檔案完整性
  - 必要鍵值存在
  - 佔位符格式

### 冒煙測試 (Smoke Tests)
- 擴展載入
- 指令註冊
- 設定可讀取
- 狀態列顯示

### E2E 測試 (End-to-End Tests)
- **auto-approve.e2e.test.ts**: 自動核准流程
  - 切換指令執行
  - 狀態正確更新

- **quota-monitor.e2e.test.ts**: 配額監控流程
  - 刷新配額
  - 重置 Session
  - QuickPick 模式

- **dashboard.e2e.test.ts**: Dashboard UI
  - 開啟 Dashboard
  - 多次開啟復用
  - 日誌顯示

## 執行測試

### 開發時快速測試
```bash
npm run test:unit
```

### CI/CD 完整測試
```bash
npm run test:all
```

### 在 VS Code 中除錯測試
1. 開啟測試檔案
2. 使用 Debug 配置 "Extension Tests"
3. 設定斷點並執行
