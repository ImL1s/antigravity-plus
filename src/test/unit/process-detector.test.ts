
import * as assert from 'assert';
import { WindowsStrategy, UnixStrategy } from '../../core/quota-monitor/process-detector';

describe('ProcessDetector Strategy Tests', () => {

    describe('WindowsStrategy', () => {
        let strategy: WindowsStrategy;

        beforeEach(() => {
            strategy = new WindowsStrategy();
        });

        it('should parse valid Windows JSON output correctly', () => {
            const mockOutput = JSON.stringify([
                {
                    ProcessId: 1001,
                    CommandLine: '"C:\\Program Files\\Antigravity\\language_server_windows_x64.exe" --port=1234 --extension_server_port=5678 --csrf_token=abc-123 --app_data_dir antigravity'
                },
                {
                    ProcessId: 1002,
                    CommandLine: 'some-other-process'
                }
            ]);

            const result = strategy.parseProcessInfo(mockOutput);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pid, 1001);
            assert.strictEqual(result[0].extensionPort, 5678);
            assert.strictEqual(result[0].csrfToken, 'abc-123');
        });

        it('should ignore processes without required flags', () => {
            const mockOutput = JSON.stringify([
                {
                    ProcessId: 2001,
                    CommandLine: '"C:\\Program Files\\Antigravity\\ls.exe" --extension_server_port=5678' // Missing csrf_token and app_data_dir
                }
            ]);

            const result = strategy.parseProcessInfo(mockOutput);
            assert.strictEqual(result.length, 0);
        });

        it('should handle flattened JSON output (wmic quirk simulation)', () => {
            // Sometimes wmic/powershell might output weirdly, but our mock is clean JSON.
            // The strategy handles finding '[' or '{'.
            const mockOutput = `
                Some Garbage Header
                [
                    {
                        "ProcessId": 3001,
                        "CommandLine": "ls.exe --extension_server_port=9999 --csrf_token=abc --app_data_dir antigravity"
                    }
                ]
            `;
            const result = strategy.parseProcessInfo(mockOutput);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pid, 3001);
        });
    });

    /*
    describe('UnixStrategy', () => {
        let strategy: UnixStrategy;

        beforeEach(() => {
            strategy = new UnixStrategy('darwin');
        });

        it('should parse ps output correctly (MacOS)', () => {
            // PID PPID ARGS
            const mockOutput = `501   123 /path/to/language_server_darwin_arm64 --extension_server_port=1111 --csrf_token=cafe-123 --app_data_dir antigravity
501   456 /path/to/other_process`;

            const result = strategy.parseProcessInfo(mockOutput);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].pid, 501);
            assert.strictEqual(result[0].extensionPort, 1111);
            assert.strictEqual(result[0].csrfToken, 'cafe-123');
        });

        it('should parse ps output correctly (Linux)', () => {
            strategy = new UnixStrategy('linux');
            const mockOutput = `1001 1000 /usr/bin/language_server_linux_x64 --extension_server_port=2222 --csrf_token=token-2 --app_data_dir antigravity`;
            const result = strategy.parseProcessInfo(mockOutput);

            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].extensionPort, 2222);
        });

        it('should ignore arbitrary processes', () => {
            const mockOutput = `999   888 /bin/bash -c echo hello`;
            const result = strategy.parseProcessInfo(mockOutput);
            assert.strictEqual(result.length, 0);
        });
    });
    */
});
