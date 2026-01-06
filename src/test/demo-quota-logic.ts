
import { AntigravityUsageProvider } from '../providers/antigravity-usage';
import { Logger } from '../utils/logger';

// Mock Logger
const mockLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
    showOutputChannel: () => { },
    dispose: () => { }
} as unknown as Logger;

// Mock VS Code Configuration
const mockVscode = {
    workspace: {
        getConfiguration: (section: string) => ({
            get: (key: string) => {
                if (key === 'quotaMonitor.visibleModels') return ['Gemini 3 Pro']; // Only show Gemini 3 Pro
                return [];
            }
        })
    }
};

// Inject mock vscode into global scope if needed, 
// but since the provider imports 'vscode', we depend on init-mock.js effectively.
// However, here we will modify the provider instance specifically if possible, 
// or rely on init-mock.js being run before this script.

async function runDemo() {
    console.log('--- Quota Logic Demo ---');

    // Instantiate Provider
    const provider = new AntigravityUsageProvider(mockLogger);

    // Sample Input Data (Mocking API Response Structure)
    const mockApiResponse = {
        userStatus: {
            cascadeModelConfigData: {
                clientModelSorts: [
                    {
                        groups: [
                            { modelLabels: ['Gemini 3 Flash', 'Gemini 3 Pro'] } // Sort Config: Flash first
                        ]
                    }
                ],
                clientModelConfigs: [
                    {
                        label: 'Gemini 3 Pro',
                        modelOrAlias: { model: 'gemini-3-pro' },
                        quotaInfo: { remainingFraction: 0.8, resetTime: new Date(Date.now() + 3600000).toISOString() },
                        supportsImages: true
                    },
                    {
                        label: 'Gemini 3 Flash',
                        modelOrAlias: { model: 'gemini-3-flash' },
                        quotaInfo: { remainingFraction: 0.9, resetTime: new Date(Date.now() + 7200000).toISOString() },
                        supportsImages: true
                    },
                    {
                        label: 'Claude Sonnet 3.5',
                        modelOrAlias: { model: 'claude-sonnet-3.5' },
                        quotaInfo: { remainingFraction: 0.5 },
                        supportsImages: false
                    }
                ]
            }
        }
    };

    console.log('Input Models: Gemini 3 Pro, Gemini 3 Flash, Claude Sonnet 3.5');
    console.log('Sort Config: [Gemini 3 Flash, Gemini 3 Pro]');
    console.log('Filter Config (visibleModels): ["Gemini 3 Pro"] (Wait, we will override this for demo)');

    // Access private method
    const parsedData = (provider as any).parseQuotaResponse(mockApiResponse);

    console.log('\n--- Result ---');
    console.log('Total Models Returned:', parsedData.models.length);
    parsedData.models.forEach((m: any, i: number) => {
        console.log(`[${i}] ${m.displayName} (Remaining: ${m.remainingPercentage}%)`);
    });

    console.log('\nNote: The unit tests use a mocked VS Code environment where visibleModels is empty by default, passing all models.');
    console.log('To test filtering, we rely on the unit test `should filter models`.');
}

runDemo().catch(console.error);
