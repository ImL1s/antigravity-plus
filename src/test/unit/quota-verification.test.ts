
import * as assert from 'assert';
import { calculateCountdown } from '../../core/quota-monitor/countdown';
import { t } from '../../i18n';

describe('Quota Verification Tests', () => {

    describe('calculateCountdown (Real Implementation)', () => {
        it('should return "Ready" when timer is expired', () => {
            const past = new Date(Date.now() - 1000);
            const result = calculateCountdown(past);

            // This confirms our fix: it should NOT return "Reset"
            assert.strictEqual(result.text, 'Ready');
            assert.strictEqual(result.isExpired, true);
        });

        it('should return countdown text when timer is future', () => {
            const future = new Date(Date.now() + 3600000); // +1 hour
            const result = calculateCountdown(future);

            assert.strictEqual(result.isExpired, false);
            assert.ok(result.text.includes('1h'));
        });
    });

});
