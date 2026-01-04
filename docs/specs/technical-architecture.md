# Antigravity Plus - 技術架構設計

## 專案結構

```
antigravity-plus/
├── .vscode/
│   ├── launch.json              # 除錯配置
│   ├── tasks.json               # 建置任務
│   └── settings.json            # 編輯器設定
│
├── docs/
│   ├── research/                # 研究文件
│   │   ├── 01-antigravity-overview.md
│   │   ├── 02-competitor-auto-all-antigravity.md
│   │   ├── 03-competitor-quota-monitor.md
│   │   ├── 04-competitor-token-visualizer.md
│   │   ├── 05-vscode-extension-development.md
│   │   ├── 06-ai-model-pricing.md
│   │   └── 07-antigravity-settings.md
│   │
│   ├── specs/                   # 規格文件
│   │   ├── feature-specification.md
│   │   └── technical-architecture.md
│   │
│   └── api/                     # API 文件
│       └── README.md
│
├── src/
│   ├── extension.ts             # 擴展入口點
│   │
│   ├── auto-approve/            # 自動核准模組
│   │   ├── index.ts             # 模組入口
│   │   ├── controller.ts        # 主控制器
│   │   ├── rules/
│   │   │   ├── index.ts         # 規則引擎
│   │   │   ├── blocklist.ts     # 黑名單規則
│   │   │   ├── allowlist.ts     # 白名單規則
│   │   │   └── patterns.ts      # 模式匹配
│   │   ├── handlers/
│   │   │   ├── fileHandler.ts   # 檔案操作處理
│   │   │   └── terminalHandler.ts # 終端指令處理
│   │   └── recovery.ts          # Agent 恢復
│   │
│   ├── usage-monitor/           # 用量監控模組
│   │   ├── index.ts             # 模組入口
│   │   ├── controller.ts        # 主控制器
│   │   ├── tracker.ts           # 使用量追蹤器
│   │   ├── tokenizer/
│   │   │   ├── index.ts         # Tokenizer 入口
│   │   │   ├── gemini.ts        # Gemini tokenizer
│   │   │   ├── anthropic.ts     # Anthropic tokenizer
│   │   │   └── openai.ts        # OpenAI tokenizer
│   │   ├── models/
│   │   │   ├── index.ts         # 模型配置
│   │   │   └── pricing.ts       # 定價資料
│   │   └── storage.ts           # 資料持久化
│   │
│   ├── ui/                      # UI 模組
│   │   ├── index.ts             # UI 模組入口
│   │   ├── statusBar.ts         # 狀態列組件
│   │   ├── notifications.ts     # 通知管理
│   │   └── dashboard/
│   │       ├── webview.ts       # Webview 控制器
│   │       ├── panel.html       # Dashboard HTML
│   │       ├── panel.css        # Dashboard 樣式
│   │       └── panel.js         # Dashboard 腳本
│   │
│   ├── types/                   # TypeScript 類型定義
│   │   ├── index.ts
│   │   ├── auto-approve.ts
│   │   ├── usage-monitor.ts
│   │   └── config.ts
│   │
│   └── utils/                   # 工具函數
│       ├── config.ts            # 設定管理
│       ├── logger.ts            # 日誌記錄
│       ├── time.ts              # 時間工具
│       └── format.ts            # 格式化工具
│
├── resources/
│   ├── icons/                   # 圖示資源
│   │   ├── icon.png
│   │   └── icon.svg
│   └── templates/               # 模板檔案
│
├── test/
│   ├── suite/
│   │   ├── auto-approve.test.ts
│   │   ├── usage-monitor.test.ts
│   │   └── rules.test.ts
│   └── runTest.ts
│
├── package.json
├── tsconfig.json
├── webpack.config.js
├── .eslintrc.json
├── .prettierrc
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## 模組架構

```
┌─────────────────────────────────────────────────────────────┐
│                      Extension (extension.ts)                │
│  - activate()                                                │
│  - deactivate()                                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Auto Approve │   │ Usage Monitor │   │      UI       │
│    Module     │   │    Module     │   │    Module     │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ - Controller  │   │ - Controller  │   │ - StatusBar   │
│ - Rules       │   │ - Tracker     │   │ - Dashboard   │
│ - Handlers    │   │ - Tokenizer   │   │ - Notifications│
│ - Recovery    │   │ - Storage     │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │       Utilities       │
                ├───────────────────────┤
                │ - Config Manager      │
                │ - Logger              │
                │ - Formatters          │
                └───────────────────────┘
```

---

## 資料流

### 自動核准流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Agent   │────▶│  Interceptor │────▶│   Rules     │
│   Request   │     │   Handler    │     │   Engine    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         ▼                     ▼                     ▼
                   ┌───────────┐         ┌───────────┐         ┌───────────┐
                   │  ALLOW    │         │  BLOCK    │         │   ASK     │
                   │ (execute) │         │  (deny)   │         │  (prompt) │
                   └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
                         │                     │                     │
                         └─────────────────────┼─────────────────────┘
                                               │
                                               ▼
                                        ┌───────────┐
                                        │   Logger  │
                                        │  (record) │
                                        └───────────┘
```

