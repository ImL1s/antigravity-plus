# MCP（Model Context Protocol）開發指南

> 📅 資料來源：https://antigravity.google/docs/mcp  
> 📅 擷取日期：2026-01-04

---

## 什麼是 MCP？

**Model Context Protocol (MCP)** 是一個業界標準協議，用於連接 AI 模型與外部工具和資源。在 Antigravity 中，MCP 是擴展 Agent 能力的核心機制。

---

## MCP 架構

```
┌─────────────────────────────────────────────────┐
│                Antigravity IDE                   │
│  ┌─────────────────────────────────────────────┐│
│  │              AI Agent (Gemini)               ││
│  └────────────────────┬────────────────────────┘│
│                       │                          │
│                       ▼                          │
│  ┌─────────────────────────────────────────────┐│
│  │            MCP Client (內建)                 ││
│  └────────────────────┬────────────────────────┘│
└───────────────────────┼─────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ MCP     │    │ MCP     │    │ MCP     │
   │ Server  │    │ Server  │    │ Server  │
   │ (GitHub)│    │ (Linear)│    │ (Custom)│
   └─────────┘    └─────────┘    └─────────┘
```

---

## MCP 提供的能力

### 1. Tools（工具）
Agent 可以呼叫的函數或操作：
- 搜索 GitHub Issues
- 創建 Linear 任務
- 查詢資料庫
- 呼叫外部 API

### 2. Resources（資源）
Agent 可以讀取的資料來源：
- 檔案內容
- 資料庫記錄
- API 回應資料
- 配置設定

---

## 預建的 MCP 連接

Antigravity 內建支援多種 MCP 服務：

| 服務 | 用途 |
|------|------|
| **GitHub** | 程式碼倉庫、Issues、PRs |
| **Linear** | 專案管理、任務追蹤 |
| **Notion** | 文件協作、知識庫 |
| **Supabase** | 資料庫操作 |
| **更多...** | 透過 MCP Store 安裝 |

---

## MCP Store

### 位置
IDE 側邊面板 → 「...」選單 → MCP Store

### 功能
- 瀏覽可用的 MCP 服務
- 一鍵安裝/卸載
- 管理已連接的服務

---

## 建立自訂 MCP Server

### 基本結構

MCP Server 需要實作以下介面：

```typescript
interface MCPServer {
  // 伺服器資訊
  info: {
    name: string;
    version: string;
    description: string;
  };
  
  // 提供的工具
  tools: MCPTool[];
  
  // 提供的資源
  resources: MCPResource[];
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: any) => Promise<any>;
}

interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}
```

### 範例：Token 用量監控 MCP Server

```typescript
// mcp-usage-monitor/index.ts
import { MCPServer } from '@anthropic/mcp-sdk';

const server: MCPServer = {
  info: {
    name: 'usage-monitor',
    version: '1.0.0',
    description: 'Monitor AI token usage and costs'
  },
  
  tools: [
    {
      name: 'get_usage_stats',
      description: 'Get current session token usage statistics',
      inputSchema: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['session', 'day', 'week'] }
        }
      },
      handler: async (input) => {
        // 實作用量統計邏輯
        return {
          inputTokens: 12345,
          outputTokens: 6789,
          estimatedCost: 0.15
        };
      }
    }
  ],
  
  resources: [
    {
      uri: 'usage://daily-report',
      name: 'Daily Usage Report',
      description: 'Token usage report for today',
      mimeType: 'application/json'
    }
  ]
};
```

---

## 連接自訂 MCP Server

### 配置檔案位置
```
~/.antigravity/mcp.json
```

### 配置格式
```json
{
  "servers": {
    "usage-monitor": {
      "command": "node",
      "args": ["/path/to/mcp-usage-monitor/index.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## MCP 與我們插件的整合策略

### 方案 A：建立 MCP Server（推薦）

**優點**：
- 符合 Antigravity 官方擴展機制
- Agent 可直接使用我們的工具
- 良好的整合體驗

**實作**：
1. 建立 `antigravity-plus-mcp-server`
2. 提供用量查詢工具
3. 提供規則管理工具

### 方案 B：建立 VS Code Extension

**優點**：
- 可直接控制 UI（狀態列、Dashboard）
- 存取 VS Code API
- 可攔截事件

**缺點**：
- 與 Agent 的整合較間接

### 方案 C：混合方案（最佳）

**建議**：
1. **VS Code Extension** 負責：
   - UI 呈現（狀態列、Dashboard）
   - 設定管理
   - 本地資料儲存

2. **MCP Server** 負責：
   - 提供工具給 Agent 查詢用量
   - 讓 Agent 可以自我監控

---

## 相關資源

### 官方文件
- MCP 規範：https://modelcontextprotocol.io
- Antigravity MCP 文件：https://antigravity.google/docs/mcp

### SDK 和工具
- `@anthropic/mcp-sdk`（參考實作）
- MCP Inspector（除錯工具）

---

## 下一步行動

1. ✅ 研究 MCP 協議規範
2. ⬜ 設計 `usage-monitor` MCP Server
3. ⬜ 實作 VS Code Extension + MCP Server 混合架構
4. ⬜ 在 Antigravity 中測試整合
