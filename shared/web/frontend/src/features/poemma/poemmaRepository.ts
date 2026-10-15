/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Poemma repository with local cache + server-first sync for desktop runtime.
 * One instance per Empery userId.
 *
 * Invariants:
 * - UI never reads Poemma localStorage directly.
 * - Server sync status is observable for explicit UX states (online/fallback/degraded).
 * - Storage keys: poemma:v1:{userId}:*
 * - Saved periods are normalized to 90 days and may contain at most one active period.
 *
 * Related:
 * - poemma/docs/implementation/API-LOCAL.md
 * - src/features/poemma/poemmaDomain.ts
 * - src/features/poemma/poemmaStorage.ts
 */

import {
	assertSingleActivePoemmaPeriod,
	calculatePoemmaPeriodEndDate,
	canSetPoemmaInitiativeVerdict,
	createDefaultPoemmaCustomerPath,
	normalizePoemmaPeriodDates,
	type PoemmaChannel,
	type PoemmaChurnSnapshot,
	type PoemmaCustomerPath,
	type PoemmaCustomerSegment,
	type PoemmaExperienceBalance,
	type PoemmaFinanceSnapshot,
	type PoemmaHappinessSignal,
	type PoemmaInitiative,
	type PoemmaNpsSnapshot,
	type PoemmaOrgId,
	type PoemmaOrgSettings,
	type PoemmaOrganization,
	type PoemmaPeriod,
	type PoemmaPeriodGoal,
	type PoemmaPeriodReview,
	type PoemmaPromotionAction,
	type PoemmaStrategyAnchor,
	type PoemmaTeamTask,
	type PoemmaUserId,
	type PoemmaUserRole,
	type PoemmaUtmLink,
	createDefaultPoemmaOrgSettings,
} from './poemmaDomain';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient } from '@/services/api/client';
import { buildPoemmaExperienceBalance } from './happiness/poemmaExperience';
import { buildDefaultPoemmaChannels } from './promo/poemmaPromoDefaults';
import {
	applyPoemmaStorageBackup,
	buildPoemmaStorageKeys,
	collectPoemmaStorageBackup,
	migrateLegacyPoemmaStorageForUser,
	type PoemmaStorageBackupImportResult,
	type PoemmaStorageBackupPayload,
} from './poemmaStorage';

export interface PoemmaWorkspaceDraft {
	org: PoemmaOrganization;
	period: PoemmaPeriod;
}

export interface PoemmaRepository {
	readonly ownerUserId: PoemmaUserId;
	getOrg(): Promise<PoemmaOrganization | null>;
	saveOrg(org: PoemmaOrganization): Promise<void>;
	initializeWorkspace(input: {
		displayName: string;
		ownerDisplayName: string;
	}): Promise<PoemmaWorkspaceDraft>;
	getActivePeriod(): Promise<PoemmaPeriod | null>;
	getCurrentPeriod(): Promise<PoemmaPeriod | null>;
	listPeriods(): Promise<PoemmaPeriod[]>;
	savePeriod(period: PoemmaPeriod): Promise<void>;
	activatePeriod(periodId: string): Promise<void>;
	closeActivePeriod(todayIso: string): Promise<PoemmaPeriod>;
	getStrategy(): Promise<PoemmaStrategyAnchor | null>;
	saveStrategy(strategy: PoemmaStrategyAnchor): Promise<void>;
	getPeriodGoal(periodId: string): Promise<PoemmaPeriodGoal | null>;
	savePeriodGoal(goal: PoemmaPeriodGoal): Promise<void>;
	getPeriodReview(periodId: string): Promise<PoemmaPeriodReview | null>;
	savePeriodReview(review: PoemmaPeriodReview): Promise<void>;
	listSegments(orgId: PoemmaOrgId): Promise<PoemmaCustomerSegment[]>;
	saveSegments(
		orgId: PoemmaOrgId,
		segments: PoemmaCustomerSegment[]
	): Promise<void>;
	getFinanceSnapshot(periodId: string): Promise<PoemmaFinanceSnapshot | null>;
	saveFinanceSnapshot(snapshot: PoemmaFinanceSnapshot): Promise<void>;
	listInitiatives(periodId: string): Promise<PoemmaInitiative[]>;
	saveInitiative(initiative: PoemmaInitiative): Promise<void>;
	getCustomerPath(orgId: PoemmaOrgId): Promise<PoemmaCustomerPath>;
	saveCustomerPath(path: PoemmaCustomerPath): Promise<void>;
	getChurnSnapshot(periodId: string): Promise<PoemmaChurnSnapshot | null>;
	saveChurnSnapshot(snapshot: PoemmaChurnSnapshot): Promise<void>;
	listChannels(orgId: PoemmaOrgId): Promise<PoemmaChannel[]>;
	saveChannels(orgId: PoemmaOrgId, channels: PoemmaChannel[]): Promise<void>;
	listPromotions(periodId: string): Promise<PoemmaPromotionAction[]>;
	getPromotion(
		periodId: string,
		promotionId: string
	): Promise<PoemmaPromotionAction | null>;
	savePromotion(promotion: PoemmaPromotionAction): Promise<void>;
	listUtmLinks(orgId: PoemmaOrgId): Promise<PoemmaUtmLink[]>;
	saveUtmLink(orgId: PoemmaOrgId, link: PoemmaUtmLink): Promise<void>;
	listTeamTasks(orgId: PoemmaOrgId): Promise<PoemmaTeamTask[]>;
	getTeamTask(
		orgId: PoemmaOrgId,
		taskId: string
	): Promise<PoemmaTeamTask | null>;
	saveTeamTask(task: PoemmaTeamTask): Promise<void>;
	getOrgSettings(): Promise<PoemmaOrgSettings | null>;
	saveOrgSettings(settings: PoemmaOrgSettings): Promise<void>;
	getExperienceBalance(
		orgId: PoemmaOrgId
	): Promise<PoemmaExperienceBalance | null>;
	saveExperienceBalance(balance: PoemmaExperienceBalance): Promise<void>;
	listHappinessSignals(orgId: PoemmaOrgId): Promise<PoemmaHappinessSignal[]>;
	saveHappinessSignal(signal: PoemmaHappinessSignal): Promise<void>;
	deleteHappinessSignal(orgId: PoemmaOrgId, signalId: string): Promise<void>;
	getNpsSnapshot(periodId: string): Promise<PoemmaNpsSnapshot | null>;
	saveNpsSnapshot(snapshot: PoemmaNpsSnapshot): Promise<void>;
	exportStorageBackup(): Promise<PoemmaStorageBackupPayload>;
	importStorageBackup(data: unknown): Promise<PoemmaStorageBackupImportResult>;
	syncFrom1C(): Promise<{ ok: boolean; message: string }>;
}

