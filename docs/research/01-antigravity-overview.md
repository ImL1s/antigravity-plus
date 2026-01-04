# Google Antigravity 平台概述

## 基本資訊

| 項目 | 說明 |
|------|------|
| **名稱** | Google Antigravity |
| **類型** | AI 優先開發平台 (Agent-first IDE) |
| **基礎** | Visual Studio Code 開源版本分支 |
| **發布日期** | 2025 年 11 月（公開預覽） |
| **預設 AI 模型** | Gemini 3 Pro |
| **官網** | https://antigravity.google |

---

## 核心理念

Antigravity 的核心概念是 **「Agent-first」** 範式：
- AI Agent 可以自主處理複雜的編碼任務
- 包括規劃、編碼、測試、甚至瀏覽網頁
- 開發者從手動編碼轉變為任務層級的操作

---

## 主要視圖

### 1. Editor View（編輯器視圖）
類似傳統 IDE 的編輯介面，保留：
- 檔案總管
- 整合終端機
- 原始碼控制面板
- 除錯器 UI
- 設定系統

### 2. Manager View（管理者視圖）
**Mission Control Dashboard** - 用於協調多個 AI Agent：
- 可同時啟動多個 Agent 並行處理不同任務
- 例如：一個 Agent 處理元件重構，另一個處理 API 測試
- 開發者可繼續編碼的同時監控 Agent 進度

---

## Artifacts 系統

Antigravity 的 Agent 會產出可驗證的 **Artifacts**：

| Artifact 類型 | 說明 |
|---------------|------|
| Implementation Plans | 實作計畫 |
| Task Lists | 任務清單 |
| Code Diffs | 程式碼差異 |
| Test Results | 測試結果 |
| Screenshots | 截圖證據 |

這提供了 AI 生成動作的透明度和可驗證性。

---

## 自主等級設定

Antigravity 提供三種 Agent 自主等級：

| 模式 | 說明 |
|------|------|
| **Always Proceed** | Agent 自動執行所有動作，無需人工核准 |
| **Agent Decides** | Agent 自行判斷哪些步驟需要人工核准 |
| **Request Review** | 每個重要動作都暫停等待用戶核准 |

---

## 終端指令執行策略

| 策略 | 說明 |
|------|------|
| **Off** | Agent 永不自動執行終端指令，每次都需許可 |
| **Auto** | Agent 決定何時自動執行，必要時詢問（推薦預設） |
| **Turbo** | Agent 總是自動執行，除了在 Deny List 中的指令 |

可配置 Allow/Deny 列表進行更細緻的控制。

---

## 瀏覽器擴展

Antigravity 使用專用的 **Chrome 瀏覽器擴展** 來擴展 Agent 能力：
- 自動化 UI 測試
- 截圖擷取
- Session 錄製
- DOM 檢視
- 視覺回歸偵測

這使得 Agent 可以編寫程式碼、啟動它，並在瀏覽器中驗證功能。

---

## 擴展生態系統

| 項目 | 說明 |
|------|------|
| **預設市場** | Open VSX Registry（非 VS Marketplace） |
| **VS Code 擴展相容性** | 大部分可用，部分 Microsoft 專屬擴展可能不相容 |
| **安裝方式** | Extensions 視圖搜索，或手動 .vsix 安裝 |
| **市場切換** | 可配置使用 VS Code Marketplace |

---

## 配額與定價

### 目前狀態（2026 年 1 月）
- 公開預覽期間對個人 Gmail 帳號免費
- 提供「generous rate limits」

### 配額計算
- 基於 Agent 執行的「工作量」而非簡單的請求數或程式碼行數
- 複雜的推理任務消耗更多配額
- 「thinking tokens」也計入配額

### 訂閱層級
| 層級 | 配額刷新 |
|------|---------|
| Google AI Pro/Ultra 訂閱者 | 每 5 小時刷新 |
| 免費用戶 | 基於週的限制，防止快速耗盡 |

---

## 相關連結

- 官方網站：https://antigravity.google
- 文件中心：https://antigravity.google/docs
- Open VSX：https://open-vsx.org

---

## 資料來源

本文件資訊整理自以下來源（2025-2026 年）：
- Google 官方部落格
- Wikipedia
- Medium 技術文章
- XDA Developers 報導
- Codecademy 介紹
