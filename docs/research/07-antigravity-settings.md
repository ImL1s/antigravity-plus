# Antigravity 設定參考

## Agent 設定

### Review Policy（審核策略）
在 Antigravity IDE 的 Agent 標籤頁中設定：

| 設定值 | 說明 |
|--------|------|
| `Always Proceed` | AI 自動執行所有動作，無需用戶批准 |
| `Agent Decides` | AI 決定哪些步驟需要用戶批准 |
| `Request Review` | AI 在每個重要步驟都暫停等待用戶批准 |

---

### Terminal Command Auto Execution Policy（終端指令自動執行策略）

| 設定值 | 說明 |
|--------|------|
| `Off` | 永不自動執行終端指令，每次都需明確許可 |
| `Auto` | Agent 決定何時自動執行，必要時詢問（推薦預設） |
| `Turbo` | 總是自動執行，除非在 Deny List 中 |

---

## settings.json 相關設定

### VS Code / Antigravity 通用設定

```json
{
  // Agent 相關（可能的設定鍵，需實際驗證）
  "antigravity.agent.reviewPolicy": "agentDecides",
  "antigravity.agent.terminalPolicy": "auto",
  
  // 終端指令 Allow/Deny 列表
  "antigravity.terminal.allowList": [
    "npm install",
    "npm run *",
    "git status",
    "git add *",
    "git commit *"
  ],
  "antigravity.terminal.denyList": [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf /*",
    "format *:",
    "del /f /s /q *"
  ],
  
  // 檔案操作
  "antigravity.files.autoAccept": false,
  "antigravity.files.excludePatterns": [
    "**/.env",
    "**/*.key",
    "**/secrets/**"
  ]
}
```

---

## VS Code Chat 相關設定（參考）

這些是 VS Code / GitHub Copilot 的設定，可能在 Antigravity 中有類似對應：

```json
{
  // 工具自動批准
  "chat.tools.autoApprove": false,
  
  // 全域自動批准（危險！）
  "chat.tools.global.autoApprove": false,
  
  // 終端指令自動批准
  "chat.tools.terminal.autoApprove": {
    "npm install": true,
    "npm run dev": true,
    "git status": true,
    "rm -rf": false
  },
  
  // 啟用終端自動批准
  "chat.tools.terminal.enableAutoApprove": false,
  
  // Agent 最大請求數（預設 25）
  "chat.agent.maxRequests": 25
}
```

---

## 環境變數

可能需要設定的環境變數：

```bash
# Google AI API Key（如果需要直接 API 存取）
GOOGLE_AI_API_KEY=your_api_key

# Anthropic API Key（如果支援 Claude）
ANTHROPIC_API_KEY=your_api_key

# OpenAI API Key（如果支援 GPT）
OPENAI_API_KEY=your_api_key
```

---

## 配置檔案路徑

### Antigravity 配置目錄
- **Windows**: `%APPDATA%\Antigravity\User\settings.json`
- **macOS**: `~/Library/Application Support/Antigravity/User/settings.json`
- **Linux**: `~/.config/Antigravity/User/settings.json`

### Extension 儲存位置
- **Windows**: `%USERPROFILE%\.antigravity\extensions\`
- **macOS**: `~/.antigravity/extensions/`
- **Linux**: `~/.antigravity/extensions/`

---

## 工作區設定

### .vscode/settings.json（專案層級）
```json
{
  // 專案特定的 Antigravity 設定
  "antigravity.agent.reviewPolicy": "requestReview",
  
  // 此專案禁止自動執行
  "antigravity.agent.terminalPolicy": "off"
}
```

### .antigravity/config.json（如果存在）
```json
{
  "project": {
    "name": "my-project",
    "autoApprove": {
      "enabled": false,
      "rules": []
    }
  }
}
```

---

## 參考資源

⚠️ **注意：以上設定鍵可能不完全準確，需要在實際環境中驗證**

- Antigravity 官方文件：https://antigravity.google/docs
- VS Code 設定參考：https://code.visualstudio.com/docs/getstarted/settings
