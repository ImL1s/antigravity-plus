# [0.2.0](https://github.com/ImL1s/antigravity-plus/compare/v0.1.0...v0.2.0) (2026-01-10)


### Features

* port and refactor unified auth bar UI from cockpit ([7f1e5b4](https://github.com/ImL1s/antigravity-plus/commit/7f1e5b49b55ec54da6e052efe65e4c87b769dc3f))

# [0.1.0](https://github.com/ImL1s/antigravity-plus/compare/v0.0.37...v0.1.0) (2026-01-09)


### Features

* add auto-wakeup scheduler with daily, weekly, and interval modes ([a88ce10](https://github.com/ImL1s/antigravity-plus/commit/a88ce106c93c771aa53a67fe4cb8c776fa345410))
* complete UI/UX with internationalization and context optimizer ([dba91c3](https://github.com/ImL1s/antigravity-plus/commit/dba91c3bad09a464f64d3024d2c7fd3d2cb41204))
* finalize verification and update setup guide ([f00c02c](https://github.com/ImL1s/antigravity-plus/commit/f00c02c735bd3013498341413b338da3610b0dd9))
* improve session timeline titles with context ([284ef42](https://github.com/ImL1s/antigravity-plus/commit/284ef423ff3bb15700c151cb3fc8ab8f602414df))
* integrate semantic-release for automatic versioning ([28cea35](https://github.com/ImL1s/antigravity-plus/commit/28cea35429c13fd78da46b37014aecd8e6dc0b2a))

# Change Log

## [0.0.37] - 2026-01-08
- chore: migrate to tag-based release workflow (aligned with Cockpit)
- fix: resolve open-vsx publishing issues by using direct ovsx cli

## [0.0.36](https://github.com/ImL1s/antigravity-plus/compare/v0.0.35...v0.0.36) (2026-01-08)


### Bug Fixes

* **ci:** downgrade semantic-release to v24 for stability ([3e2c537](https://github.com/ImL1s/antigravity-plus/commit/3e2c537808517855d4a719cd79aea1428f2023a3))

## [0.0.35](https://github.com/ImL1s/antigravity-plus/compare/v0.0.34...v0.0.35) (2026-01-08)


### Bug Fixes

* verify release pipeline ([48d5d60](https://github.com/ImL1s/antigravity-plus/commit/48d5d607b3d792e9768387cae47a74a9eb571467))

## [0.0.34](https://github.com/ImL1s/antigravity-plus/compare/v0.0.33...v0.0.34) (2026-01-07)


### Bug Fixes

* **ci:** upgrade node version to 22 for semantic-release ([c091eae](https://github.com/ImL1s/antigravity-plus/commit/c091eae7c8928772e88434081996ce7dfcb61111))

## [0.0.33] - 2026-01-07
- **Feature**: Complete Auto Wake-up feature Cockpit (sorting, filtering, sync) and fix reset bug.
- **Feature**: Align dashboard quota monitor with cockpit.

## [0.0.32] - 2026-01-07
- **Feature**: Add backend push-based Dashboard updates.

## [0.0.31] - 2026-01-07
- **Fix**: Resolve 'Resets in: Reset' display bug and add Dashboard auto-refresh.

## [0.0.30] - 2026-01-07
- **Feature**: Add macOS persistent shell alias support to Relauncher.
- **Test**: Add comprehensive unit tests for providers.

## [0.0.29] - 2026-01-07
- **Docs**: Add GEMINI.md and CLAUDE.md with CI/CD instructions.

## [0.0.28] - 2026-01-07
- **Feature**: Implement dynamic server port allocation (start from 3000).

## [0.0.27] - 2026-01-07
- **Feature**: Add 'Reset Session' command to clear user state.

## [0.0.26] - 2026-01-06
- **Fix**: Handle large log files in LogViewProvider.

## [0.0.25] - 2026-01-06
- **UI**: Improve status bar tooltip with detailed model info.

## [0.0.24] - 2026-01-06
- **Feature**: Basic quota monitoring implementation.

## [0.0.23] - 2026-01-06
- **Chore**: Update dependencies and fix security vulnerabilities.

## [0.0.22] - 2026-01-06
- **Feature**: Add configuration for auto-approve behaviors.

## [0.0.21] - 2026-01-06
- **Feature**: Initial implementation of Auto-Approve mechanism.

## [0.0.20] - 2026-01-06
- **Docs**: Update README.md with usage instructions.

## [0.0.19] - 2026-01-06
- **Fix**: Fix typo in command palette registration.

## [0.0.18] - 2026-01-06
- **Feature**: Add 'Open Dashboard' command.

## [0.0.17] - 2026-01-06
- **Refactor**: Split extension.ts into multiple controllers.

## [0.0.16] - 2026-01-06
- **Init**: Project initialization with basic structure.

## [0.0.15]
- Initial release
