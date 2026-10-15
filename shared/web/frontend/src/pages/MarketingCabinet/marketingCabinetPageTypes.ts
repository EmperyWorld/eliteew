import type { MarketingCabinetDeepLinkState } from './hooks/useMarketingCabinetNavigation';

export interface ChatTimelineMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
}

export interface CompanyFormState {
	name: string;
	industry: string;
	website: string;
	description: string;
	size: string;
	/** id друга; учитывается только если representativeDeferred ложь */
	representativeUserId: string | null;
	/** «Временно не указано» — представитель не обязателен */
	representativeDeferred: boolean;
}

export interface ProjectFormState {
	name: string;
	description: string;
	goals: string;
	key_tasks: string;
	category: string;
	priority: string;
}

export interface JobStoryFormState {
	title: string;
	situation: string;
	motivation: string;
	outcome: string;
	category: string;
	priority: string;
	importance_score: string;
	satisfaction_score: string;
	tags: string;
}

export interface ValuePropFormState {
	headline: string;
	subheadline: string;
	value_statement: string;
	proof_points: string;
	target_channels: string;
	status: string;
}

export interface SwotManualFormState {
	title: string;
	executive_summary: string;
	strengths: string;
	weaknesses: string;
	opportunities: string;
	threats: string;
}

export interface CompetitorFormState {
	name: string;
	website: string;
	description: string;
	competitor_type: string;
	market_position: string;
	pricing_strategy: string;
	strengths: string;
	weaknesses: string;
}

export interface ResearchFormState {
	title: string;
	research_type: string;
	research_query: string;
	description: string;
	goals: string;
	priority: string;
	status: string;
	result_summary: string;
}

export type MarketingRailSignalTone = 'danger' | 'warning';

export interface MarketingRailSignal {
	count: number;
	tone: MarketingRailSignalTone;
}

export type MarketingCabinetPageProps = {
	/** Состояние из ?mc_*, переданное десктопом; без синхронизации mc_* в адресную строку. */
	desktopConsumedMarketingDeepLink?: MarketingCabinetDeepLinkState | null;
};
