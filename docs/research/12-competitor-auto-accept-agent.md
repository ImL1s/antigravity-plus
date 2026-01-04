# 競品分析：Auto Accept Agent

> 📅 擷取日期：2026-01-04  
> 📦 來源：用戶安裝的插件

---

## 基本資訊

| 項目 | 說明 |
|------|------|
| **名稱** | Auto Accept Agent |
| **發布者** | MunKhin |
| **平台** | Open VSX / VS Code Marketplace |
| **類型** | 自動接受 AI 建議 |
| **特色** | 輕量、快速、多平台支援 |

---

## 核心功能

### 🚀 自動接受功能

自動點擊以下重複性按鈕：
- **Accept** - 接受 AI 建議
- **Run** - 執行指令
- **Confirm** - 確認操作

### 🌐 多平台支援

| 平台 | 支援 |
|------|------|
| Cursor AI | ✅ |
| Google Antigravity | ✅ |
| GitHub Copilot | ✅ |
| VS Code Inline Suggestions | ✅ |

### ⚡ 技術特點

- **Smart Polling**：200ms 輪詢間隔
  - 輕量 CPU 使用
  - 即時回應
- **Lazy Loading**：自動偵測新載入的 AI 工具
- **背景運作**：即使 VS Code 視窗未聚焦也能運作

### 📊 狀態列切換

- 點擊狀態列圖示即可開關
- 顯示 `Auto Accept: ON` 或 `Auto Accept: OFF`

---

## Pro 版本功能

| 功能 | 說明 |
|------|------|
| 背景自動接受 | 視窗未聚焦時持續運作 |
| 多對話支援 | 跨多個對話視窗 |
| 持久化設定 | 記住上次的開關狀態 |
| 可配置接受速度 | 調整輪詢間隔 |
| 狀態可見性 | 更明顯的狀態指示 |

---

## 技術實作分析

### 輪詢機制
```javascript
// 推測的實作方式
setInterval(() => {
    // 尋找 Accept/Run/Confirm 按鈕
    const buttons = document.querySelectorAll('[data-action="accept"], [data-action="run"]');
    buttons.forEach(btn => btn.click());
}, 200); // 200ms 輪詢
```

### 為什麼使用 200ms？
- 快到足以即時回應
- 慢到不會造成 CPU 負擔
- 平衡了效能和反應速度

---

## 與我們產品的比較

| 功能 | Auto Accept Agent | Antigravity Plus |
|------|-------------------|------------------|
| 自動接受 | ✅ | ✅ |
| 安全黑名單 | ❌ | ✅ |
| 規則引擎 | ❌ | ✅ |
| 配額監控 | ❌ | ✅ |
| 成本估算 | ❌ | ✅ |
| 操作日誌 | ❌ | ✅ |
| Dashboard | ❌ | ✅ |

### 我們的優勢

1. **安全性**：有硬編碼的危險指令黑名單
2. **可配置性**：白名單/黑名單規則
3. **透明度**：完整的操作日誌
4. **整合**：結合配額監控功能

---

## 我們可以學習的功能

| 功能 | 優先級 | 說明 |
|------|--------|------|
| 200ms 輪詢 | ⭐⭐⭐⭐⭐ | 高效的輪詢策略 |
| 多平台支援 | ⭐⭐⭐ | 支援更多 AI 工具 |
| Lazy Loading | ⭐⭐⭐⭐ | 偵測新載入的工具 |
| 狀態列一鍵切換 | ⭐⭐⭐⭐⭐ | 方便快速開關 |

---

## 安裝方式

1. 在 VS Code/Antigravity 中搜索 "Auto Accept Agent"
2. 或下載 .vsix 檔案手動安裝

---

## 參考連結

- Open VSX: https://open-vsx.org (搜索 "Auto Accept Agent")
- VS Marketplace: https://marketplace.visualstudio.com (搜索 "Auto Accept Agent")
