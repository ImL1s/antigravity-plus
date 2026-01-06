import * as assert from 'assert';
import * as path from 'path';
import { Relauncher } from '../../core/auto-approve/relauncher';

describe('Unit Tests - Relauncher', () => {
    let mockFs: any;
    let mockOs: any;
    let mockCp: any;
    let mockLogger: any;
    let relauncher: Relauncher;
    let vscodeMock: any;

    beforeEach(() => {
        mockFs = {
            existsSync: () => false,
            mkdirSync: () => { },
            readFileSync: () => '',
            writeFileSync: () => { },
            unlinkSync: () => { },
            appendFileSync: () => { }
        };
        mockOs = {
            platform: () => 'linux',
            homedir: () => '/home/user',
            tmpdir: () => '/tmp'
        };
        mockCp = {
            exec: (cmd: string, cb: any) => cb(null, '', ''),
            spawn: () => ({ unref: () => { } })
        };
        mockLogger = {
            info: () => { },
            warn: () => { },
            error: () => { },
            debug: () => { }
        };

        // vscode is globally mocked by setup.ts and init-mock.js
        vscodeMock = require('vscode');
        if (!vscodeMock.env) {
            vscodeMock.env = { appName: 'Visual Studio Code' };
        }

        relauncher = new Relauncher(mockLogger, {
            fs: mockFs,
            os: mockOs,
            cp: mockCp
        });
    });

    describe('IDE Name Detection', () => {
        it('should detect Cursor', () => {
            vscodeMock.env.appName = 'Cursor';
            assert.strictEqual((relauncher as any).getIdeName(), 'Cursor');
        });

        it('should fallback to Code', () => {
            vscodeMock.env.appName = 'VS Code';
            assert.strictEqual((relauncher as any).getIdeName(), 'Code');
        });
    });

    describe('Linux Strategy (.desktop modification)', () => {
        const userAppsDir = '/home/user/.local/share/applications';
        const desktopContent = '[Desktop Entry]\nExec=code %F\n';

        it('should modify existing user .desktop file', async () => {
            mockOs.platform = () => 'linux';
            const userFile = path.join(userAppsDir, 'code.desktop');

            let capturedFile = '';
            let capturedContent = '';

            mockFs.existsSync = (p: string) => p === userFile;
            mockFs.readFileSync = () => desktopContent;
            mockFs.writeFileSync = (p: string, c: string) => {
                capturedFile = p;
                capturedContent = c;
            };

            const result = await (relauncher as any).modifyLinuxShortcut();

            assert.strictEqual(result, true);
            assert.strictEqual(capturedFile, userFile);
            assert.ok(capturedContent.includes('--remote-debugging-port=9000 %F'));
        });

        it('should copy from system to user directory if user file is missing', async () => {
            const systemFile = '/usr/share/applications/code.desktop';
            const userFile = path.join(userAppsDir, 'code.desktop');

            mockFs.existsSync = (p: string) => p === systemFile || p === userAppsDir;
            mockFs.readFileSync = () => desktopContent;

            let capturedFile = '';
            mockFs.writeFileSync = (p: string) => {
                capturedFile = p;
            };

            await (relauncher as any).modifyLinuxShortcut();

            assert.strictEqual(capturedFile, userFile);
        });

        it('should handle Exec line without % placeholders', async () => {
            const rawContent = '[Desktop Entry]\nExec=/usr/bin/code\n';
            mockFs.existsSync = () => true;
            mockFs.readFileSync = () => rawContent;

            let capturedContent = '';
            mockFs.writeFileSync = (p: string, c: string) => {
                capturedContent = c;
            };

            await (relauncher as any).modifyLinuxShortcut();

            assert.ok(capturedContent.includes('Exec=/usr/bin/code --remote-debugging-port=9000'));
        });
    });

    describe('macOS Strategy (Relaunch prompt)', () => {
        it('should trigger relaunch when user chooses to restart', async () => {
            mockOs.platform = () => 'darwin';
            relauncher = new Relauncher(mockLogger, { fs: mockFs, os: mockOs, cp: mockCp });

            vscodeMock.window.showInformationMessage = (msg: string, ...items: string[]) => {
                if (items.includes('立即重啟')) return Promise.resolve('立即重啟');
                return Promise.resolve(undefined);
            };

            let relaunchCalled = false;
            (relauncher as any).relaunch = async () => { relaunchCalled = true; };

            const result = await (relauncher as any).modifyMacOSShortcut();

            assert.strictEqual(result, true);
            assert.strictEqual(relaunchCalled, true);
        });

        it('should append alias to .zshrc', async () => {
            mockOs.platform = () => 'darwin';
            const zshrc = '/home/user/.zshrc';

            let appendedFile = '';
            let appendedContent = '';

            mockFs.existsSync = (p: string) => p === zshrc;
            mockFs.readFileSync = () => 'export PATH=$PATH:/bin\n';
            mockFs.appendFileSync = (p: string, c: string) => {
                appendedFile = p;
                appendedContent = c;
            };

            const result = await (relauncher as any).setupMacOSAlias();

            assert.strictEqual(result, true);
            assert.strictEqual(appendedFile, zshrc);
            assert.ok(appendedContent.includes("alias code='code --remote-debugging-port=9000'"));
        });

        it('should replace existing alias in .zshrc', async () => {
            mockOs.platform = () => 'darwin';
            const zshrc = '/home/user/.zshrc';
            const existing = "alias code='code --something-else'\n";

            let writtenContent = '';
            mockFs.existsSync = (p: string) => p === zshrc;
            mockFs.readFileSync = () => existing;
            mockFs.writeFileSync = (p: string, c: string) => {
                writtenContent = c;
            };

            const result = await (relauncher as any).setupMacOSAlias();

            assert.strictEqual(result, true);
            assert.ok(writtenContent.includes("alias code='code --remote-debugging-port=9000'"));
            assert.ok(!writtenContent.includes('--something-else'));
        });
    });

    describe('Relaunch Command Generation', () => {
        beforeEach(() => {
            vscodeMock.workspace.workspaceFolders = [];
        });

        it('should use open command on macOS', async () => {
            mockOs.platform = () => 'darwin';
            relauncher = new Relauncher(mockLogger, { fs: mockFs, os: mockOs, cp: mockCp });

            let capturedCmd = '';
            let capturedArgs: string[] = [];
            mockCp.spawn = (cmd: string, args: string[]) => {
                capturedCmd = cmd;
                capturedArgs = args;
                return { unref: () => { } };
            };

            await (relauncher as any).relaunch();

            assert.strictEqual(capturedCmd, 'open');
            assert.ok(capturedArgs.includes('--args'));
            assert.ok(capturedArgs.includes('--remote-debugging-port=9000'));
        });

        it('should use execPath on Linux', async () => {
            mockOs.platform = () => 'linux';
            relauncher = new Relauncher(mockLogger, { fs: mockFs, os: mockOs, cp: mockCp });

            // const fakeExe = '/bin/vscode';
            // We need to temporarily override process.execPath if possible, 
            // but the code uses process.execPath directly.
            // Since we can't easily override process.execPath in all environments,
            // we just check if it calls spawn with a string (the exe).

            let capturedCmd = '';
            mockCp.spawn = (cmd: string) => {
                capturedCmd = cmd;
                return { unref: () => { } };
            };

            await (relauncher as any).relaunch();

            assert.strictEqual(capturedCmd, process.execPath);
        });
    });
});
