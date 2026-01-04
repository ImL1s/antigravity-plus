/**
 * Unit Tests: Status Bar Manager
 * 
 * 覆蓋 Status Bar 的渲染邏輯與狀態更新
 */

import * as assert from 'assert';

// 模擬 StatusBarManager 的核心邏輯 (無需 VS Code 環境)
class StatusBarLogic {
    static getStatusIcon(percent: number): string {
        if (percent >= 50) return String.fromCodePoint(0x1F7E2); // Green
        if (percent >= 20) return String.fromCodePoint(0x1F7E1); // Yellow
        return String.fromCodePoint(0x1F534); // Red
    }

    static formatGroupText(name: string, percent: number, format: string): string {
        const icon = StatusBarLogic.getStatusIcon(percent);
        const shortName = StatusBarLogic.getShortName(name);

        switch (format) {
            case 'icon':
                return icon;
            case 'percentage':
                return `${percent}%`;
            case 'iconPercentage':
                return `${icon} ${percent}%`;
            case 'namePercentage':
                return `${shortName}: ${percent}%`;
            case 'iconNamePercentage':
                return `${icon} ${shortName}: ${percent}%`;
            case 'progressBar':
                return StatusBarLogic.formatProgressBar(percent);
            default:
                return `${icon} ${shortName}: ${percent}%`;
        }
    }

    static getShortName(name: string): string {
        const shortNames: Record<string, string> = {
            'Gemini 3 Pro': 'Pro',
            'Gemini 3 Flash': 'Flash',
            'Gemini Pro': 'Pro',
            'Gemini Flash': 'Flash',
            'Claude Sonnet': 'Sonnet',
            'Claude Opus': 'Opus',
            'GPT-4o': '4o',
            'GPT-4o Mini': '4o-mini'
        };
        return shortNames[name] || name.split(' ').pop() || name;
    }

    static formatProgressBar(percent: number): string {
        const filled = Math.round(percent / 12.5);
        const empty = 8 - filled;
        return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    }
}

