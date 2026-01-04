# Auto-Accept Rules

## Activation
- The extension acts as a background service.
- If the agent detects an 'Antigravity' prompt on the user's screen that requires approval, this tool handles it automatically.
- Do not manually invoke the python script unless debugging; use the VS Code command `antigravity-auto-accept.start`.

## Behavior
- Monitors the screen for an 'Antigravity Accept' button.
- Clicks it automatically.
- Logs the action to the Output Channel.
