/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domain contracts and invariants for the local Poemma desktop app MVP.
 * Mirrors `poemma/docs/implementation/domain-model.ts` without agency-marketing entities.
 *
 * Invariants:
 * - Periods are rolling 90-day windows, never calendar quarters.
 * - Profit is the primary metric for the owner map.
 * - Initiative verdicts require a non-empty note.
 *
 * Related:
 * - poemma/docs/implementation/domain-model.ts
 * - poemma/docs/architecture/marketing-cabinet-spec.md
 */

export type PoemmaOrgId = string;
export type PoemmaPeriodId = string;
export type PoemmaUserId = string;
export type PoemmaInitiativeId = string;
export type PoemmaTaskId = string;
export type PoemmaChannelId = string;
export type PoemmaPromotionId = string;
export type PoemmaUtmLinkId = string;

export type PoemmaUserRole =
	| 'owner'
	| 'team'
	| 'manager'
	| 'smm'
	| 'production';

export interface PoemmaOrganization {
	id: PoemmaOrgId;
	/** Empery SSO user id — tenant isolation (STRATEGY-PIVOT-platform-users) */
	ownerUserId: PoemmaUserId;
	displayName: string;
	niche: string;
	geo: string;
	ownerDisplayName: string;
	createdAt: string;
}

export type PoemmaPeriodStatus = 'draft' | 'active' | 'closed';

export interface PoemmaPeriod {
	id: PoemmaPeriodId;
	orgId: PoemmaOrgId;
	startDate: string;
	endDate: string;
	status: PoemmaPeriodStatus;
	name?: string;
}

export const POEMMA_PERIOD_DURATION_DAYS = 90;

export interface PoemmaStrategyAnchor {
	orgId: PoemmaOrgId;
	vision: string;
	mission: string;
	values: string[];
	utp: string;
	teamUnderstood?: boolean;
	updatedAt: string;
	updatedBy: PoemmaUserId;
}

export type PoemmaPrimaryMetricType =
	| 'profit'
	| 'sales_units'
	| 'revenue'
	| 'custom';

export interface PoemmaPeriodGoal {
	periodId: PoemmaPeriodId;
	primaryMetricType: PoemmaPrimaryMetricType;
	primaryMetricLabel: string;
	targetProfit?: number;
}

/** QUARTERLY_REVIEW — итоги скользящих 90 дней (§15, P-606) */
export interface PoemmaPeriodReview {
	periodId: PoemmaPeriodId;
	profitPlan?: number;
	profitFact?: number;
	whatWorked: string;
	whatFailed: string;
	decisions: [string, string, string];
	publishedToTeam: boolean;
	closedAt?: string;
}

export interface PoemmaCustomerSegment {
	id: string;
	orgId: PoemmaOrgId;
	name: string;
	sharePercent: number;
	note?: string;
}

export type PoemmaDataSource = 'manual' | '1c' | 'import';
export type PoemmaDataConfidence = 'fact' | 'assumption';

export interface PoemmaFinanceSnapshot {
	id: string;
	periodId: PoemmaPeriodId;
	revenue?: number;
	profit?: number;
	salesUnits?: number;
	marketplaceNote?: string;
	source: PoemmaDataSource;
	confidence: PoemmaDataConfidence;
	syncedAt: string;
	/** Server-derived on saveFinanceSnapshot upsert; preferred over local recomputation. */
	planPercent?: number | null;
	planStatus?: 'empty' | 'below' | 'ok' | null;
}

export interface PoemmaExperienceBalance {
	orgId: PoemmaOrgId;
	employeeScore: number;
	clientScore: number;
	measuredAt: string;
	inBalance: boolean;
}

export type PoemmaHappinessSignalType =
	| 'review'
	| 'complaint'
	| 'recommendation'
	| 'repeat_purchase';

export interface PoemmaHappinessSignal {
	id: string;
	orgId: PoemmaOrgId;
	type: PoemmaHappinessSignalType;
	text: string;
	segmentId?: string;
	createdAt: string;
}

export interface PoemmaNpsSnapshot {
	id: string;
	periodId: PoemmaPeriodId;
	month: string;
	score: number;
	responsesCount: number;
	source: PoemmaDataSource;
}