### 用量監控流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Model   │────▶│    Tracker  │────▶│  Tokenizer  │
│   Response  │     │  (intercept)│     │  (count)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌───────────┐
                                        │   Cost    │
                                        │ Calculator│
                                        └─────┬─────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         ▼                     ▼                     ▼
                   ┌───────────┐         ┌───────────┐         ┌───────────┐
                   │  Storage  │         │ StatusBar │         │ Dashboard │
                   │  (save)   │         │ (update)  │         │ (display) │
                   └───────────┘         └───────────┘         └───────────┘
```

---

## 核心類別設計

### AutoApproveController

```typescript
class AutoApproveController {
  private enabled: boolean;
  private rulesEngine: RulesEngine;
  private fileHandler: FileOperationHandler;
  private terminalHandler: TerminalCommandHandler;
  private logger: OperationLogger;

  constructor(context: vscode.ExtensionContext);
  
  // 公開方法
  enable(): void;
  disable(): void;
  toggle(): boolean;
  
  // 處理請求
  handleFileOperation(operation: FileOperation): Promise<ApprovalResult>;
  handleTerminalCommand(command: string): Promise<ApprovalResult>;
  
  // 規則管理
  addRule(rule: ApprovalRule): void;
  removeRule(ruleId: string): void;
  getRules(): ApprovalRule[];
  
  // 日誌
  getOperationLogs(options?: LogQueryOptions): OperationLog[];
}
```

### UsageMonitorController

```typescript
class UsageMonitorController {
  private tracker: UsageTracker;
  private tokenizers: Map<string, Tokenizer>;
  private storage: UsageStorage;
  private statusBar: StatusBarManager;

  constructor(context: vscode.ExtensionContext);
  
  // 追蹤
  trackUsage(record: UsageInput): Promise<void>;
  getCurrentSession(): SessionUsage;
  resetSession(): void;
  
  // 查詢
  getDailyUsage(date?: Date): DailyUsage;
  getWeeklyUsage(): WeeklyUsage;
  getMonthlyUsage(): MonthlyUsage;
  
  // 成本
  calculateCost(tokens: TokenCount, model: string): number;
  getTotalCost(period: 'day' | 'week' | 'month'): number;
  
  // 匯出
  exportData(format: 'json' | 'csv'): Promise<string>;
}
```

### RulesEngine

```typescript
class RulesEngine {
  private blocklist: BlocklistRule[];
  private allowlist: AllowlistRule[];
  private customRules: CustomRule[];

  constructor();
  
  // 評估
  evaluate(input: RuleInput): RuleResult;
  
  // 規則管理
  addBlocklistItem(pattern: string): void;
  addAllowlistItem(pattern: string): void;
  addCustomRule(rule: CustomRule): void;
  
  // 匹配
  private matchPattern(input: string, pattern: string): boolean;
  private matchRegex(input: string, regex: RegExp): boolean;
}
```

---

## 事件系統

### 發布的事件

| 事件名稱 | 說明 | Payload |
|----------|------|---------|
| `antigravity-plus.autoApprove.toggled` | 自動核准切換 | `{ enabled: boolean }` |
| `antigravity-plus.operation.approved` | 操作被核准 | `OperationLog` |
| `antigravity-plus.operation.blocked` | 操作被阻擋 | `OperationLog` |
| `antigravity-plus.usage.updated` | 用量更新 | `UsageRecord` |
| `antigravity-plus.session.reset` | Session 重置 | `{ previousUsage: SessionUsage }` |
| `antigravity-plus.budget.warning` | 預算警告 | `{ current: number, threshold: number }` |

### 監聽的事件

| 來源 | 事件 | 處理 |
|------|------|------|
| VS Code | `onDidChangeConfiguration` | 重新載入設定 |
| VS Code | `onDidOpenTerminal` | 註冊終端監聽 |
| Antigravity | Agent 請求事件 | 評估並處理 |

---

## 儲存策略

### GlobalState（全域持久化）
- 用量歷史記錄
- 總成本統計
- 全域規則設定

### WorkspaceState（工作區持久化）
- 專案特定規則
- 專案用量統計
- 本地偏好設定

### SessionStorage（會話儲存）
- 當前 Session 用量
- 臨時操作日誌
- UI 狀態

---

## 相依套件

### 生產依賴
```json
{
  "dependencies": {
    "tiktoken": "^1.0.0",       // OpenAI tokenizer
    "uuid": "^9.0.0"            // UUID 生成
  }
}
```

### 開發依賴
```json
{
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.3.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "prettier": "^3.1.0"
  }
}
```

---

## 安全考量

### 敏感操作保護
1. 預設黑名單永不可被覆蓋
2. 即使在 Turbo 模式，危險指令也會被阻擋
3. 所有阻擋操作都會記錄和通知

### 資料安全
1. 不儲存任何 API 金鑰
2. 不傳送用量資料到外部伺服器
3. 所有資料都儲存在本地

### 許可權
- 擴展只請求必要的 VS Code API 許可權
- 不存取網路（除非需要使用 tokenizer API）
