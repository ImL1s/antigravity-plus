/**
 * Antigravity Quota Watcher - type definitions
 */

export interface model_config {
	label: string;
	model_or_alias: {
		model: string;
	};
	quota_info?: {
		remaining_fraction?: number;
		reset_time: string;
	};
	supports_images?: boolean;
	is_recommended?: boolean;
	allowed_tiers?: string[];
}

export interface prompt_credits_info {
	available: number;
	monthly: number;
	used_percentage: number;
	remaining_percentage: number;
}

export interface model_quota_info {
	label: string;
	model_id: string;
	remaining_fraction?: number;
	remaining_percentage?: number;
	is_exhausted: boolean;
	reset_time: Date;
	time_until_reset: number;
	time_until_reset_formatted: string;
}

export interface quota_snapshot {
	timestamp: Date;
	prompt_credits?: prompt_credits_info;
	models: model_quota_info[];
}

export enum quota_level {
	Normal = 'normal',
	Warning = 'warning',
	Critical = 'critical',
	Depleted = 'depleted',
}

export type api_method_preference = 'COMMAND_MODEL_CONFIG' | 'GET_USER_STATUS';

export interface config_options {
	enabled: boolean;
	polling_interval: number;
	show_prompt_credits?: boolean;
}

// Server Response Types (Must match external API, usually camelCase or snake_case depending on proto to JSON mapping)
// Based on previous code, it seems the server returns camelCase (e.g. `userStatus`, `planInfo`)
export interface server_user_status_response {
	userStatus: {
		name: string;
		email: string;
		planStatus?: {
			planInfo: {
				teamsTier: string;
				planName: string;
				monthlyPromptCredits: number;
				monthlyFlowCredits: number;
			};
			availablePromptCredits: number;
			availableFlowCredits: number;
		};
		cascadeModelConfigData?: {
			clientModelConfigs: any[]; // will map to model_config manually
		};
	};
}