export type PoemmaInitiativeStatus = 'backlog' | 'testing' | 'decided';
export type PoemmaVerdict = 'go' | 'iterate' | 'stop';

export interface PoemmaInitiative {
	id: PoemmaInitiativeId;
	periodId: PoemmaPeriodId;
	title: string;
	story: string;
	source?: string;
	segmentId?: string;
	status: PoemmaInitiativeStatus;
	verdict?: PoemmaVerdict;
	verdictNote?: string;
}

export type PoemmaChannelStatus = 'dormant' | 'active' | 'paused';

export type PoemmaChannelType =
	| 'yandex'
	| 'vk'
	| 'marketplace'
	| 'site'
	| 'partner';

export interface PoemmaChannel {
	id: PoemmaChannelId;
	orgId: PoemmaOrgId;
	type: PoemmaChannelType;
	status: PoemmaChannelStatus;
	budgetAvailable?: number;
	lastActivityNote?: string;
}

export type PoemmaPromotionStatus = 'draft' | 'live' | 'ended';

export interface PoemmaPromotionChecklist {
	siteOk: boolean;
	productionOk: boolean;
	legalOk: boolean;
	utmOk: boolean;
	salesOwnerOk: boolean;
}

export const POEMMA_PROMOTION_CHECKLIST_TOTAL = 5;

export const POEMMA_EMPTY_PROMOTION_CHECKLIST: PoemmaPromotionChecklist = {
	siteOk: false,
	productionOk: false,
	legalOk: false,
	utmOk: false,
	salesOwnerOk: false,
};

export interface PoemmaPromotionAction {
	id: PoemmaPromotionId;
	periodId: PoemmaPeriodId;
	channelId: PoemmaChannelId;
	initiativeId?: PoemmaInitiativeId;
	name: string;
	status: PoemmaPromotionStatus;
	budget?: number;
	checklist: PoemmaPromotionChecklist;
}

export interface PoemmaUtmLink {
	id: PoemmaUtmLinkId;
	promotionId?: PoemmaPromotionId;
	baseUrl: string;
	utmSource: string;
	utmMedium: string;
	utmCampaign: string;
	utmContent?: string;
	generatedUrl: string;
}

export type PoemmaTeamTaskStatus = 'todo' | 'waiting_owner' | 'done';

export interface PoemmaTeamTask {
	id: PoemmaTaskId;
	orgId: PoemmaOrgId;
	title: string;
	assigneeId?: PoemmaUserId;
	dueDate?: string;
	status: PoemmaTeamTaskStatus;
	linkType?: 'initiative' | 'promotion' | 'utp' | 'strategy' | 'none';
	linkId?: string;
}

export const POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT = 5;

export interface PoemmaOrgSettings {
	orgId: PoemmaOrgId;
	experienceBalanceThresholdPercent: number;
	orgDisplayName: string;
}

export function createDefaultPoemmaOrgSettings(
	org: PoemmaOrganization
): PoemmaOrgSettings {
	return {
		orgId: org.id,
		experienceBalanceThresholdPercent:
			POEMMA_DEFAULT_EXPERIENCE_BALANCE_THRESHOLD_PERCENT,
		orgDisplayName: org.displayName,
	};
}

export interface PoemmaAlignmentItem {
	key: 'vision' | 'mission' | 'utp' | 'goal' | 'team_understood';
	label: string;
	done: boolean;
}

export const poemmaPeriodTransitions: Record<
	PoemmaPeriodStatus,
	PoemmaPeriodStatus[]
> = {
	draft: ['active'],
	active: ['closed'],
	closed: [],
};

export function computePoemmaInBalance(
	employee: number,
	client: number,
	thresholdPercent: number
): boolean {
	if (employee === 0 && client === 0) {
		return false;
	}

	const avg = (employee + client) / 2;
	const diff = Math.abs(employee - client);
	return avg === 0 ? false : (diff / avg) * 100 <= thresholdPercent;
}

