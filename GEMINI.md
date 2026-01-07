# Antigravity Plus - AI 助理指南

## 專案概述
這是一個 VS Code 擴充功能專案，用於增強 Gemini Code Assist 的使用體驗。

---

## 🚀 CI/CD 發布流程

### 當前狀態
- **自動打包**：Push 到 `main` 分支會自動觸發打包
- **自動發布**：使用 `OVSX_PAT` secret 發布到 Open VSX Registry
- **CI 流程**：Test → Package → Release

### 版本號管理（已自動化 ✅）

> ✅ **已啟用 Semantic Release 自動化版本管理**

現在使用 `semantic-release` + `semantic-release-vsce` 自動管理版本號：
- 版本號根據 commit message 自動決定
- CHANGELOG.md 自動生成
- 自動發布到 Open VSX Registry

#### Conventional Commits 規範

| Commit 類型 | 版本變更 | 範例 |
|------------|---------|------|
| `feat:` | minor (0.x.0) | `feat: add dark mode support` |
| `fix:` | patch (0.0.x) | `fix: resolve login issue` |
| `feat!:` 或 `BREAKING CHANGE:` | major (x.0.0) | `feat!: redesign API` |

#### 配置檔 `.releaserc.json`
```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["semantic-release-vsce", {
      "packageVsix": true,
      "publish": false,
      "publishOpenVSX": true
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }]
  ]
}
```

#### 查看線上版本
```bash
curl https://open-vsx.org/api/ImL1s/antigravity-plus | jq .version
```

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