type PoemmaServerWorkspaceResponse = {
	exists: boolean;
	workspace_id?: string | null;
	owner_user_id?: string | null;
	role: PoemmaUserRole | string;
	org_id?: string | null;
	payload_version: string;
	storage_payload: Record<string, unknown>;
	migrated_from_local: boolean;
	updated_at?: string | null;
};

type PoemmaServerWorkspaceUpsertRequest = {
	storage_payload: Record<string, unknown>;
	payload_version: string;
	org_id?: string | null;
	mutation?: string;
	migrated_from_local?: boolean;
};

const POEMMA_SERVER_WORKSPACE_PATH = '/desktop/poemma/workspace' as const;
const POEMMA_SERVER_IMPORT_BACKUP_PATH =
	'/desktop/poemma/workspace/import-local-backup' as const;
const POEMMA_SERVER_ROLE_PATH = '/desktop/poemma/workspace/role' as const;

const POEMMA_SERVER_SYNC_WRITE_METHODS = new Set<keyof PoemmaRepository>([
	'initializeWorkspace',
	'saveOrg',
	'savePeriod',
	'activatePeriod',
	'closeActivePeriod',
	'saveStrategy',
	'savePeriodGoal',
	'savePeriodReview',
	'saveSegments',
	'saveFinanceSnapshot',
	'saveInitiative',
	'saveCustomerPath',
	'saveChurnSnapshot',
	'saveChannels',
	'savePromotion',
	'saveUtmLink',
	'saveTeamTask',
	'saveOrgSettings',
	'saveExperienceBalance',
	'saveHappinessSignal',
	'deleteHappinessSignal',
	'saveNpsSnapshot',
	'importStorageBackup',
]);

const poemmaRoleCache = new Map<PoemmaUserId, PoemmaUserRole>();
export type PoemmaSyncStage =
	| 'local-only'
	| 'bootstrapping'
	| 'online'
	| 'syncing'
	| 'fallback-local'
	| 'degraded';

export type PoemmaSyncStatus = {
	stage: PoemmaSyncStage;
	message: string | null;
	updatedAt: string;
};

type PoemmaSyncListener = (status: PoemmaSyncStatus) => void;

const poemmaSyncStatusCache = new Map<PoemmaUserId, PoemmaSyncStatus>();
const poemmaSyncStatusListeners = new Map<
	PoemmaUserId,
	Set<PoemmaSyncListener>
>();

function resolvePoemmaSyncDefaultStatus(ownerUserId: string): PoemmaSyncStatus {
	if (!shouldUsePoemmaServerSync(ownerUserId)) {
		return {
			stage: 'local-only',
			message: 'Локальный режим',
			updatedAt: new Date().toISOString(),
		};
	}
	return {
		stage: 'bootstrapping',
		message: 'Подключаем серверный контур',
		updatedAt: new Date().toISOString(),
	};
}

