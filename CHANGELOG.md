## [0.0.35](https://github.com/ImL1s/antigravity-plus/compare/v0.0.34...v0.0.35) (2026-01-08)


### Bug Fixes

* verify release pipeline ([48d5d60](https://github.com/ImL1s/antigravity-plus/commit/48d5d607b3d792e9768387cae47a74a9eb571467))

## [0.0.34](https://github.com/ImL1s/antigravity-plus/compare/v0.0.33...v0.0.34) (2026-01-07)


### Bug Fixes

* **ci:** upgrade node version to 22 for semantic-release ([c091eae](https://github.com/ImL1s/antigravity-plus/commit/c091eae7c8928772e88434081996ce7dfcb61111))

# Change Log

## [0.0.37] - 2026-01-08
- chore: migrate to tag-based release workflow (aligned with Cockpit)
- fix: resolve open-vsx publishing issues by using direct ovsx cli

## [0.0.36] - 2026-01-087
- **Feature**: Complete Auto Wake-up feature Cockpit (sorting, filtering, sync) and fix reset bug.
- **Feature**: Align dashboard quota monitor with cockpit.

## [0.0.32] - 2026-01-07
- **Feature**: Cockpit usage parity for all model usage tracking.

## [0.0.31] - 2026-01-07
- **Feature**: Model identification improvements.

## [0.0.30] - 2026-01-07
- **Feature**: Add backend push-based Dashboard updates.

## [0.0.29] - 2026-01-07
- **Fix**: Resolve 'Resets in: Reset' display bug and add Dashboard auto-refresh.

## [0.0.28] - 2026-01-06
- **Feature**: Add macOS persistent shell alias support to Relauncher and unit tests.

## [0.0.27] - 2026-01-06
- **Test**: Add comprehensive unit tests for providers.

## [0.0.26] - 2026-01-06
- **Fix**: Schedule preview display issues.

## [0.0.25] - 2026-01-06
- **Feature**: Interactive schedule editor for Auto Wake-up.

## [0.0.24] - 2026-01-06
- **Feature**: Auto-wakeup scheduler V3 with advanced scheduling.

## [0.0.23] - 2026-01-05
- **Feature**: Multi-language support for 10 languages.

## [0.0.22] - 2026-01-05
- **Feature**: Impact tracker and enhanced dashboard.

## [0.0.21] - 2026-01-05
- **Chore**: Bump version to fix Open VSX release.

## [0.0.20] - 2026-01-05
- **Docs**: Add GEMINI.md and CLAUDE.md with CI/CD instructions.
- **CI**: Setup semantic-release for automated versioning and publishing.

## [0.0.16-19] - 2026-01-05
- **CI**: Various pipeline fixes for robust vscode mocking and module resolution.

## [0.0.15] - 2026-01-05
- **New Feature**: Smart Wakeup V2 - Intelligent auto-wakeup based on cooldown and user activity.
- **Fix**: Quota Monitor UI - Fixed loading spinner logic and added manual refresh button.
- **Stability**: Achieved 100% passing Unit Tests & E2E Tests with robust CI pipeline.
- **Improvement**: Enhanced Dashboard UI with real-time feedback and CSS animations.

## [0.0.7] - 2026-01-04
- **New Feature**: Added 'Pesosz' strategy for Auto Accept (`antigravity.agent.acceptAgentStep`).
- **Configuration**: Added `antigravity-plus.autoApprove.strategy` setting (Default: `pesosz`).
- **Improvement**: Re-enabled Auto Approve module with the new safe strategy.

## [0.0.6] - 2026-01-04
- **Fix**: Replaced CDP-based Quota Monitor with secure HTTPS API (`process scan`).
- **Fix**: Replaced Auto Wake-up with Cloud API implementation.
- **Security**: Removed all CDP dependencies to prevent crashes.

## [0.0.5] - 2026-01-04
- Temporarily disabled core features to investigate crash issues.

## [0.0.4] - 2026-01-04
- Initial Release on Open VSX.
