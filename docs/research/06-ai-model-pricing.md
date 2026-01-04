# AI 模型定價與 Token 資訊

## Gemini 模型系列 (Google)

### Gemini 3 Pro
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 1M tokens |
| **輸入價格** | ~$1.25 / 1M tokens |
| **輸出價格** | ~$5.00 / 1M tokens |
| **備註** | Antigravity 預設模型 |

### Gemini 3 Flash
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 1M tokens |
| **輸入價格** | ~$0.075 / 1M tokens |
| **輸出價格** | ~$0.30 / 1M tokens |
| **備註** | 快速、低成本選項 |

---

## Claude 模型系列 (Anthropic)

### Claude 3.5 Sonnet
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 200K tokens |
| **輸入價格** | $3.00 / 1M tokens |
| **輸出價格** | $15.00 / 1M tokens |
| **備註** | 平衡性能與成本 |

### Claude 3 Opus
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 200K tokens |
| **輸入價格** | $15.00 / 1M tokens |
| **輸出價格** | $75.00 / 1M tokens |
| **備註** | 最強能力，高成本 |

### Claude 3 Haiku
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 200K tokens |
| **輸入價格** | $0.25 / 1M tokens |
| **輸出價格** | $1.25 / 1M tokens |
| **備註** | 最快速、最低成本 |

---

## GPT 模型系列 (OpenAI)

### GPT-4 Turbo
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 128K tokens |
| **輸入價格** | $10.00 / 1M tokens |
| **輸出價格** | $30.00 / 1M tokens |

### GPT-4o
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 128K tokens |
| **輸入價格** | $5.00 / 1M tokens |
| **輸出價格** | $15.00 / 1M tokens |

### GPT-4o-mini
| 項目 | 數值 |
|------|------|
| **上下文視窗** | 128K tokens |
| **輸入價格** | $0.15 / 1M tokens |
| **輸出價格** | $0.60 / 1M tokens |
| **備註** | 極低成本選項 |

---

## Antigravity 配額系統

### 免費層級
| 項目 | 說明 |
|------|------|
| **計費方式** | 免費（公開預覽期間） |
| **配額計算** | 基於「工作量」而非簡單請求數 |
| **刷新週期** | 每週刷新 |
| **備註** | 複雜推理任務消耗更多配額 |

### Google AI Pro/Ultra 訂閱
| 項目 | 說明 |
|------|------|
| **配額** | 更高的限制 |
| **刷新週期** | 每 5 小時刷新 |
| **優先級** | 更高的請求優先級 |

---

## API 速率限制

### Gemini API (一般)
| 層級 | RPM | TPM | RPD |
|------|-----|-----|-----|
| Free Tier | 15 | 1M | 1,500 |
| Tier 1 | 60 | 4M | 10,000 |
| Tier 2 | 1,000 | 10M | 100,000 |
| Tier 3 | 10,000+ | 100M+ | 1,000,000+ |

*RPM = Requests Per Minute, TPM = Tokens Per Minute, RPD = Requests Per Day*

---

## Token 計算方式

### 什麼是 Token？
- Token 是 AI 模型處理文字的基本單位
- 約 4 個英文字元 = 1 個 token
- 約 1.5 個中文字 = 1 個 token（因編碼不同）

### Token 計算工具

#### tiktoken (OpenAI)
```bash
npm install tiktoken
# 或
npm install js-tiktoken
```

```typescript
import { encoding_for_model } from 'tiktoken';

const enc = encoding_for_model('gpt-4');
const tokens = enc.encode('Hello, world!');
console.log(tokens.length); // Token 數量
```

#### Anthropic
API 回應中直接包含 `input_tokens` 和 `output_tokens`

#### Google Gemini
使用 `@google/generative-ai` SDK 的 `countTokens` 方法

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
const result = await model.countTokens('Hello, world!');
console.log(result.totalTokens);
```

---

## 成本計算公式

```typescript
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number
): number {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  return inputCost + outputCost;
}

// 範例：使用 Gemini 3 Pro
// 輸入 10,000 tokens，輸出 5,000 tokens
const cost = calculateCost(10000, 5000, 1.25, 5.0);
// = (10000/1000000 * 1.25) + (5000/1000000 * 5.0)
// = 0.0125 + 0.025
// = $0.0375
```

---

## 資料來源

⚠️ **注意：價格可能隨時變動，請參考各家官方定價頁面**

- Google AI Studio: https://ai.google.dev/pricing
- Anthropic: https://www.anthropic.com/pricing
- OpenAI: https://openai.com/pricing
- Antigravity: https://antigravity.google

*本文件最後更新：2026-01-04*
