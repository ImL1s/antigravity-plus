<p align="center">
  <img src="https://github.com/ImL1s/antigravity-plus/raw/main/assets/banner.png" alt="Antigravity Plus Banner" width="100%">
</p>

<h1 align="center">⚡ Antigravity Plus</h1>

<p align="center">
  <strong>The Ultimate VS Code Extension for Antigravity Power Users</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#contributing">Contributing</a> •
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-1.85+-blue.svg" alt="VS Code">
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/github/license/ImL1s/antigravity-plus" alt="License">
  <img src="https://img.shields.io/github/actions/workflow/status/ImL1s/antigravity-plus/ci.yml" alt="CI">
</p>

---

> **⚠️ Maintenance status (2026-08)**: This extension is **no longer actively maintained** (last release: 2026-01). It was built against the Antigravity IDE's webview via CDP; **compatibility with Antigravity 2.0 (May 2026) is unverified**. It remains published on Open VSX and existing installs keep working, but there is no maintenance plan. Note that Antigravity 2.0 / CLI now natively remember approved permissions per conversation (permission memory + allowlists) and expose quota via `/quota` — most of this extension's functionality overlaps with those native features.

---

## ✨ Features

### 🚀 Auto Accept
Automatically approve AI-suggested operations with intelligent safety rules.

- **200ms Ultra-low Latency** - Instant response for seamless workflow
- **Smart Safety Rules** - Hardcoded protection against dangerous commands (`rm -rf /`, `format c:`, etc.)
- **Customizable Allow/Deny Lists** - Fine-tune what gets auto-approved
- **Circuit Breaker** - Automatic protection when errors are detected
- **Impact Dashboard** - Track clicks saved and time recovered

### 📊 Quota Monitor
Real-time monitoring of your AI model usage quotas.

- **Multi-Model Support** - Gemini, Claude, GPT and more
- **Customizable Groups** - Organize models into logical groups
- **6 Display Formats** - From minimal icons to detailed progress bars
- **Countdown Timer** - Know exactly when your quota resets
- **Status Bar Integration** - Always visible, never intrusive

### ⏰ Auto Wake-up
Never miss your quota reset with intelligent scheduling.

- **Daily Scheduling** - Automatic wake-up at optimal times
- **Dual Mode** - VS Code resident + System Task Scheduler
- **Smart Optimization** - Calculates best wake-up time based on history
- **Execution History** - Track all wake-up events

### 🌍 Multi-language Support
Full internationalization with 8 languages:
- English, 繁體中文, 简体中文, 日本語, 한국어, Español, Français, Deutsch

---

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Antigravity Plus"
4. Click Install

### From VSIX
```bash
code --install-extension antigravity-plus-x.x.x.vsix
```

### From Source
```bash
git clone https://github.com/ImL1s/antigravity-plus.git
cd antigravity-plus
npm install
npm run compile
```

---

## 🚀 Usage

### Quick Start

1. **Enable Auto Accept**: Click the Status Bar item or use `Ctrl+Shift+P` → "Antigravity Plus: Toggle Auto Approve"

2. **View Quota**: Check your quota in the Status Bar, click to open Dashboard

3. **Configure Wake-up**: 
   - Open Settings → Antigravity Plus → Auto Wake-up
   - Set `OAuth Setup` with your Google Cloud Client ID & Secret (**Required**)
   - Toggle "Auto Wake-up" monitoring

### Commands

| Command | Description |
|---------|-------------|
| `Antigravity Plus: Toggle Auto Approve` | Enable/disable auto-accept |
| `Antigravity Plus: Open Dashboard` | Open the main dashboard |
| `Antigravity Plus: Refresh Quota` | Manually refresh quota data |
| `Antigravity Plus: Reset Session` | Reset session statistics |
| `Antigravity Plus: Show Logs` | Open the output log |

---

## ⚙️ Configuration

```json
{
  // Auto Approve
  "antigravity-plus.autoApprove.enabled": true,
  "antigravity-plus.autoApprove.denyList": ["npm publish", "git push --force"],
  "antigravity-plus.autoApprove.allowList": ["npm install", "npm run dev"],
  
  // Quota Monitor
  "antigravity-plus.quotaMonitor.enabled": true,
  "antigravity-plus.quotaMonitor.pollInterval": 30000,
  "antigravity-plus.quotaMonitor.displayStyle": "iconNamePercentage",
  
  // Auto Wake-up
  "antigravity-plus.autoWakeup.enabled": false,
  "antigravity-plus.autoWakeup.time": "06:00",
  
  // UI
  "antigravity-plus.ui.language": "auto"
}
```

---

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration
```

**Test Coverage:**
- 106 Unit Tests
- 24 E2E Tests
- 128 Total Tests ✅

---

## 🛡️ Safety Rules

The following commands are **always blocked**:

| Category | Examples |
|----------|----------|
| **System Destruction** | `rm -rf /`, `format c:`, `dd if=/dev/zero` |
| **Fork Bombs** | `:(){:|:&};:` |
| **Permission Abuse** | `chmod -R 777 /` |
| **System Control** | `shutdown`, `reboot` |

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

If this project saved you some time, you can [buy me a coffee](https://buymeacoffee.com/iml1s).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by [Antigravity Cockpit](https://marketplace.visualstudio.com/items?itemName=example.cockpit)
- Built with ❤️ for the Antigravity community

---

<p align="center">
  Made with ⚡ by <a href="https://github.com/ImL1s">ImL1s</a>
</p>
