# Antigravity Plus - 功能規格書

## 專案概述

**Antigravity Plus** 是一個為 Google Antigravity IDE 設計的擴展插件，結合自動核准 AI Agent 請求和用量監控功能，幫助開發者更高效地使用 AI 輔助開發。

---

## 核心功能模組

### 模組 1：自動核准 (Auto Approve)

#### 功能描述
自動接受 AI Agent 的操作請求，減少手動確認的次數，提升開發效率。

#### 子功能

| ID | 功能 | 說明 | 優先級 |
|----|------|------|--------|
| AA-01 | 檔案編輯自動核准 | 自動接受 Agent 提出的檔案修改 | P0 |
| AA-02 | 終端指令自動執行 | 自動允許執行 shell 指令 | P0 |
| AA-03 | 安全黑名單 | 阻擋危險指令執行 | P0 |
| AA-04 | 安全白名單 | 定義永遠允許的指令 | P1 |
| AA-05 | 規則模式匹配 | 支援正則表達式規則 | P1 |
| AA-06 | 專案層級設定 | 不同專案可有不同規則 | P2 |
| AA-07 | Agent 恢復 | 偵測並恢復卡住的 Agent | P2 |
| AA-08 | 操作日誌 | 記錄所有自動核准的操作 | P1 |

#### 預設黑名單
```
rm -rf /
rm -rf ~
rm -rf /*
format c:
format d:
del /f /s /q c:\*
dd if=/dev/zero
mkfs.*
:(){:|:&};:
chmod -R 777 /
shutdown
reboot
```

---

### 模組 2：用量監控 (Usage Monitor)

#### 功能描述
追蹤和視覺化 AI 模型的 Token 使用量，幫助開發者了解使用成本和模式。

#### 子功能

| ID | 功能 | 說明 | 優先級 |
|----|------|------|--------|
| UM-01 | Token 計數 | 追蹤輸入/輸出 Token 數量 | P0 |
| UM-02 | 成本估算 | 根據模型定價計算成本 | P0 |
| UM-03 | 狀態列顯示 | 在 IDE 狀態列即時顯示 | P0 |
| UM-04 | Session 管理 | 追蹤單次會話用量 | P1 |
| UM-05 | 歷史記錄 | 保存每日/每週用量歷史 | P1 |
| UM-06 | 多模型支援 | 支援 Gemini/Claude/GPT | P1 |
| UM-07 | 配額追蹤 | 追蹤 API 配額使用情況 | P2 |
| UM-08 | 預算警報 | 設定用量/成本警報閾值 | P2 |

---

### 模組 3：Dashboard UI

#### 功能描述
提供視覺化的儀表板介面，展示用量統計和操作記錄。

#### 子功能

| ID | 功能 | 說明 | 優先級 |
|----|------|------|--------|
| UI-01 | Webview 面板 | 主要 Dashboard 介面 | P0 |
| UI-02 | 今日摘要 | 當日用量/成本摘要 | P0 |
| UI-03 | Token 圖表 | 即時 Token 消耗趨勢圖 | P1 |
| UI-04 | 模型分佈 | 各模型使用量圓餅圖 | P1 |
| UI-05 | 歷史趨勢 | 7天/30天趨勢折線圖 | P2 |
| UI-06 | 阻擋記錄 | 被安全機制阻擋的操作 | P1 |
| UI-07 | 效率統計 | 節省的點擊次數/時間 | P2 |
| UI-08 | 匯出功能 | CSV/JSON 格式匯出 | P3 |

---

## 使用者設定

### 自動核准設定
```json
{
  "antigravity-plus.autoApprove.enabled": true,
  "antigravity-plus.autoApprove.mode": "auto",
  "antigravity-plus.autoApprove.fileOperations": true,
  "antigravity-plus.autoApprove.terminalCommands": true,
  "antigravity-plus.autoApprove.denyList": [],
  "antigravity-plus.autoApprove.allowList": [],
  "antigravity-plus.autoApprove.excludeFilePatterns": []
}
```

### 用量監控設定
```json
{
  "antigravity-plus.usageMonitor.enabled": true,
  "antigravity-plus.usageMonitor.showInStatusBar": true,
  "antigravity-plus.usageMonitor.defaultModel": "gemini-3-pro",
  "antigravity-plus.usageMonitor.budgetAlert.enabled": false,
  "antigravity-plus.usageMonitor.budgetAlert.threshold": 10.00
}
```

### UI 設定
```json
{
  "antigravity-plus.dashboard.autoOpen": false,
  "antigravity-plus.dashboard.refreshInterval": 5000,
  "antigravity-plus.notifications.showBlocked": true,
  "antigravity-plus.notifications.showWarnings": true
}
```

---

## 命令 (Commands)

| 命令 ID | 標題 | 說明 |
|---------|------|------|
| `antigravity-plus.openDashboard` | Open Dashboard | 開啟用量監控儀表板 |
| `antigravity-plus.toggleAutoApprove` | Toggle Auto Approve | 切換自動核准開關 |
| `antigravity-plus.resetSession` | Reset Session | 重置當前 Session 計數 |
| `antigravity-plus.showLogs` | Show Operation Logs | 顯示操作日誌 |
| `antigravity-plus.configureRules` | Configure Rules | 開啟規則配置介面 |
| `antigravity-plus.exportData` | Export Usage Data | 匯出用量資料 |

---

## 狀態列設計

### 格式
```
[🤖 Auto: ON] [📊 12.5K tokens | $0.15 | Gemini 3 Pro]
```

### 元素說明
| 元素 | 說明 | 互動 |
|------|------|------|
| 🤖 Auto: ON/OFF | 自動核准狀態 | 點擊切換開關 |
| 📊 12.5K tokens | 當前 Session Token 數 | 點擊開啟 Dashboard |
| $0.15 | 估算成本 | 點擊顯示詳細成本 |
| Gemini 3 Pro | 當前模型 | 點擊切換模型 |

### 顏色指示
- 🟢 綠色：正常使用
- 🟡 黃色：接近配額限制
- 🔴 紅色：已達限制或有錯誤

---

## 資料儲存

### 使用 ExtensionContext
```typescript
// 全域儲存（跨工作區持久化）
context.globalState.update('usageHistory', data);

// 工作區儲存（工作區特定）
context.workspaceState.update('projectRules', rules);
```

### 資料結構

#### UsageRecord
```typescript
interface UsageRecord {
  id: string;
  timestamp: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  operation: 'chat' | 'completion' | 'agent';
}
```

#### OperationLog
```typescript
interface OperationLog {
  id: string;
  timestamp: Date;
  type: 'file_edit' | 'terminal_command' | 'blocked';
  action: 'approved' | 'blocked' | 'manual';
  details: string;
  rule?: string;
}
```

---

## 開發里程碑

### Phase 1 - MVP (P0 功能)
- [ ] 專案初始化
- [ ] 自動核准基礎功能
- [ ] 安全黑名單
- [ ] Token 計數
- [ ] 狀態列顯示
- [ ] 基礎 Dashboard

### Phase 2 - 完善功能 (P1 功能)
- [ ] 白名單和規則匹配
- [ ] Session 管理
- [ ] 多模型支援
- [ ] 操作日誌
- [ ] 圖表視覺化

### Phase 3 - 進階功能 (P2/P3 功能)
- [ ] 專案層級設定
- [ ] Agent 恢復
- [ ] 配額追蹤
- [ ] 預算警報
- [ ] 匯出功能
