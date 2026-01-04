# VS Code 擴展開發指南

## 開發環境準備

### 必要工具
| 工具 | 說明 | 安裝指令 |
|------|------|---------|
| **Node.js** | JavaScript 運行環境（建議 v18+） | https://nodejs.org |
| **VS Code** | 開發和測試 IDE | https://code.visualstudio.com |
| **Yeoman** | 專案腳手架工具 | `npm install -g yo` |
| **generator-code** | VS Code 擴展生成器 | `npm install -g generator-code` |
| **vsce** | 擴展打包和發布工具 | `npm install -g @vscode/vsce` |

---

## 建立新專案

### 使用 Yeoman 生成器
```bash
yo code
```

### 互動式選項
```
? What type of extension do you want to create?
  > New Extension (TypeScript)    # ✅ 推薦
    New Extension (JavaScript)
    New Color Theme
    New Language Support
    New Code Snippets
    New Keymap
    New Extension Pack
    New Language Pack (Localization)
    New Web Extension
```

### 後續問題
```
? What's the name of your extension? antigravity-plus
? What's the identifier of your extension? antigravity-plus
? What's the description of your extension? Auto-approve AI agent requests and monitor token usage
? Initialize a git repository? Yes
? Bundle the source code with webpack? Yes
? Which package manager to use? npm
```

---

## 專案結構解析

```
antigravity-plus/
├── .vscode/
│   ├── launch.json        # 除錯配置
│   ├── tasks.json         # 建置任務
│   └── extensions.json    # 建議的擴展
├── src/
│   └── extension.ts       # 主入口點
├── package.json           # 擴展 manifest
├── tsconfig.json          # TypeScript 配置
├── webpack.config.js      # 打包配置
├── .vscodeignore          # 發布時忽略的檔案
└── README.md              # 擴展說明
```

---

## package.json 關鍵配置

### 基本資訊
```json
{
  "name": "antigravity-plus",
  "displayName": "Antigravity Plus",
  "description": "Auto-approve AI agent requests and monitor token usage",
  "version": "0.0.1",
  "publisher": "your-publisher-id",
  "engines": {
    "vscode": "^1.85.0"
  }
}
```

### 啟動事件 (Activation Events)
```json
{
  "activationEvents": [
    "onStartupFinished",           // VS Code 啟動完成後
    "onCommand:extension.xxx",     // 特定指令觸發
    "onView:xxx",                  // 特定視圖顯示
    "onLanguage:typescript"        // 開啟特定語言檔案
  ]
}
```

### 貢獻點 (Contribution Points)
```json
{
  "contributes": {
    "commands": [
      {
        "command": "antigravity-plus.openDashboard",
        "title": "Open Dashboard",
        "category": "Antigravity Plus"
      }
    ],
    "configuration": {
      "title": "Antigravity Plus",
      "properties": {
        "antigravity-plus.autoApprove.enabled": {
          "type": "boolean",
          "default": false,
          "description": "Enable auto-approve for AI agent requests"
        }
      }
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "antigravity-plus",
          "title": "Antigravity Plus",
          "icon": "resources/icon.svg"
        }
      ]
    }
  }
}
```

---

## 核心 API

### ExtensionContext
擴展的上下文物件，提供：
- `subscriptions` - 訂閱清理陣列
- `globalState` - 全域持久化儲存
- `workspaceState` - 工作區持久化儲存
- `extensionPath` - 擴展安裝路徑

### 常用命名空間

#### vscode.commands
```typescript
// 註冊命令
vscode.commands.registerCommand('extension.sayHello', () => {
  vscode.window.showInformationMessage('Hello!');
});

// 執行命令
vscode.commands.executeCommand('vscode.open', uri);
```

#### vscode.window
```typescript
// 顯示訊息
vscode.window.showInformationMessage('Info');
vscode.window.showWarningMessage('Warning');
vscode.window.showErrorMessage('Error');

// 狀態列
const statusBar = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
);
statusBar.text = '$(rocket) Antigravity Plus';
statusBar.show();

// Webview
const panel = vscode.window.createWebviewPanel(
  'dashboard',
  'Dashboard',
  vscode.ViewColumn.One,
  { enableScripts: true }
);
panel.webview.html = '<html>...</html>';
```

#### vscode.workspace
```typescript
// 讀取設定
const config = vscode.workspace.getConfiguration('antigravity-plus');
const enabled = config.get<boolean>('autoApprove.enabled');

// 監聽設定變更
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('antigravity-plus')) {
    // 重新載入設定
  }
});
```

---

## 除錯與測試

### 啟動除錯
1. 按 `F5` 啟動 Extension Development Host
2. 新視窗中測試擴展功能
3. 使用 Debug Console 查看輸出

### launch.json 配置
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": ["${workspaceFolder}/out/**/*.js"]
    }
  ]
}
```

---

## 打包與發布

### 打包為 .vsix
```bash
vsce package
```

### 發布到 VS Marketplace
```bash
vsce publish
```

### 發布到 Open VSX
```bash
npx ovsx publish -p <token>
```

---

## 相關資源

### 官方文件
- VS Code Extension API: https://code.visualstudio.com/api
- API 參考: https://code.visualstudio.com/api/references/vscode-api
- Extension Guides: https://code.visualstudio.com/api/extension-guides/overview

### 範例 Repos
- VS Code Extension Samples: https://github.com/microsoft/vscode-extension-samples