function emitPoemmaSyncStatus(
	ownerUserId: PoemmaUserId,
	stage: PoemmaSyncStage,
	message: string | null
): void {
	const nextStatus: PoemmaSyncStatus = {
		stage,
		message,
		updatedAt: new Date().toISOString(),
	};
	poemmaSyncStatusCache.set(ownerUserId, nextStatus);
	const listeners = poemmaSyncStatusListeners.get(ownerUserId);
	if (!listeners) {
		return;
	}
	for (const listener of listeners) {
		listener(nextStatus);
	}
}

function extractPoemmaSyncErrorMessage(error: unknown): string | null {
	if (!error || typeof error !== 'object') {
		return null;
	}
	const data = (
		error as {
			response?: { data?: { detail?: unknown; error?: unknown } };
			message?: unknown;
		}
	).response?.data;
	if (typeof data?.detail === 'string' && data.detail.trim().length > 0) {
		return data.detail.trim();
	}
	if (typeof data?.error === 'string' && data.error.trim().length > 0) {
		return data.error.trim();
	}
	const message = (error as { message?: unknown }).message;
	if (typeof message === 'string' && message.trim().length > 0) {
		return message.trim();
	}
	return null;
}

export function readPoemmaSyncStatus(
	ownerUserId: PoemmaUserId
): PoemmaSyncStatus {
	const normalized = ownerUserId.trim();
	return (
		poemmaSyncStatusCache.get(normalized) ??
		resolvePoemmaSyncDefaultStatus(normalized)
	);
}

export function subscribePoemmaSyncStatus(
	ownerUserId: PoemmaUserId,
	listener: PoemmaSyncListener
): () => void {
	const normalized = ownerUserId.trim();
	const listeners = poemmaSyncStatusListeners.get(normalized) ?? new Set();
	listeners.add(listener);
	poemmaSyncStatusListeners.set(normalized, listeners);
	listener(readPoemmaSyncStatus(normalized));
	return () => {
		const current = poemmaSyncStatusListeners.get(normalized);
		if (!current) {
			return;
		}
		current.delete(listener);
		if (current.size === 0) {
			poemmaSyncStatusListeners.delete(normalized);
		}
	};
}

function normalizePoemmaServerRole(value: unknown): PoemmaUserRole | null {
	if (typeof value !== 'string') {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	if (
		normalized === 'owner' ||
		normalized === 'team' ||
		normalized === 'manager' ||
		normalized === 'smm' ||
		normalized === 'production'
	) {
		return normalized;
	}
	return null;
}

function shouldUsePoemmaServerSync(ownerUserId: string): boolean {
	if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
		return false;
	}
	return (
		ownerUserId.trim().length > 0 && ownerUserId.trim() !== 'legacy-unscoped'
	);
}

function resolvePoemmaOrgIdFromEntries(
	entries: Record<string, unknown>
): string | undefined {
	const orgEntry = Object.entries(entries).find(([key]) =>
		key.endsWith(':org')
	);
	if (!orgEntry) {
		return undefined;
	}
	const value = orgEntry[1];
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const orgId = (value as { id?: unknown }).id;
	return typeof orgId === 'string' && orgId.trim().length > 0
		? orgId.trim()
		: undefined;
}

async function fetchPoemmaServerWorkspace(): Promise<PoemmaServerWorkspaceResponse> {
	const response = await apiClient.get<PoemmaServerWorkspaceResponse>(
		POEMMA_SERVER_WORKSPACE_PATH,
		API_OPTIONS
	);
	return response.data;
}

async function putPoemmaServerWorkspace(
	body: PoemmaServerWorkspaceUpsertRequest
): Promise<PoemmaServerWorkspaceResponse> {
	const response = await apiClient.put<PoemmaServerWorkspaceResponse>(
		POEMMA_SERVER_WORKSPACE_PATH,
		body,
		API_OPTIONS
	);
	return response.data;
}

async function importPoemmaServerBackup(body: {
	backup: PoemmaStorageBackupPayload;
}): Promise<PoemmaServerWorkspaceResponse> {
	const response = await apiClient.post<PoemmaServerWorkspaceResponse>(
		POEMMA_SERVER_IMPORT_BACKUP_PATH,
		body,
		API_OPTIONS
	);
	return response.data;
}

async function patchPoemmaServerRole(
	role: PoemmaUserRole
): Promise<PoemmaServerWorkspaceResponse> {
	const response = await apiClient.patch<PoemmaServerWorkspaceResponse>(
		POEMMA_SERVER_ROLE_PATH,
		{ role },
		API_OPTIONS
	);
	return response.data;
}

function rememberPoemmaRole(ownerUserId: PoemmaUserId, role: unknown): void {
	const normalized = normalizePoemmaServerRole(role);
	if (normalized) {
		poemmaRoleCache.set(ownerUserId, normalized);
	}
}

