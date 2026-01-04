<p align="center">
  <img src="https://github.com/ImL1s/antigravity-plus/raw/main/assets/banner.png" alt="Antigravity Plus Banner" width="100%">
</p>

<h1 align="center">⚡ Antigravity Plus</h1>

<p align="center">
  <strong>Antigravity 進階使用者的終極 VS Code 擴充功能</strong>
</p>

<p align="center">
  <a href="#功能特色">功能特色</a> •
  <a href="#安裝方式">安裝方式</a> •
  <a href="#使用說明">使用說明</a> •
  <a href="#設定選項">設定選項</a> •
  <a href="#貢獻指南">貢獻指南</a> •
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.85+-blue.svg" alt="VS Code">
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/github/license/user/antigravity-plus" alt="License">
  <img src="https://img.shields.io/github/actions/workflow/status/user/antigravity-plus/ci.yml" alt="CI">
</p>

---

## ✨ 功能特色

### 🚀 自動核准 (Auto Accept)
智慧安全規則，自動核准 AI 建議的操作。

- **200ms 超低延遲** - 即時回應，無縫工作流程
- **智慧安全規則** - 內建危險指令保護 (`rm -rf /`、`format c:` 等)
- **自訂白名單/黑名單** - 精細控制自動核准項目
- **熔斷器機制** - 錯誤時自動保護
- **影響統計面板** - 追蹤節省的點擊數與時間

### 📊 配額監控 (Quota Monitor)
即時監控您的 AI 模型配額使用量。

- **多模型支援** - Gemini、Claude、GPT 等
- **自訂分組** - 將模型整理成邏輯群組
- **6 種顯示格式** - 從極簡圖示到詳細進度條
- **倒數計時器** - 準確知道配額重置時間
- **狀態列整合** - 隨時可見，不干擾工作

### ⏰ 自動喚醒 (Auto Wake-up)
智慧排程，絕不錯過配額重置時機。

- **每日排程** - 自動在最佳時間喚醒
- **雙模式** - VS Code 常駐 + 系統排程器
- **智慧優化** - 根據歷史計算最佳喚醒時間
- **執行歷史** - 追蹤所有喚醒事件

### 🌍 多語系支援
完整國際化，支援 8 種語言：
- English、繁體中文、简体中文、日本語、한국어、Español、Français、Deutsch

---

## 📦 安裝方式

### 從 VS Code Marketplace
1. 開啟 VS Code
2. 前往擴充功能 (`Ctrl+Shift+X`)
3. 搜尋 "Antigravity Plus"
4. 點擊安裝

### 從 VSIX 檔案
```bash
code --install-extension antigravity-plus-x.x.x.vsix
```

### 從原始碼建置
```bash
git clone https://github.com/user/antigravity-plus.git
cd antigravity-plus
npm install
npm run compile
```

---

## 🚀 使用說明

### 快速開始

1. **啟用自動核准**：點擊狀態列項目，或使用 `Ctrl+Shift+P` → "Antigravity Plus: Toggle Auto Approve"

2. **查看配額**：在狀態列查看配額，點擊開啟儀表板

3. **設定喚醒**：開啟設定 → Antigravity Plus → Auto Wake-up

### 指令列表

| 指令 | 說明 |
|------|------|
| `Antigravity Plus: Toggle Auto Approve` | 啟用/停用自動核准 |
| `Antigravity Plus: Open Dashboard` | 開啟主儀表板 |
| `Antigravity Plus: Refresh Quota` | 手動重新整理配額 |
| `Antigravity Plus: Reset Session` | 重置 Session 統計 |
| `Antigravity Plus: Show Logs` | 開啟執行日誌 |

---

## ⚙️ 設定選項

```json
{
  // 自動核准
  "antigravity-plus.autoApprove.enabled": true,
  "antigravity-plus.autoApprove.denyList": ["npm publish", "git push --force"],
  "antigravity-plus.autoApprove.allowList": ["npm install", "npm run dev"],
  
  // 配額監控
  "antigravity-plus.quotaMonitor.enabled": true,
  "antigravity-plus.quotaMonitor.pollInterval": 30000,
  "antigravity-plus.quotaMonitor.displayStyle": "iconNamePercentage",
  
  // 自動喚醒
  "antigravity-plus.autoWakeup.enabled": false,
  "antigravity-plus.autoWakeup.time": "06:00",
  
  // 介面
  "antigravity-plus.ui.language": "auto"
}
```

---

## 🧪 測試

```bash
# 執行所有測試
npm run test

# 僅執行單元測試
npm run test:unit

# 執行整合測試
npm run test:integration
```

**測試覆蓋率：**
- 106 個單元測試
- 24 個端對端測試
- 共 128 個測試 ✅

---

## 🛡️ 安全規則

以下指令**永遠被阻擋**：

| 類別 | 範例 |
|------|------|
| **系統破壞** | `rm -rf /`、`format c:`、`dd if=/dev/zero` |
| **Fork 炸彈** | `:(){:|:&};:` |
| **權限濫用** | `chmod -R 777 /` |
| **系統控制** | `shutdown`、`reboot` |

---

## 🤝 貢獻指南

歡迎貢獻！請先閱讀 [貢獻指南](CONTRIBUTING.md)。

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 發起 Pull Request

---

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案。

---

## 🙏 致謝

- 靈感來自 [Antigravity Cockpit](https://marketplace.visualstudio.com/items?itemName=example.cockpit)
- 為 Antigravity 社群用 ❤️ 打造

---

<p align="center">
  用 ⚡ 打造 by <a href="https://github.com/user">Your Name</a>
</p>
