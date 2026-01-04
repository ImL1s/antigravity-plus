# ITV Auto-Accept
### Your Hands-Free Productivity Partner for Antigravity

**ITV Auto-Accept** is a premium automation bridge designed for power users of the Antigravity AI Agentic IDE. Built with ❤️ by **iltempovola**, it is part of the **ITV Developer Toolkit**—a collection of utilities aimed at streamlining elite AI development workflows.

[![GitHub stars](https://img.shields.io/github/stars/iltempovola/ITV-Auto-Accept?style=social)](https://github.com/iltempovola/ITV-Auto-Accept)

---

## 🚀 Why use ITV Auto-Accept?

Even with Antigravity's "Always Allow" settings enabled, certain workflows still trigger security confirmation prompts—especially when:
*   **Working on Remote Servers (SSH)**: Frequent directory changes and file checks can create a confirmation bottleneck.
*   **Automated Testing & Multi-Command Scripts**: When your AI agent is executing dozens of background commands in sequence.
*   **Headless Development**: When you want to set the agent a task and walk away, confident that it won't be blocked by a silent confirmation dialog.

**ITV Auto-Accept** bridges this gap, providing a seamless "zero-manual-input" experience for your high-trust projects.

---

## ✨ Key Features
*   **Silent Background Accept**: Uses Windows UI Automation to accept prompts without moving your mouse or stealing focus.
*   **Smart Delay**: Configurable pause (default 1s) lets you see the command before it's automatically approved.
*   **Productivity Stats**: Hover over the status bar to see exactly how many manual clicks you've saved.
*   **Fail-Safe Architecture**: If the silent method is blocked by system permissions, the extension falls back to an intelligent "simulated click" to ensure your workflow never stops.

---

## 🛠️ Quick Start

1.  **Install & Play**: In most cases, it works immediately upon installation.
2.  **Verify**: Look for the `$(eye) ITV: Auto-accept ON` icon in your Status Bar. 
    *   *Click the icon at any time to toggle the service.*
3.  **Requirements**: If the extension detects missing Python libraries, it will offer to install them automatically. (Requires Python 3.x).

---

## ⚙️ Customization

Tailor the extension to your specific workflow in VS Code Settings (`Ctrl+,` search for "ITV"):
*   **Accept Delay**: Adjust how long to wait before clicking (e.g., 0.5s for speed, 3s for more oversight).
*   **Detection Strategy**: 
    *   `UIA (Text Match)`: (Default) Modern, silent, background.
    *   `Image Match`: Legacy mode for specialized themes or high-DPI custom setups.
*   **Button Pattern**: If your IDE uses custom labels (like "Proceed" instead of "Accept"), you can define your own matching rules.

---

## 📝 Troubleshooting & Advanced Setup

If the status bar shows **OFF** or the extension isn't clicking:
*   **Check Logs**: Press `Ctrl+Shift+U` and select **ITV Auto-Accept** from the dropdown. 
*   **Manual Dependency Install**: 
    ```bash
    pip install uiautomation comtypes
    ```
*   **Antigravity Context**: Ensure your Antigravity window is active or visible for the first detection.

---

## 📞 Feedback & Support
We love hearing from our users! 
*   **Success Story?** Drop us a quick "Thank you" at [cervmanufatto+itv@gmail.com](mailto:cervmanufatto+itv@gmail.com).
*   **Issue?** Email us with a brief description and paste your logs from the **ITV Auto-Accept** output terminal.

---
*Built for the iltempovola community.*