export function readCachedPoemmaRole(
	ownerUserId: PoemmaUserId
): PoemmaUserRole | null {
	return poemmaRoleCache.get(ownerUserId) ?? null;
}

export async function refreshPoemmaRoleFromServer(
	ownerUserId: PoemmaUserId
): Promise<PoemmaUserRole | null> {
	if (!shouldUsePoemmaServerSync(ownerUserId)) {
		return null;
	}
	try {
		const response = await fetchPoemmaServerWorkspace();
		rememberPoemmaRole(ownerUserId, response.role);
		emitPoemmaSyncStatus(
			ownerUserId,
			'online',
			'Роль синхронизирована с сервером'
		);
		return readCachedPoemmaRole(ownerUserId);
	} catch (error) {
		const detail = extractPoemmaSyncErrorMessage(error);
		emitPoemmaSyncStatus(
			ownerUserId,
			'degraded',
			detail ?? 'Не удалось обновить роль с сервера'
		);
		return readCachedPoemmaRole(ownerUserId);
	}
}

export async function updatePoemmaRoleOnServer(
	ownerUserId: PoemmaUserId,
	role: PoemmaUserRole
): Promise<PoemmaUserRole | null> {
	if (!shouldUsePoemmaServerSync(ownerUserId)) {
		return role;
	}
	try {
		const response = await patchPoemmaServerRole(role);
		rememberPoemmaRole(ownerUserId, response.role);
		emitPoemmaSyncStatus(ownerUserId, 'online', 'Роль обновлена на сервере');
		return readCachedPoemmaRole(ownerUserId);
	} catch (error) {
		const detail = extractPoemmaSyncErrorMessage(error);
		emitPoemmaSyncStatus(
			ownerUserId,
			'degraded',
			detail ?? 'Не удалось обновить роль на сервере'
		);
		return readCachedPoemmaRole(ownerUserId);
	}
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function createPoemmaId(prefix: string): string {
	return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function readJson<T>(key: string): T | null {
	const raw = localStorage.getItem(key);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as T;
}

function writeJson<T>(key: string, value: T): void {
	localStorage.setItem(key, JSON.stringify(value));
}

function readArray<T>(key: string): T[] {
	return readJson<T[]>(key) ?? [];
}

function sortPoemmaPeriods(periods: PoemmaPeriod[]): PoemmaPeriod[] {
	return [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function createDefaultPoemmaOrganization(
	ownerUserId: PoemmaUserId,
	input: { displayName: string; ownerDisplayName: string }
): PoemmaOrganization {
	return {
		id: createPoemmaId('org'),
		ownerUserId,
		displayName: input.displayName,
		niche: '',
		geo: '',
		ownerDisplayName: input.ownerDisplayName,
		createdAt: new Date().toISOString(),
	};
}

function createDraftPoemmaPeriod(
	orgId: PoemmaOrgId,
	startDate = todayIso()
): PoemmaPeriod {
	return {
		id: createPoemmaId('period'),
		orgId,
		startDate,
		endDate: calculatePoemmaPeriodEndDate(startDate),
		status: 'draft',
	};
}

class LocalPoemmaRepository implements PoemmaRepository {
	readonly ownerUserId: PoemmaUserId;
	private readonly storageKeys: ReturnType<typeof buildPoemmaStorageKeys>;

	constructor(ownerUserId: PoemmaUserId) {
		this.ownerUserId = ownerUserId;
		this.storageKeys = buildPoemmaStorageKeys(ownerUserId);
		migrateLegacyPoemmaStorageForUser(ownerUserId);
	}

	private assertOrgOwner(org: PoemmaOrganization): void {
		if (org.ownerUserId !== this.ownerUserId) {
			throw new Error('Poemma: org не принадлежит текущему пользователю');
		}
	}

	async getOrg(): Promise<PoemmaOrganization | null> {
		const org = readJson<PoemmaOrganization>(this.storageKeys.org);
		if (!org) {
			return null;
		}
		if (org.ownerUserId !== this.ownerUserId) {
			return null;
		}
		return org;
	}

	async saveOrg(org: PoemmaOrganization): Promise<void> {
		this.assertOrgOwner(org);
		writeJson(this.storageKeys.org, org);
	}

	async initializeWorkspace(input: {
		displayName: string;
		ownerDisplayName: string;
	}): Promise<PoemmaWorkspaceDraft> {
		const existingOrg = await this.getOrg();
		if (existingOrg) {
			const currentPeriod =
				(await this.getCurrentPeriod()) ??
				createDraftPoemmaPeriod(existingOrg.id);
			await this.savePeriod(currentPeriod);
			return { org: existingOrg, period: currentPeriod };
		}

		const org = createDefaultPoemmaOrganization(this.ownerUserId, input);
		const period = createDraftPoemmaPeriod(org.id);
		await this.saveOrg(org);
		await this.savePeriod(period);
		return { org, period };
	}

	async getActivePeriod(): Promise<PoemmaPeriod | null> {
		const periods = await this.listPeriods();
		return periods.find((period) => period.status === 'active') ?? null;
	}

	async getCurrentPeriod(): Promise<PoemmaPeriod | null> {
		const periods = await this.listPeriods();
		return (
			periods.find((period) => period.status === 'active') ?? periods[0] ?? null
		);
	}

	async listPeriods(): Promise<PoemmaPeriod[]> {
		const periods = readArray<PoemmaPeriod>(this.storageKeys.periods).map(
			normalizePoemmaPeriodDates
		);
		assertSingleActivePoemmaPeriod(periods);
		return sortPoemmaPeriods(periods);
	}

	async savePeriod(period: PoemmaPeriod): Promise<void> {
		const normalized = normalizePoemmaPeriodDates(period);
		const nextPeriods = sortPoemmaPeriods([
			...readArray<PoemmaPeriod>(this.storageKeys.periods).filter(
				(item) => item.id !== period.id
			),
			normalized,
		]);
		assertSingleActivePoemmaPeriod(nextPeriods);
		writeJson(this.storageKeys.periods, nextPeriods);
	}

	async activatePeriod(periodId: string): Promise<void> {
		const periods = await this.listPeriods();
		const nextPeriods = periods.map((period) => {
			if (period.id === periodId && period.status === 'draft') {
				return { ...period, status: 'active' as const };
			}
			if (period.status === 'active') {
				return { ...period, status: 'draft' as const };
			}
			return period;
		});
		assertSingleActivePoemmaPeriod(nextPeriods);
		writeJson(this.storageKeys.periods, sortPoemmaPeriods(nextPeriods));
	}

	async closeActivePeriod(todayStartIso: string): Promise<PoemmaPeriod> {
		const periods = await this.listPeriods();
		const activePeriod = periods.find((period) => period.status === 'active');
		if (!activePeriod) {
			throw new Error('Нет активного периода');
		}

		const draftPeriod = createDraftPoemmaPeriod(
			activePeriod.orgId,
			todayStartIso
		);
		const closedPeriods = periods.map((period) =>
			period.id === activePeriod.id
				? { ...period, status: 'closed' as const }
				: period
		);
		writeJson(
			this.storageKeys.periods,
			sortPoemmaPeriods([...closedPeriods, draftPeriod])
		);
		return draftPeriod;
	}

	async getStrategy(): Promise<PoemmaStrategyAnchor | null> {
		return readJson<PoemmaStrategyAnchor>(this.storageKeys.strategy);
	}

	async saveStrategy(strategy: PoemmaStrategyAnchor): Promise<void> {
		writeJson(this.storageKeys.strategy, strategy);
	}

	async getPeriodGoal(periodId: string): Promise<PoemmaPeriodGoal | null> {
		return readJson<PoemmaPeriodGoal>(this.storageKeys.goal(periodId));
	}

	async savePeriodGoal(goal: PoemmaPeriodGoal): Promise<void> {
		writeJson(this.storageKeys.goal(goal.periodId), goal);
	}

	async getPeriodReview(periodId: string): Promise<PoemmaPeriodReview | null> {
		return readJson<PoemmaPeriodReview>(this.storageKeys.review(periodId));
	}

	async savePeriodReview(review: PoemmaPeriodReview): Promise<void> {
		writeJson(this.storageKeys.review(review.periodId), review);
	}

	async listSegments(orgId: PoemmaOrgId): Promise<PoemmaCustomerSegment[]> {
		return readArray<PoemmaCustomerSegment>(this.storageKeys.segments(orgId));
	}

	async saveSegments(
		orgId: PoemmaOrgId,
		segments: PoemmaCustomerSegment[]
	): Promise<void> {
		writeJson(this.storageKeys.segments(orgId), segments);
	}

	async getFinanceSnapshot(
		periodId: string
	): Promise<PoemmaFinanceSnapshot | null> {
		return readJson<PoemmaFinanceSnapshot>(this.storageKeys.finance(periodId));
	}

	async saveFinanceSnapshot(snapshot: PoemmaFinanceSnapshot): Promise<void> {
		writeJson(this.storageKeys.finance(snapshot.periodId), snapshot);
	}

	async listInitiatives(periodId: string): Promise<PoemmaInitiative[]> {
		return readArray<PoemmaInitiative>(this.storageKeys.initiatives(periodId));
	}

	async saveInitiative(initiative: PoemmaInitiative): Promise<void> {
		if (!canSetPoemmaInitiativeVerdict(initiative)) {
			throw new Error('Вердикт идеи требует комментарий');
		}

		const existing = await this.listInitiatives(initiative.periodId);
		writeJson(this.storageKeys.initiatives(initiative.periodId), [
			...existing.filter((item) => item.id !== initiative.id),
			initiative,
		]);
	}

	async getCustomerPath(orgId: PoemmaOrgId): Promise<PoemmaCustomerPath> {
		const stored = readJson<PoemmaCustomerPath>(
			this.storageKeys.customerPath(orgId)
		);
		if (stored?.stages?.length) {
			return stored;
		}
		return createDefaultPoemmaCustomerPath(orgId);
	}

	async saveCustomerPath(path: PoemmaCustomerPath): Promise<void> {
		writeJson(this.storageKeys.customerPath(path.orgId), {
			...path,
			updatedAt: new Date().toISOString(),
		});
	}

	async getChurnSnapshot(
		periodId: string
	): Promise<PoemmaChurnSnapshot | null> {
		return readJson<PoemmaChurnSnapshot>(this.storageKeys.churn(periodId));
	}

	async saveChurnSnapshot(snapshot: PoemmaChurnSnapshot): Promise<void> {
		writeJson(this.storageKeys.churn(snapshot.periodId), {
			...snapshot,
			updatedAt: new Date().toISOString(),
		});
	}

	async listChannels(orgId: PoemmaOrgId): Promise<PoemmaChannel[]> {
		const stored = readArray<PoemmaChannel>(this.storageKeys.channels(orgId));
		if (stored.length > 0) {
			return stored;
		}
		const defaults = buildDefaultPoemmaChannels(orgId);
		await this.saveChannels(orgId, defaults);
		return defaults;
	}

	async saveChannels(
		orgId: PoemmaOrgId,
		channels: PoemmaChannel[]
	): Promise<void> {
		writeJson(this.storageKeys.channels(orgId), channels);
	}

	async listPromotions(periodId: string): Promise<PoemmaPromotionAction[]> {
		return readArray<PoemmaPromotionAction>(
			this.storageKeys.promotions(periodId)
		);
	}

	async getPromotion(
		periodId: string,
		promotionId: string
	): Promise<PoemmaPromotionAction | null> {
		const promotions = await this.listPromotions(periodId);
		return promotions.find((item) => item.id === promotionId) ?? null;
	}

	async savePromotion(promotion: PoemmaPromotionAction): Promise<void> {
		const existing = await this.listPromotions(promotion.periodId);
		writeJson(this.storageKeys.promotions(promotion.periodId), [
			...existing.filter((item) => item.id !== promotion.id),
			promotion,
		]);
	}

	async listUtmLinks(orgId: PoemmaOrgId): Promise<PoemmaUtmLink[]> {
		return readArray<PoemmaUtmLink>(this.storageKeys.utmLinks(orgId));
	}

	async saveUtmLink(orgId: PoemmaOrgId, link: PoemmaUtmLink): Promise<void> {
		const existing = await this.listUtmLinks(orgId);
		writeJson(this.storageKeys.utmLinks(orgId), [
			...existing.filter((item) => item.id !== link.id),
			link,
		]);
	}

	async listTeamTasks(orgId: PoemmaOrgId): Promise<PoemmaTeamTask[]> {
		return readArray<PoemmaTeamTask>(this.storageKeys.teamTasks(orgId));
	}

	async getTeamTask(
		orgId: PoemmaOrgId,
		taskId: string
	): Promise<PoemmaTeamTask | null> {
		const tasks = await this.listTeamTasks(orgId);
		return tasks.find((task) => task.id === taskId) ?? null;
	}

	async saveTeamTask(task: PoemmaTeamTask): Promise<void> {
		const title = task.title.trim();
		if (!title) {
			throw new Error('Название задачи обязательно');
		}

		const existing = await this.listTeamTasks(task.orgId);
		const nextTask: PoemmaTeamTask = { ...task, title };
		writeJson(this.storageKeys.teamTasks(task.orgId), [
			...existing.filter((item) => item.id !== task.id),
			nextTask,
		]);
	}

	async getOrgSettings(): Promise<PoemmaOrgSettings | null> {
		const org = await this.getOrg();
		if (!org) {
			return null;
		}

		const stored = readJson<PoemmaOrgSettings>(
			this.storageKeys.orgSettings(org.id)
		);
		if (stored && stored.orgId === org.id) {
			return stored;
		}

		return createDefaultPoemmaOrgSettings(org);
	}

	async getExperienceBalance(
		orgId: PoemmaOrgId
	): Promise<PoemmaExperienceBalance | null> {
		return readJson<PoemmaExperienceBalance>(
			this.storageKeys.experience(orgId)
		);
	}

	async saveExperienceBalance(balance: PoemmaExperienceBalance): Promise<void> {
		const settings = await this.getOrgSettings();
		const thresholdPercent =
			settings?.experienceBalanceThresholdPercent ??
			createDefaultPoemmaOrgSettings({
				id: balance.orgId,
				ownerUserId: this.ownerUserId,
				displayName: '',
				niche: '',
				geo: '',
				ownerDisplayName: '',
				createdAt: '',
			}).experienceBalanceThresholdPercent;

		const normalized = buildPoemmaExperienceBalance({
			orgId: balance.orgId,
			employeeScore: balance.employeeScore,
			clientScore: balance.clientScore,
			measuredAt: balance.measuredAt,
			thresholdPercent,
		});
		writeJson(this.storageKeys.experience(balance.orgId), normalized);
	}

	async listHappinessSignals(
		orgId: PoemmaOrgId
	): Promise<PoemmaHappinessSignal[]> {
		const signals = readArray<PoemmaHappinessSignal>(
			this.storageKeys.happinessSignals(orgId)
		);
		return [...signals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	async saveHappinessSignal(signal: PoemmaHappinessSignal): Promise<void> {
		const text = signal.text.trim();
		if (!text) {
			throw new Error('Текст отзыва обязателен');
		}

		const nextSignal: PoemmaHappinessSignal = { ...signal, text };
		const existing = await this.listHappinessSignals(signal.orgId);
		writeJson(this.storageKeys.happinessSignals(signal.orgId), [
			...existing.filter((item) => item.id !== signal.id),
			nextSignal,
		]);
	}

	async deleteHappinessSignal(
		orgId: PoemmaOrgId,
		signalId: string
	): Promise<void> {
		const existing = await this.listHappinessSignals(orgId);
		writeJson(
			this.storageKeys.happinessSignals(orgId),
			existing.filter((item) => item.id !== signalId)
		);
	}

	async saveOrgSettings(settings: PoemmaOrgSettings): Promise<void> {
		const org = await this.getOrg();
		if (!org) {
			throw new Error('Сначала создайте бизнес');
		}
		if (settings.orgId !== org.id) {
			throw new Error('Настройки не совпадают с организацией');
		}
		if (
			settings.experienceBalanceThresholdPercent <= 0 ||
			settings.experienceBalanceThresholdPercent > 100
		) {
			throw new Error('Порог опыта: от 1 до 100%');
		}

		writeJson(this.storageKeys.orgSettings(org.id), settings);
	}

	async getNpsSnapshot(periodId: string): Promise<PoemmaNpsSnapshot | null> {
		return readJson<PoemmaNpsSnapshot>(this.storageKeys.nps(periodId));
	}

	async saveNpsSnapshot(snapshot: PoemmaNpsSnapshot): Promise<void> {
		writeJson(this.storageKeys.nps(snapshot.periodId), snapshot);
	}

	async exportStorageBackup(): Promise<PoemmaStorageBackupPayload> {
		return collectPoemmaStorageBackup(this.ownerUserId);
	}

	async importStorageBackup(
		data: unknown
	): Promise<PoemmaStorageBackupImportResult> {
		return applyPoemmaStorageBackup(data, this.ownerUserId);
	}

	async syncFrom1C(): Promise<{ ok: boolean; message: string }> {
		return { ok: false, message: 'Подключите 1С в настройках (v1)' };
	}
}

class PoemmaServerSyncAdapter {
	private readonly ownerUserId: PoemmaUserId;
	private bootstrapPromise: Promise<void> | null = null;
	private syncQueue: Promise<void> = Promise.resolve();

	constructor(ownerUserId: PoemmaUserId) {
		this.ownerUserId = ownerUserId;
		emitPoemmaSyncStatus(
			this.ownerUserId,
			'bootstrapping',
			'Подключаем серверный контур'
		);
	}

	async ensureBootstrapped(): Promise<void> {
		if (!shouldUsePoemmaServerSync(this.ownerUserId)) {
			return;
		}
		if (this.bootstrapPromise) {
			return this.bootstrapPromise;
		}
		this.bootstrapPromise = this.bootstrapFromServer();
		return this.bootstrapPromise;
	}

	private async bootstrapFromServer(): Promise<void> {
		try {
			emitPoemmaSyncStatus(
				this.ownerUserId,
				'bootstrapping',
				'Загружаем данные из сервера'
			);
			const remote = await fetchPoemmaServerWorkspace();
			rememberPoemmaRole(this.ownerUserId, remote.role);
			const remoteEntries = remote.storage_payload ?? {};
			const hasRemoteEntries = Object.keys(remoteEntries).length > 0;
			if (remote.exists && hasRemoteEntries) {
				const restoreResult = applyPoemmaStorageBackup(
					{
						version: remote.payload_version || 'v1',
						userId: this.ownerUserId,
						exportedAt: new Date().toISOString(),
						entries: remoteEntries,
					},
					this.ownerUserId
				);
				if (!restoreResult.ok) {
					console.warn(
						'[POEMMA] server bootstrap skipped:',
						restoreResult.message
					);
					emitPoemmaSyncStatus(
						this.ownerUserId,
						'degraded',
						`Серверный снимок повреждён: ${restoreResult.message}`
					);
					return;
				}
				emitPoemmaSyncStatus(
					this.ownerUserId,
					'online',
					'Серверный контур подключён'
				);
				return;
			}

			const localBackup = collectPoemmaStorageBackup(this.ownerUserId);
			if (Object.keys(localBackup.entries).length === 0) {
				emitPoemmaSyncStatus(
					this.ownerUserId,
					'online',
					'Серверный контур подключён'
				);
				return;
			}
			emitPoemmaSyncStatus(
				this.ownerUserId,
				'syncing',
				'Переносим локальный архив на сервер'
			);
			const imported = await importPoemmaServerBackup({ backup: localBackup });
			rememberPoemmaRole(this.ownerUserId, imported.role);
			emitPoemmaSyncStatus(
				this.ownerUserId,
				'online',
				'Локальный архив перенесён на сервер'
			);
		} catch (error) {
			console.warn(
				'[POEMMA] server bootstrap unavailable, fallback local:',
				error
			);
			const detail = extractPoemmaSyncErrorMessage(error);
			emitPoemmaSyncStatus(
				this.ownerUserId,
				'fallback-local',
				detail ?? 'Сервер недоступен, продолжаем в локальном режиме'
			);
		}
	}

	async enqueueSnapshotSync(mutation: string): Promise<void> {
		if (!shouldUsePoemmaServerSync(this.ownerUserId)) {
			return;
		}
		const task = this.syncQueue
			.catch(() => undefined)
			.then(async () => {
				emitPoemmaSyncStatus(
					this.ownerUserId,
					'syncing',
					'Сохраняем изменения на сервере'
				);
				try {
					const backup = collectPoemmaStorageBackup(this.ownerUserId);
					const response = await putPoemmaServerWorkspace({
						storage_payload: backup.entries,
						payload_version: backup.version,
						org_id: resolvePoemmaOrgIdFromEntries(backup.entries),
						mutation,
					});
					rememberPoemmaRole(this.ownerUserId, response.role);
					emitPoemmaSyncStatus(
						this.ownerUserId,
						'online',
						'Данные синхронизированы'
					);
				} catch (error) {
					console.warn('[POEMMA] server sync failed, keep local cache:', error);
					const detail = extractPoemmaSyncErrorMessage(error);
					emitPoemmaSyncStatus(
						this.ownerUserId,
						'degraded',
						detail ??
							'Сервер не подтвердил сохранение, оставили локальный черновик'
					);
				}
			});
		this.syncQueue = task;
		return task;
	}
}

function createServerSyncedPoemmaRepository(
	ownerUserId: PoemmaUserId,
	localRepository: LocalPoemmaRepository
): PoemmaRepository {
	const syncAdapter = new PoemmaServerSyncAdapter(ownerUserId);
	const repository = new Proxy(localRepository as PoemmaRepository, {
		get(target, property, receiver) {
			const value = Reflect.get(target, property, receiver);
			if (typeof value !== 'function') {
				return value;
			}

			return async (...args: unknown[]) => {
				await syncAdapter.ensureBootstrapped();
				const result = await (
					value as (...innerArgs: unknown[]) => Promise<unknown>
				).apply(target, args);

				const methodName = property as keyof PoemmaRepository;
				if (
					methodName === 'importStorageBackup' &&
					result &&
					typeof result === 'object' &&
					(result as { ok?: unknown }).ok === true
				) {
					await syncAdapter.enqueueSnapshotSync('importStorageBackup');
					return result;
				}

				if (POEMMA_SERVER_SYNC_WRITE_METHODS.has(methodName)) {
					await syncAdapter.enqueueSnapshotSync(String(methodName));
				}
				return result;
			};
		},
	});
	return repository as PoemmaRepository;
}

const repositoryCache = new Map<string, PoemmaRepository>();

export function getPoemmaRepository(
	ownerUserId: PoemmaUserId
): PoemmaRepository {
	const normalized = ownerUserId.trim();
	if (!poemmaSyncStatusCache.has(normalized)) {
		const defaultStatus = resolvePoemmaSyncDefaultStatus(normalized);
		poemmaSyncStatusCache.set(normalized, defaultStatus);
	}
	let repo = repositoryCache.get(normalized);
	if (!repo) {
		const localRepository = new LocalPoemmaRepository(normalized);
		repo = shouldUsePoemmaServerSync(normalized)
			? createServerSyncedPoemmaRepository(normalized, localRepository)
			: localRepository;
		repositoryCache.set(normalized, repo);
	}
	return repo;
}

/** @deprecated Use getPoemmaRepository(user.id) from authenticated PoemmaApp */
export const poemmaRepository = getPoemmaRepository('legacy-unscoped');
