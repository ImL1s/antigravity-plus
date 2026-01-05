# Antigravity Plus - AI 助理指南

## 專案概述
這是一個 VS Code 擴充功能專案，用於增強 Gemini Code Assist 的使用體驗。

---

## 🚀 CI/CD 發布流程

### 當前狀態
- **自動打包**：Push 到 `main` 分支會自動觸發打包
- **自動發布**：使用 `OVSX_PAT` secret 發布到 Open VSX Registry
- **CI 流程**：Test → Package → Release

### 版本號管理（重要！）
> ⚠️ **每次發布前必須手動 bump 版本號**

Open VSX 不允許發布相同版本，版本號必須遞增。

```bash
# 查看當前 Open VSX 版本
curl https://open-vsx.org/api/ImL1s/antigravity-plus | jq .version

# 確保 package.json 版本大於線上版本
```

### 未來改進：Semantic Release（待實作）

推薦使用 `semantic-release` + `semantic-release-vsce` 自動化版本管理：

```bash
npm install --save-dev semantic-release semantic-release-vsce @semantic-release/changelog @semantic-release/git
```

配置 `.releaserc.json`：
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["semantic-release-vsce", {
      "packageVsix": true,
      "publish": true,
      "publishOpenVSX": true
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version}"
    }]
  ]
}
```

使用 Conventional Commits 規範：
- `feat:` → minor 版本升級
- `fix:` → patch 版本升級
- `feat!:` 或 `BREAKING CHANGE:` → major 版本升級

---

## 🔑 Secrets 配置

| Secret 名稱 | 用途 | 設定位置 |
|------------|------|---------|
| `OVSX_PAT` | Open VSX Registry 發布 Token | GitHub Repo Settings → Secrets |

```bash
# 使用 gh CLI 設定 secret
gh secret set OVSX_PAT --body "ovsxat_xxxxx"
```

---

## 📦 手動打包

```bash
npm run package
# 產出: antigravity-plus-x.x.x.vsix
```

---

## 🧪 測試

```bash
npm run test:unit    # 單元測試
npm run test:e2e     # E2E 測試
npm run compile      # 編譯
```
