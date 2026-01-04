/**
 * Config Manager Service
 */

import * as vscode from 'vscode';
import {config_options} from '../utils/types';

export class ConfigManager {
	private readonly config_key = 'agQuota';

	/**
	 * Get full config
	 */
	get_config(): config_options {
		const config = vscode.workspace.getConfiguration(this.config_key);
		return {
			enabled: config.get<boolean>('enabled', true),
			polling_interval: Math.max(30, config.get<number>('pollingInterval', 120)) * 1000,
			show_prompt_credits: config.get<boolean>('showPromptCredits', false),
		};
	}

	/**
	 * Listen to config changes
	 */
	on_config_change(callback: (config: config_options) => void): vscode.Disposable {
		return vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(this.config_key)) {
				callback(this.get_config());
			}
		});
	}
}