describe('Unit Tests - Status Bar Logic', () => {
    describe('getStatusIcon', () => {
        it('should show green for >= 50%', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(100), String.fromCodePoint(0x1F7E2));
            assert.strictEqual(StatusBarLogic.getStatusIcon(50), String.fromCodePoint(0x1F7E2));
        });

        it('should show yellow for 20-49%', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(49), String.fromCodePoint(0x1F7E1));
            assert.strictEqual(StatusBarLogic.getStatusIcon(20), String.fromCodePoint(0x1F7E1));
        });

        it('should show red for < 20%', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(19), String.fromCodePoint(0x1F534));
            assert.strictEqual(StatusBarLogic.getStatusIcon(0), String.fromCodePoint(0x1F534));
        });

        it('edge cases', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(50), String.fromCodePoint(0x1F7E2), '50% should be green');
            assert.strictEqual(StatusBarLogic.getStatusIcon(20), String.fromCodePoint(0x1F7E1), '20% should be yellow');
        });
    });

    describe('getShortName', () => {
        it('should shorten known model names', () => {
            assert.strictEqual(StatusBarLogic.getShortName('Gemini 3 Pro'), 'Pro');
            assert.strictEqual(StatusBarLogic.getShortName('Gemini 3 Flash'), 'Flash');
            assert.strictEqual(StatusBarLogic.getShortName('Claude Sonnet'), 'Sonnet');
            assert.strictEqual(StatusBarLogic.getShortName('GPT-4o'), '4o');
        });

        it('should take last word for unknown names', () => {
            assert.strictEqual(StatusBarLogic.getShortName('Some New Model'), 'Model');
            assert.strictEqual(StatusBarLogic.getShortName('Unknown'), 'Unknown');
        });

        it('should handle empty string', () => {
            assert.strictEqual(StatusBarLogic.getShortName(''), '');
        });
    });

    describe('formatGroupText', () => {
        it('icon format', () => {
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 75, 'icon'), '🟢');
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 25, 'icon'), '🟡');
        });

        it('percentage format', () => {
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 75, 'percentage'), '75%');
        });

        it('iconPercentage format', () => {
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 75, 'iconPercentage'), '🟢 75%');
        });

        it('namePercentage format', () => {
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 75, 'namePercentage'), 'Pro: 75%');
        });

        it('iconNamePercentage format (default)', () => {
            assert.strictEqual(StatusBarLogic.formatGroupText('Gemini Pro', 75, 'iconNamePercentage'), '🟢 Pro: 75%');
        });
    });

    describe('formatProgressBar', () => {
        it('should render progress bar correctly', () => {
            assert.strictEqual(StatusBarLogic.formatProgressBar(100).length, 8);
            assert.strictEqual(StatusBarLogic.formatProgressBar(50).length, 8);
            assert.strictEqual(StatusBarLogic.formatProgressBar(0).length, 8);
        });

        it('edge values', () => {
            assert.strictEqual(StatusBarLogic.formatProgressBar(12.5).length, 8);
        });
    });

    // ========== v0.0.12 新增測試 ==========

    describe('State Management (v0.0.12)', () => {
        // 模擬 StatusBarItem 的狀態
        interface MockStatusBarItem {
            text: string;
            tooltip: string;
            backgroundColor: string | undefined;
        }

        // 模擬狀態管理邏輯
        class StatusBarStateMock {
            item: MockStatusBarItem = { text: '', tooltip: '', backgroundColor: undefined };

            setLoading(text?: string): void {
                this.item.text = `$(sync~spin) ${text || 'Loading...'}`;
                this.item.backgroundColor = undefined;
            }

            setReady(): void {
                this.item.text = `$(rocket) Ready`;
                this.item.backgroundColor = undefined;
            }

            setError(message: string): void {
                this.item.text = `$(error) Error`;
                this.item.tooltip = message;
                this.item.backgroundColor = 'errorBackground';
            }

            setOffline(): void {
                this.item.text = `$(error) Offline`;
                this.item.backgroundColor = 'warningBackground';
            }
        }

        it('setLoading should show spinner icon', () => {
            const mock = new StatusBarStateMock();
            mock.setLoading();
            assert.ok(mock.item.text.includes('$(sync~spin)'));
            assert.ok(mock.item.text.includes('Loading'));
        });

        it('setLoading with custom text', () => {
            const mock = new StatusBarStateMock();
            mock.setLoading('連線中...');
            assert.ok(mock.item.text.includes('連線中'));
        });

        it('setReady should show rocket icon', () => {
            const mock = new StatusBarStateMock();
            mock.setReady();
            assert.ok(mock.item.text.includes('$(rocket)'));
            assert.ok(mock.item.text.includes('Ready'));
        });

        it('setError should show error icon and store message', () => {
            const mock = new StatusBarStateMock();
            mock.setError('Connection failed');
            assert.ok(mock.item.text.includes('$(error)'));
            assert.strictEqual(mock.item.tooltip, 'Connection failed');
            assert.strictEqual(mock.item.backgroundColor, 'errorBackground');
        });

        it('setOffline should show warning background', () => {
            const mock = new StatusBarStateMock();
            mock.setOffline();
            assert.ok(mock.item.text.includes('Offline'));
            assert.strictEqual(mock.item.backgroundColor, 'warningBackground');
        });
    });

    describe('updateQuota Logic (v0.0.12)', () => {
        // 模擬配額更新邏輯
        interface MockModel {
            name: string;
            displayName: string;
            percentage: number;
        }

        function buildQuotaText(models: MockModel[], format: string, maxModels: number = 3): string {
            const displayModels = models.slice(0, maxModels);
            const parts: string[] = [];

            for (const model of displayModels) {
                const remaining = 100 - model.percentage;
                const icon = StatusBarLogic.getStatusIcon(remaining);
                const shortName = StatusBarLogic.getShortName(model.displayName);

                switch (format) {
                    case 'icon':
                        parts.push(icon);
                        break;
                    case 'percentage':
                        parts.push(`${remaining}%`);
                        break;
                    case 'iconNamePercentage':
                    default:
                        parts.push(`${icon} ${shortName}: ${remaining}%`);
                        break;
                }
            }

            return parts.join(' | ');
        }

        it('should format single model correctly', () => {
            const models = [{ name: 'pro', displayName: 'Gemini 3 Pro', percentage: 25 }];
            const result = buildQuotaText(models, 'iconNamePercentage');
            assert.strictEqual(result, '🟢 Pro: 75%');
        });

        it('should format multiple models with separator', () => {
            const models = [
                { name: 'pro', displayName: 'Gemini 3 Pro', percentage: 25 },
                { name: 'flash', displayName: 'Gemini 3 Flash', percentage: 60 }
            ];
            const result = buildQuotaText(models, 'iconNamePercentage');
            assert.strictEqual(result, '🟢 Pro: 75% | 🟡 Flash: 40%');
        });

        it('should limit to maxModels', () => {
            const models = [
                { name: 'pro', displayName: 'Pro', percentage: 10 },
                { name: 'flash', displayName: 'Flash', percentage: 20 },
                { name: 'sonnet', displayName: 'Sonnet', percentage: 30 },
                { name: 'opus', displayName: 'Opus', percentage: 40 }
            ];
            const result = buildQuotaText(models, 'percentage', 3);
            assert.strictEqual(result.split(' | ').length, 3);
        });

        it('should show correct icons based on remaining percentage', () => {
            const models = [
                { name: 'high', displayName: 'High', percentage: 10 },   // 90% remaining → green
                { name: 'mid', displayName: 'Mid', percentage: 70 },    // 30% remaining → yellow
                { name: 'low', displayName: 'Low', percentage: 95 }     // 5% remaining → red
            ];
            const result = buildQuotaText(models, 'iconNamePercentage');
            assert.ok(result.includes('🟢 High: 90%'));
            assert.ok(result.includes('🟡 Mid: 30%'));
            assert.ok(result.includes('🔴 Low: 5%'));
        });

        it('should handle empty models array', () => {
            const result = buildQuotaText([], 'iconNamePercentage');
            assert.strictEqual(result, '');
        });
    });

    describe('Tooltip Generation (v0.0.12)', () => {
        interface MockModel {
            displayName: string;
            percentage: number;
            resetTime?: Date;
        }

        function buildTooltipLines(models: MockModel[]): string[] {
            const lines: string[] = ['**🚀 Antigravity Plus - Quota Monitor**', ''];
            lines.push('| Model | Remaining | Reset |');
            lines.push('| :--- | :--- | :--- |');

            for (const model of models) {
                const remaining = 100 - model.percentage;
                const icon = StatusBarLogic.getStatusIcon(remaining);
                const resetTime = model.resetTime
                    ? model.resetTime.toLocaleTimeString()
                    : '-';
                lines.push(`| ${icon} **${model.displayName}** | ${remaining}% | ${resetTime} |`);
            }

            return lines;
        }

        it('should generate markdown table header', () => {
            const models = [{ displayName: 'Test', percentage: 50 }];
            const lines = buildTooltipLines(models);
            assert.ok(lines.some(l => l.includes('| Model | Remaining | Reset |')));
        });

        it('should include all models in table', () => {
            const models = [
                { displayName: 'Pro', percentage: 10 },
                { displayName: 'Flash', percentage: 20 }
            ];
            const lines = buildTooltipLines(models);
            assert.ok(lines.some(l => l.includes('**Pro**')));
            assert.ok(lines.some(l => l.includes('**Flash**')));
        });

        it('should show reset time when available', () => {
            const testDate = new Date('2026-01-04T12:00:00');
            const models = [{ displayName: 'Pro', percentage: 10, resetTime: testDate }];
            const lines = buildTooltipLines(models);
            const modelLine = lines.find(l => l.includes('**Pro**'));
            assert.ok(modelLine, 'Model line should exist');
            assert.ok(!modelLine!.includes(' - |'), 'Should not show dash for reset time');
        });

        it('should show dash when no reset time', () => {
            const models = [{ displayName: 'Pro', percentage: 10 }];
            const lines = buildTooltipLines(models);
            const modelLine = lines.find(l => l.includes('**Pro**'));
            assert.ok(modelLine);
            assert.ok(modelLine!.includes('| - |'));
        });
    });
});
