# 競品分析：Antigravity Cockpit

> 📅 擷取日期：2026-01-04  
> 📦 來源：用戶安裝的插件

---

## 基本資訊

| 項目 | 說明 |
|------|------|
| **名稱** | Antigravity Cockpit |
| **發布者** | jlcodes (jlcodes99) |
| **GitHub** | github.com/jlcodes99/vscode-antigravity-cockpit |
| **類型** | 配額監控 + Dashboard |
| **特色** | 最完整的視覺化 Dashboard |

---

## 核心功能

### 📊 顯示模式

#### 1. Webview Dashboard（主要模式）
- **卡片視圖 / 列表視圖**：兩種佈局可切換
- **分組模式**：按配額池聚合模型，顯示分組配額
- **非分組模式**：顯示單個模型配額
- **拖曳排序**：拖動卡片調整顯示順序
- **自動分組**：根據配額池自動歸類模型

#### 2. QuickPick 模式（備用）
使用 VS Code 原生 QuickPick API，適用於：
- Webview 無法加載的環境
- 偏好鍵盤操作的用戶
- 需要快速查看配額

功能：
- 支援分組 / 非分組模式
- 標題欄按鈕：刷新、切換分組、開啟日誌、設定
- 置頂模型到狀態列
- 重新命名模型和分組

### 📈 狀態列

支援 **6 種顯示格式**：
```
🚀           # 僅圖示
🟢           # 顏色圖示
🟡           # 警告顏色
🔴           # 危險顏色
95%          # 僅百分比
🟢 95%       # 圖示 + 百分比
Sonnet: 95%  # 模型名 + 百分比
🟢 Sonnet: 95%  # 完整格式
```

特色：
- **多模型置頂**：可同時監控多個模型
- **自動監控**：未指定模型時，自動顯示剩餘配額最低的模型

### 📊 配額顯示

每個模型/分組顯示：
- 剩餘配額百分比
- 倒數計時（如 `4h 40m`）
- 重置時間（如 `15:16`）
- 進度條視覺化

### 🎯 模型能力提示

懸停模型名稱可查看：
- 支援的輸入類型（文字、圖片、影片等）
- 上下文視窗大小
- 其他能力標記

### 📁 分組功能

- **按配額池分組**：共享配額池的模型自動或手動歸類
- **自訂分組名稱**：點擊編輯圖示重新命名
- **分組排序**：拖曳調整分組順序
- **分組置頂**：將分組固定到狀態列

### ⚙️ 設定面板

通過儀表板右上角齒輪圖示開啟，可配置：
- 狀態列顯示格式
- 警告閾值（黃色）
- 危險閾值（紅色）
- 視圖模式（卡片 / 列表）
- 通知開關

### 👤 用戶資料面板

顯示：
- 訂閱等級
- 用戶 ID
- 可折疊，隱私資料可脫敏

### 🔔 通知

當模型配額低於警告閾值或耗盡時發送通知。可在設定中禁用。

---

## 配置選項

| 設定 | 預設值 | 說明 |
|------|--------|------|
| `agCockpit.displayMode` | `webview` | 顯示模式 (webview/quickpick) |
| `agCockpit.viewMode` | `card` | 視圖模式 (card/list) |
| `agCockpit.refreshInterval` | `120` | 刷新間隔（秒） |
| `agCockpit.statusBarFormat` | `standard` | 狀態列格式 |
| `agCockpit.groupingEnabled` | `true` | 啟用分組 |
| `agCockpit.warningThreshold` | `30` | 警告閾值 (%) |
| `agCockpit.criticalThreshold` | `10` | 危險閾值 (%) |
| `agCockpit.notificationEnabled` | `true` | 啟用通知 |
| `agCockpit.pinnedModels` | `[]` | 置頂的模型 |
| `agCockpit.pinnedGroups` | `[]` | 置頂的分組 |

---

## 我們可以學習的功能

| 功能 | 優先級 | 說明 |
|------|--------|------|
| 分組功能 | ⭐⭐⭐⭐ | 按配額池分組模型 |
| 多模型置頂 | ⭐⭐⭐⭐ | 狀態列顯示多個模型 |
| 倒數計時 | ⭐⭐⭐⭐⭐ | 顯示配額重置倒數 |
| QuickPick 備用模式 | ⭐⭐⭐ | Webview 失敗時的備用 |
| 拖曳排序 | ⭐⭐⭐ | 自訂顯示順序 |
| 模型能力提示 | ⭐⭐⭐ | 懸停顯示模型資訊 |

---

## 參考連結

- GitHub: https://github.com/jlcodes99/vscode-antigravity-cockpit
- Open VSX: 搜索 "Antigravity Cockpit"