export function buildPoemmaAlignmentChecklist(
	strategy: Partial<PoemmaStrategyAnchor>,
	goal: Partial<PoemmaPeriodGoal>,
	teamUnderstood: boolean
): PoemmaAlignmentItem[] {
	return [
		{ key: 'vision', label: 'Видение', done: !!strategy.vision?.trim() },
		{ key: 'mission', label: 'Миссия', done: !!strategy.mission?.trim() },
		{ key: 'utp', label: 'УТП', done: !!strategy.utp?.trim() },
		{
			key: 'goal',
			label: 'Цель 90 дней',
			done: goal.primaryMetricType === 'profit' && (goal.targetProfit ?? 0) > 0,
		},
		{ key: 'team_understood', label: 'Команда поняла', done: teamUnderstood },
	];
}

export function canActivatePoemmaPeriod(goal: PoemmaPeriodGoal): boolean {
	return goal.primaryMetricType === 'profit' && (goal.targetProfit ?? 0) > 0;
}

export function addPoemmaDaysIsoDate(startDate: string, days: number): string {
	const date = new Date(`${startDate}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function calculatePoemmaPeriodEndDate(startDate: string): string {
	return addPoemmaDaysIsoDate(startDate, POEMMA_PERIOD_DURATION_DAYS);
}

export function normalizePoemmaPeriodDates(period: PoemmaPeriod): PoemmaPeriod {
	return {
		...period,
		endDate: calculatePoemmaPeriodEndDate(period.startDate),
	};
}

export function assertSingleActivePoemmaPeriod(periods: PoemmaPeriod[]): void {
	const activeCount = periods.filter(
		(period) => period.status === 'active'
	).length;
	if (activeCount > 1) {
		throw new Error('Активный период может быть только один');
	}
}

export function canSetPoemmaInitiativeVerdict(
	initiative: PoemmaInitiative
): boolean {
	return !initiative.verdict || !!initiative.verdictNote?.trim();
}

export function poemmaSegmentShareTotal(
	segments: PoemmaCustomerSegment[]
): number {
	return segments.reduce((sum, segment) => sum + segment.sharePercent, 0);
}

/** Customer path — новый → постоянный (wireframes §7, domain-model CustomerPathStage) */
export interface PoemmaCustomerPathStage {
	id: string;
	order: number;
	name: string;
	note?: string;
	reached?: boolean;
}

export interface PoemmaCustomerPath {
	orgId: PoemmaOrgId;
	stages: PoemmaCustomerPathStage[];
	/** Точка боли между «Купил» и «Повтор» */
	painNote?: string;
	updatedAt: string;
}

/** Ручной MVP оттока за период (до синхр 1С) */
export interface PoemmaChurnSnapshot {
	periodId: PoemmaPeriodId;
	churnPerMonth?: number;
	source: PoemmaDataSource;
	updatedAt: string;
}

export const POEMMA_DEFAULT_CUSTOMER_PATH_STAGE_NAMES = [
	'Узнал',
	'Выбрал',
	'Купил',
	'Повтор',
	'Рекомендует',
] as const;

export function createDefaultPoemmaCustomerPathStages(): PoemmaCustomerPathStage[] {
	return POEMMA_DEFAULT_CUSTOMER_PATH_STAGE_NAMES.map((name, index) => ({
		id: `stage-${index + 1}`,
		order: index + 1,
		name,
		reached: false,
	}));
}

export function createDefaultPoemmaCustomerPath(
	orgId: PoemmaOrgId,
	nowIso = new Date().toISOString()
): PoemmaCustomerPath {
	return {
		orgId,
		stages: createDefaultPoemmaCustomerPathStages(),
		updatedAt: nowIso,
	};
}

export function poemmaCustomerPathPainLabel(
	stages: PoemmaCustomerPathStage[]
): string | null {
	const bought = stages.find((stage) => stage.name === 'Купил');
	const repeat = stages.find((stage) => stage.name === 'Повтор');
	if (!bought || !repeat) {
		return null;
	}
	return `между «${bought.name}» и «${repeat.name}»`;
}

export function poemmaInitiativeStatusLabel(
	status: PoemmaInitiativeStatus
): string {
	switch (status) {
		case 'backlog':
			return 'очередь';
		case 'testing':
			return 'проверяем';
		case 'decided':
			return 'решено';
		default:
			return status;
	}
}
