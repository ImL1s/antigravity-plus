# Antigravity 官方文件整理

> 📅 資料來源：https://antigravity.google/docs  
> 📅 擷取日期：2026-01-04

---

## 文件目錄結構

Antigravity 官方文件分為四大板塊：

### 1. Getting Started（入門指南）
- 下載安裝（macOS、Windows、Linux）
- 基本導航使用

### 2. Agent（AI Agent）
- **Models**：支援的 AI 模型
- **Agent Modes / Settings**：模式和設定
- **Rules / Workflows**：規則和工作流程
- **Task Groups**：任務群組
- **Browser Subagent**：瀏覽器子代理
- **Secure Mode**：安全模式

### 3. Tools（工具）
- **MCP (Model Context Protocol)**：擴展工具的核心機制

### 4. Artifacts（產出物）
- Task List（任務清單）
- Implementation Plan（實作計畫）
- Screenshots（截圖）

---

## 支援的 AI 模型

| 模型名稱 | 提供商 | 說明 |
|----------|--------|------|
| Gemini 3 Pro (High) | Google | 深度思考版本 |
| Gemini 3 Pro (Low) | Google | 標準版本 |
| Gemini 3 Flash | Google | 快速版本 |
| Claude Sonnet 4.5 | Anthropic | 平衡型 |
| Claude Opus 4.5 | Anthropic | 最強能力 |
| GPT-OSS-120B | OpenAI (開源變體) | 大參數開源 |

---

## Agent 模式

### Planning 模式
- 適合深度研究和複雜任務
- 會產出實作計畫（Implementation Plan）
- Agent 會詳細規劃後再執行

### Fast 模式
- 適合簡單指令
- 例如：重命名、執行 Bash 命令
- 追求速度，跳過規劃階段

---

## 關鍵設定選項

### Artifact Review Policy（產出物審核策略）
| 設定值 | 說明 |
|--------|------|
| `Always Proceed` | 永不請求用戶核准，自動執行 |
| `Request Review` | 每次都請求用戶核准 |

### Terminal Command Auto Execution（終端指令自動執行）
- **Allow List（白名單）**：定義允許自動執行的指令
- **Deny List（黑名單）**：定義永遠阻擋的危險指令

### Agent Non-Workspace File Access（非工作區檔案存取）
- 開啟後允許 Agent 存取工作區以外的檔案
- 例如：`~/.antigravity/`、`~/.gemini/` 等目錄

---

## Rules（規則）系統

規則用於指導 Agent 的行為，確保遵循特定的編碼標準和風格。

### 規則儲存位置

| 層級 | 路徑 |
|------|------|
| **全局規則** | `~/.gemini/GEMINI.md` |
| **專案規則** | `.agent/rules/` 目錄 |

### 規則啟動方式
1. **手動啟動**：透過指令觸發
2. **Always On**：永遠生效
3. **Model Decides**：由 AI 模型決定是否套用
4. **Glob Patterns**：根據檔案路徑模式自動套用

### 規則檔案格式
```markdown
---
description: 規則描述
activation: always | manual | model | glob
glob: "**/*.ts"
---

# 規則標題

規則的詳細內容...
```

---

## Workflows（工作流程）

工作流程定義 Agent 執行重複或複雜任務的步驟序列。

### 特性
- 儲存為 Markdown 檔案
- 可透過 slash commands 觸發
- 提供結構化的任務執行流程

### 範例用途
- 部署服務
- 生成單元測試
- 程式碼審查流程

---

## MCP（Model Context Protocol）整合

MCP 是 Antigravity 擴展工具能力的核心機制。

### 什麼是 MCP？
- 業界標準協議
- 用於連接本地工具、資料庫和外部服務
- 讓 Agent 可以使用額外的工具和資源

### 預建的 MCP 連接
- Linear（專案管理）
- GitHub
- Notion
- Supabase
- 更多第三方服務...

### 自訂 MCP Server
開發者可以建立自己的 MCP Server 來：
- 為 Agent 提供新的 **Tools**（工具）
- 為 Agent 提供新的 **Resources**（資源）

### MCP Store
- 位於 IDE 側邊面板的「...」選單中
- 用於安裝和管理外部工具

---

## 配額與限制

### 個人版（免費）
- **Generous weekly rate limits**（慷慨的每週限制）
- 基於「工作量」計算，而非簡單請求數

### 付費版（Google One / Workspace）
- **每 5 小時重新計算額度**
- 更高的使用上限

---

## 對插件開發的啟示

### 自動核准功能
✅ **可利用現有機制**：
- 透過修改 `Artifact Review Policy` 設定
- 配置 `Terminal Command Auto Execution` 的白名單/黑名單

### 用量監控功能
⚠️ **無公開 API**：
- 目前無官方的 Usage Monitoring API
- 可能需要：
  1. 攔截 API 請求
  2. 監控 IDE 狀態
  3. 解析日誌檔案

### 擴展 Agent 能力
✅ **透過 MCP**：
- 可建立自訂 MCP Server
- 提供額外的工具和資源給 Agent

---

## 參考連結

- 官方文件：https://antigravity.google/docs
- Getting Started：https://antigravity.google/docs/getting-started
- Agent Modes/Settings：https://antigravity.google/docs/agent-modes-settings
- Rules/Workflows：https://antigravity.google/docs/rules-workflows
- MCP：https://antigravity.google/docs/mcp
- Models：https://antigravity.google/docs/models
