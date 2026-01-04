/**
 * Unit Tests: Status Bar Manager
 * 
 * 覆蓋 Status Bar 的渲染邏輯與狀態更新
 */

import * as assert from 'assert';

// 模擬 StatusBarManager 的核心邏輯 (無需 VS Code 環境)
class StatusBarLogic {
    static getStatusIcon(percent: number): string {
        if (percent >= 50) return '🟢';
        if (percent >= 20) return '🟡';
        return '🔴';
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
            assert.strictEqual(StatusBarLogic.getStatusIcon(100), '🟢');
            assert.strictEqual(StatusBarLogic.getStatusIcon(50), '🟢');
        });

        it('should show yellow for 20-49%', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(49), '🟡');
            assert.strictEqual(StatusBarLogic.getStatusIcon(20), '🟡');
        });

        it('should show red for < 20%', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(19), '🔴');
            assert.strictEqual(StatusBarLogic.getStatusIcon(0), '🔴');
        });

        it('edge cases', () => {
            assert.strictEqual(StatusBarLogic.getStatusIcon(50), '🟢', '50% should be green');
            assert.strictEqual(StatusBarLogic.getStatusIcon(20), '🟡', '20% should be yellow');
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
});
