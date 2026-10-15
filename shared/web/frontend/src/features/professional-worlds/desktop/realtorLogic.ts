/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure realtor helpers for Professional Worlds UI metrics, default forms, DTO reshaping,
 * PATCH payload assembly, JTBD prompt previews, and recipe selection.
 *
 * Invariants:
 * - Helpers remain side-effect free so frontend tests can cover professional logic without mounting Desktop.
 * - Realtor CRM helpers include deal↔listing (FK via `deal_data.property_id`; unique legacy title inference for display/backfill only), deal↔client linkage, showing/document/communication/buyer-match/task deal resolution, communication log create payload validation, lead/listing/showing/task communication focus helpers, shared CRM follow-up builders, and Overview pulse navigation hints.
 * - `realtorPropertyToCreateDraft` mirrors listing rows into create-shaped drafts without mutating snapshots.
 * - `sortedEnabledRealtorAddonModules` drops `realtor_*` keys whose registry panel is `placeholder` (see `runtimeModuleRegistry.panelKind`).
 *
 * Related:
 * - api.ts
 * - professionalWorldsOpenApi.ts
 * - ProfessionalWorldsApp.tsx
 */

import type { CommunicationLogCreateBody } from './professionalWorldsOpenApi';
import type {
	ProfessionalArtifact,
	ProfessionalClient,
	ProfessionalDeal,
	ProfessionalDealCreate,
	ProfessionalLearningCourse,
	ProfessionalRuntimeAiAction,
	ProfessionalRuntimePhotoPreset,
	ProfessionalRuntimeModule,
	RealtorGenerationTone,
	RealtorProperty,
	RealtorPropertyCreate,
	RealtorPropertyUpdate,
	RealtorShowing,
	RealtorTask,
	RealtorDocument,
	RealtorCommunicationLog,
	RealtorBuyerRequirement,
	RealtorLead,
	ProfessionalWorldsSnapshot,
	SpecialistProfile,
} from './types';
import { PROFESSIONAL_WORLDS_VERTICAL_REALTOR } from './types';
import {
	shouldIncludeDedicatedVerticalAddon,
	sortedEnabledVerticalAddonModules,
} from './verticalModuleLogic';

export const REALTOR_TONES: { id: RealtorGenerationTone; labelKey: string }[] =
	[
		{ id: 'jtbd', labelKey: 'tones.jtbd' },
		{ id: 'investor', labelKey: 'tones.investor' },
		{ id: 'family', labelKey: 'tones.family' },
		{ id: 'rental', labelKey: 'tones.rental' },
		{ id: 'premium', labelKey: 'tones.premium' },
		{ id: 'concise', labelKey: 'tones.concise' },
	];

export const ROLEPLAY_SCENARIOS = [
	'buyer_price_objection',
	'seller_overprice',
	'mortgage_fear',
	'investor_doubt',
] as const;

export function resolveDefaultRealtorPropertyCity(
	profile: SpecialistProfile | null | undefined
): string {
	const fromProfile = profile?.city?.trim();
	return fromProfile && fromProfile.length > 0 ? fromProfile : '';
}

export function createEmptyRealtorProperty(options?: {
	city?: string | null;
}): RealtorPropertyCreate {
	const city = options?.city?.trim() ?? '';
	return {
		title: '',
		property_type: 'apartment',
		deal_type: 'sale',
		city,
		district: '',
		address: '',
		price: null,
		area_m2: null,
		rooms: null,
		floor: null,
		total_floors: null,
		view: '',
		infrastructure: [],
		jtbd_context: {
			trigger_context: '',
			expected_result: '',
			emotional_transformation: '',
			audience_segment: '',
		},
		facts: {},
		status: 'draft',
	};
}

export function enabledRuntimeModuleKeys(
	modules: ProfessionalRuntimeModule[]
): string[] {
	return modules
		.filter((module) => module.is_enabled)
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((module) => module.module_key);
}

export function groupPhotoPresetsByCategory(
	presets: ProfessionalRuntimePhotoPreset[]
): Record<string, ProfessionalRuntimePhotoPreset[]> {
	return presets.reduce<Record<string, ProfessionalRuntimePhotoPreset[]>>(
		(groups, preset) => {
			const category = preset.category || 'enhance';
			groups[category] = [...(groups[category] ?? []), preset];
			return groups;
		},
		{}
	);
}

export function aiActionsForModule(
	actions: ProfessionalRuntimeAiAction[],
	moduleKey: string
): ProfessionalRuntimeAiAction[] {
	return actions
		.filter((action) => action.module_key === moduleKey)
		.sort((a, b) => a.sort_order - b.sort_order);
}

export function normalizeCsvList(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

export function realtorPropertyToCreateDraft(
	property: RealtorProperty
): RealtorPropertyCreate {
	const jtbd = property.jtbd_context ?? {};
	const facts =
		property.facts &&
		typeof property.facts === 'object' &&
		property.facts !== null
			? ({ ...property.facts } as Record<string, unknown>)
			: {};
	return {
		title: property.title,
		property_type: property.property_type,
		deal_type: property.deal_type,
		city: property.city,
		district: property.district ?? '',
		address: property.address ?? '',
		price: property.price ?? null,
		area_m2: property.area_m2 ?? null,
		rooms: property.rooms,
		floor: property.floor,
		total_floors: property.total_floors,
		view: property.view ?? '',
		infrastructure: Array.isArray(property.infrastructure)
			? [...property.infrastructure]
			: [],
		jtbd_context: {
			trigger_context: jtbd.trigger_context ?? '',
			expected_result: jtbd.expected_result ?? '',
			emotional_transformation: jtbd.emotional_transformation ?? '',
			audience_segment: jtbd.audience_segment ?? '',
		},
		facts,
		status: property.status,
	};
}

/** Full realtor listing patch body from the left-column editor (aligned with backend `RealtorPropertyUpdate`). */
export function buildRealtorPropertyPatchPayload(
	draft: RealtorPropertyCreate,
	infrastructureCsv: string
): RealtorPropertyUpdate {
	const districtTrim = draft.district?.trim() ?? '';
	const addressTrim = draft.address?.trim() ?? '';
	const viewTrim = draft.view?.trim() ?? '';
	return {
		title: draft.title,
		property_type: draft.property_type,
		deal_type: draft.deal_type,
		city: draft.city,
		district: districtTrim.length > 0 ? districtTrim : null,
		address: addressTrim.length > 0 ? addressTrim : null,
		price: draft.price,
		area_m2: draft.area_m2,
		rooms: draft.rooms,
		floor: draft.floor ?? null,
		total_floors: draft.total_floors ?? null,
		view: viewTrim.length > 0 ? viewTrim : null,
		infrastructure: normalizeCsvList(infrastructureCsv),
		jtbd_context: draft.jtbd_context,
		facts: draft.facts,
		status: draft.status,
	};
}

/** Whether a deal row is linked to a listing via `deal_data.property_id` only. */
export function resolveDealPropertyId(deal: ProfessionalDeal): string | null {
	const raw = deal.deal_data?.property_id;
	if (typeof raw !== 'string') {
		return null;
	}
	const normalized = raw.trim();
	return normalized || null;
}

/** Infer listing id when exactly one property title appears in the deal title (legacy rows). */
export function inferUniquePropertyIdByDealTitle(
	deal: ProfessionalDeal,
	properties: RealtorProperty[]
): string | null {
	const normalizedTitle = deal.title.trim().toLowerCase();
	if (!normalizedTitle) {
		return null;
	}
	const matches: string[] = [];
	for (const property of properties) {
		const candidate = property.title.trim();
		if (!candidate) {
			continue;
		}
		if (normalizedTitle.includes(candidate.toLowerCase())) {
			matches.push(property.id);
		}
	}
	const unique = [...new Set(matches)];
	return unique.length === 1 ? unique[0] : null;
}

/** FK property_id or unique legacy inference for read-only UI/backfill hints. */
export function resolveEffectiveDealPropertyId(
	deal: ProfessionalDeal,
	properties: RealtorProperty[]
): string | null {
	return (
		resolveDealPropertyId(deal) ??
		inferUniquePropertyIdByDealTitle(deal, properties)
	);
}

/** Unique deal for a showing context (listing + optional client). */
export function findUniqueDealForShowingContext(
	deals: ProfessionalDeal[],
	properties: RealtorProperty[],
	propertyId: string,
	clientId: string | null | undefined
): ProfessionalDeal | null {
	const normalizedPropertyId = propertyId.trim();
	const normalizedClientId = clientId?.trim();
	if (!normalizedPropertyId) {
		return null;
	}
	const candidates = deals.filter((deal) => {
		const dealPropertyId = resolveEffectiveDealPropertyId(deal, properties);
		if (dealPropertyId !== normalizedPropertyId) {
			return false;
		}
		if (normalizedClientId) {
			return deal.client_id === normalizedClientId;
		}
		return true;
	});
	return candidates.length === 1 ? candidates[0] : null;
}

/** Showing deal_id FK or unique inferred match from listing + client. */
export function resolveShowingLinkedDealId(
	showing: Pick<RealtorShowing, 'deal_id' | 'property_id' | 'client_id'>,
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): string | null {
	if (showing.deal_id?.trim()) {
		return showing.deal_id.trim();
	}
	return (
		findUniqueDealForShowingContext(
			deals,
			properties,
			showing.property_id,
			showing.client_id
		)?.id ?? null
	);
}

export type CommunicationLogFocus = {
	relatedType: string;
	relatedId: string;
};

/** Preferred CRM entity for logging communication after a showing (deal → client → listing). */
export function resolveShowingCommunicationFocus(
	showing: Pick<RealtorShowing, 'deal_id' | 'property_id' | 'client_id'>,
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): CommunicationLogFocus {
	const linkedDealId = resolveShowingLinkedDealId(showing, deals, properties);
	if (linkedDealId) {
		return { relatedType: 'deal', relatedId: linkedDealId };
	}
	const clientId = showing.client_id?.trim();
	if (clientId) {
		return { relatedType: 'client', relatedId: clientId };
	}
	return { relatedType: 'property', relatedId: showing.property_id };
}

/** Listing-centric panels log against the selected property row. */
export function resolveListingCommunicationFocus(
	propertyId: string
): CommunicationLogFocus | null {
	const normalized = propertyId.trim();
	if (!normalized) {
		return null;
	}
	return { relatedType: 'property', relatedId: normalized };
}

/** CRM suggested follow-up rows (deal/client next_action) map directly to communication entities. */
export function resolveCrmFollowUpCommunicationFocus(
	item: RealtorCrmFollowUpItem
): CommunicationLogFocus {
	return item.source === 'deal'
		? { relatedType: 'deal', relatedId: item.entityId }
		: { relatedType: 'client', relatedId: item.entityId };
}

/** Stored realtor task FKs: deal → client → property; else infer via linked showing. */
export function resolveTaskCommunicationFocus(
	task: Pick<
		RealtorTask,
		'deal_id' | 'client_id' | 'property_id' | 'showing_id'
	>,
	showings: RealtorShowing[],
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): CommunicationLogFocus | null {
	const dealId = task.deal_id?.trim();
	if (dealId) {
		return { relatedType: 'deal', relatedId: dealId };
	}
	const clientId = task.client_id?.trim();
	if (clientId) {
		return { relatedType: 'client', relatedId: clientId };
	}
	const propertyId = task.property_id?.trim();
	if (propertyId) {
		return { relatedType: 'property', relatedId: propertyId };
	}
	const showingId = task.showing_id?.trim();
	if (!showingId) {
		return null;
	}
	const showing = showings.find((row) => row.id === showingId);
	if (!showing) {
		return null;
	}
	return resolveShowingCommunicationFocus(showing, deals, properties);
}

/** Deals whose effective listing id matches the given property. */
export function findDealsForPropertyId(
	deals: ProfessionalDeal[],
	properties: RealtorProperty[],
	propertyId: string
): ProfessionalDeal[] {
	const normalizedPropertyId = propertyId.trim();
	if (!normalizedPropertyId) {
		return [];
	}
	return deals.filter(
		(deal) =>
			resolveEffectiveDealPropertyId(deal, properties) === normalizedPropertyId
	);
}

/** Unique deal for a listing when exactly one deal references it. */
export function findUniqueDealForPropertyId(
	deals: ProfessionalDeal[],
	properties: RealtorProperty[],
	propertyId: string
): ProfessionalDeal | null {
	const matches = findDealsForPropertyId(deals, properties, propertyId);
	return matches.length === 1 ? matches[0] : null;
}

/** Document deal_id FK or unique deal for the document property. */
export function resolveDocumentLinkedDealId(
	document: Pick<RealtorDocument, 'deal_id' | 'property_id'>,
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): string | null {
	if (document.deal_id?.trim()) {
		return document.deal_id.trim();
	}
	const propertyId = document.property_id?.trim();
	if (!propertyId) {
		return null;
	}
	return findUniqueDealForPropertyId(deals, properties, propertyId)?.id ?? null;
}

export type CommunicationRelatedKind = 'deal' | 'client' | 'property' | 'lead';

/** Normalizes free-form communication log related_type for CRM navigation. */
export function normalizeCommunicationRelatedType(
	relatedType: string | null | undefined
): CommunicationRelatedKind | null {
	const normalized = relatedType?.trim().toLowerCase();
	if (!normalized) {
		return null;
	}
	if (normalized === 'deal' || normalized === 'deals') {
		return 'deal';
	}
	if (normalized === 'client' || normalized === 'clients') {
		return 'client';
	}
	if (
		normalized === 'property' ||
		normalized === 'properties' ||
		normalized === 'listing' ||
		normalized === 'listings'
	) {
		return 'property';
	}
	if (normalized === 'lead' || normalized === 'leads') {
		return 'lead';
	}
	return null;
}

export type CommunicationLogCrmAction =
	| { kind: 'pipeline'; dealId: string }
	| {
			kind: 'clients';
			tab: 'directory';
			filterClientId: string;
	  }
	| { kind: 'properties'; propertyId: string }
	| { kind: 'leads' };

/** Maps a communication log row to a workspace CRM action when related_id is present. */
export function resolveCommunicationLogCrmAction(
	log: Pick<RealtorCommunicationLog, 'related_type' | 'related_id'>
): CommunicationLogCrmAction | null {
	const relatedId = log.related_id?.trim();
	if (!relatedId) {
		return null;
	}
	const kind = normalizeCommunicationRelatedType(log.related_type);
	switch (kind) {
		case 'deal':
			return { kind: 'pipeline', dealId: relatedId };
		case 'client':
			return { kind: 'clients', tab: 'directory', filterClientId: relatedId };
		case 'property':
			return { kind: 'properties', propertyId: relatedId };
		case 'lead':
			return { kind: 'leads' };
		default:
			return null;
	}
}

export type CommunicationRelatedEntityOption = {
	id: string;
	label: string;
};

/** Snapshot-backed pickers for the communication log create form. */
export function listCommunicationRelatedEntityOptions(
	kind: CommunicationRelatedKind,
	snapshot: Pick<ProfessionalWorldsSnapshot, 'deals' | 'clients' | 'properties'>
): CommunicationRelatedEntityOption[] {
	switch (kind) {
		case 'deal':
			return snapshot.deals.map((deal) => ({
				id: deal.id,
				label: deal.title?.trim() || deal.id,
			}));
		case 'client':
			return snapshot.clients.map((client) => ({
				id: client.id,
				label: client.name?.trim() || client.id,
			}));
		case 'property':
			return snapshot.properties.map((property) => ({
				id: property.id,
				label: property.title?.trim() || property.id,
			}));
		case 'lead':
			return [];
	}
}

/** Lead inbox rows for the communication log create form (API-backed, not snapshot). */
export function listCommunicationLeadEntityOptions(
	leads: RealtorLead[]
): CommunicationRelatedEntityOption[] {
	return leads.map((lead) => {
		const name = lead.name?.trim();
		const contact = lead.contact?.trim();
		const status = lead.status?.trim();
		const labelParts = [name, contact, status].filter(Boolean);
		return {
			id: lead.id,
			label: labelParts.length > 0 ? labelParts.join(' · ') : lead.id,
		};
	});
}

/** Validates operator input before POST `/realtor/communication-logs`. */
export function buildCommunicationLogCreatePayload(input: {
	relatedType: string;
	relatedId: string;
	channel: string;
	body: string;
}): CommunicationLogCreateBody | null {
	const relatedType = input.relatedType.trim();
	const channel = input.channel.trim();
	const body = input.body.trim();
	if (!relatedType || !channel || !body) {
		return null;
	}
	const kind = normalizeCommunicationRelatedType(relatedType);
	const relatedId = input.relatedId.trim();
	if (kind && kind !== 'lead' && !relatedId) {
		return null;
	}
	return {
		related_type: relatedType,
		related_id: relatedId || null,
		channel,
		body,
		meta: {},
	};
}

export type RealtorCrmFollowUpItem =
	| { id: string; source: 'deal'; entityId: string; title: string }
	| { id: string; source: 'client'; entityId: string; title: string };

/** Snapshot-derived follow-ups shared by Tasks CRM suggestions and Objections coach. */
export function buildRealtorCrmFollowUpItems(
	deals: ProfessionalDeal[],
	clients: ProfessionalClient[],
	labels: { dealFallback: string; clientFallback: string }
): RealtorCrmFollowUpItem[] {
	return [
		...deals
			.filter((deal) => deal.next_action && deal.stage !== 'closed')
			.map((deal) => ({
				id: `deal-${deal.id}`,
				source: 'deal' as const,
				entityId: deal.id,
				title: deal.next_action ?? deal.title ?? labels.dealFallback,
			})),
		...clients
			.filter((client) => client.next_action)
			.map((client) => ({
				id: `client-${client.id}`,
				source: 'client' as const,
				entityId: client.id,
				title: client.next_action ?? client.name ?? labels.clientFallback,
			})),
	];
}

/** Active (non-closed) deals for objection practice links, newest first. */
export function listActiveDealsForObjectionCoach(
	deals: ProfessionalDeal[],
	limit = 5
): ProfessionalDeal[] {
	return [...deals]
		.filter((deal) => deal.stage !== 'closed')
		.sort((left, right) =>
			(right.updated_at ?? '').localeCompare(left.updated_at ?? '')
		)
		.slice(0, limit);
}

export type BuyerPropertyMatch = {
	requirement: RealtorBuyerRequirement;
	property: RealtorProperty;
	score: number;
};

/** Heuristic buyer↔listing fit score for matcher UI (0–100 scale). */
export function scoreBuyerRequirementProperty(
	requirement: RealtorBuyerRequirement,
	property: RealtorProperty
): number {
	const requirements = requirement.requirements ?? {};
	const rawBudget = requirements.budget_max ?? requirements.max_price;
	const maxBudget =
		typeof rawBudget === 'number' ? rawBudget : Number(rawBudget ?? 0);
	const propertyPrice = Number(property.price ?? 0);
	let score = 0;
	if (!maxBudget || !propertyPrice || propertyPrice <= maxBudget) {
		score += 40;
	}
	if (
		Array.isArray(requirements.districts) &&
		property.district &&
		requirements.districts.includes(property.district)
	) {
		score += 35;
	}
	if (
		typeof requirements.rooms === 'number' &&
		property.rooms === requirements.rooms
	) {
		score += 25;
	}
	return score;
}

/** Classifies snapshot clients for Buyers vs Sellers addon segment filter. */
export function classifyClientSegment(
	client: ProfessionalClient
): 'buyer' | 'seller' {
	if (
		client.budget_from ||
		client.budget_to ||
		(client.preferred_areas?.length ?? 0) > 0
	) {
		return 'buyer';
	}
	return 'seller';
}

/** Top buyer requirement ↔ listing matches for the matcher panel. */
export function rankBuyerPropertyMatches(
	requirements: RealtorBuyerRequirement[],
	properties: RealtorProperty[],
	limitPerRequirement = 2
): BuyerPropertyMatch[] {
	return requirements.flatMap((requirement) =>
		properties
			.map((property) => ({
				property,
				requirement,
				score: scoreBuyerRequirementProperty(requirement, property),
			}))
			.filter((match) => match.score > 0)
			.sort((left, right) => right.score - left.score)
			.slice(0, limitPerRequirement)
	);
}

/** Unique deal for a buyer match (listing+client FK or unique listing). */
export function resolveBuyerMatchLinkedDealId(
	requirement: Pick<RealtorBuyerRequirement, 'client_id'>,
	propertyId: string,
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): string | null {
	const normalizedClientId = requirement.client_id?.trim();
	if (normalizedClientId) {
		return (
			findUniqueDealForShowingContext(
				deals,
				properties,
				propertyId,
				normalizedClientId
			)?.id ?? null
		);
	}
	return findUniqueDealForPropertyId(deals, properties, propertyId)?.id ?? null;
}

export function countDealsNeedingPropertyBackfill(
	deals: ProfessionalDeal[],
	properties: RealtorProperty[]
): number {
	return deals.filter(
		(deal) =>
			!resolveDealPropertyId(deal) &&
			Boolean(inferUniquePropertyIdByDealTitle(deal, properties))
	).length;
}

/** Whether a deal row is linked to a listing (FK in deal_data). */
export function dealLinksProperty(
	deal: ProfessionalDeal,
	property: RealtorProperty
): boolean {
	return resolveDealPropertyId(deal) === property.id;
}

/** Listings with no deal referencing them by effective property id (FK or unique legacy inference). */
export function listPropertiesWithoutDealLink(
	properties: RealtorProperty[],
	deals: ProfessionalDeal[]
): RealtorProperty[] {
	const linkedPropertyIds = new Set(
		deals
			.map((deal) => resolveEffectiveDealPropertyId(deal, properties))
			.filter((propertyId): propertyId is string => Boolean(propertyId))
	);
	return properties.filter((property) => !linkedPropertyIds.has(property.id));
}

/** Resolve linked listing title for a deal row, if any. */
export function resolveDealLinkedPropertyTitle(
	deal: ProfessionalDeal,
	properties: RealtorProperty[]
): string | null {
	const propertyId = resolveEffectiveDealPropertyId(deal, properties);
	if (!propertyId) {
		return null;
	}
	const linked = properties.find((property) => property.id === propertyId);
	return linked?.title?.trim() ? linked.title.trim() : null;
}

export function resolveClientNameById(
	clients: ProfessionalClient[],
	clientId: string | null | undefined
): string | null {
	if (!clientId?.trim()) {
		return null;
	}
	const client = clients.find((item) => item.id === clientId.trim());
	return client?.name?.trim() ? client.name.trim() : null;
}

export function resolveDealLinkedClientName(
	deal: ProfessionalDeal,
	clients: ProfessionalClient[]
): string | null {
	return resolveClientNameById(clients, deal.client_id);
}

export function filterDealsByClientId(
	deals: ProfessionalDeal[],
	clientId: string | null | undefined
): ProfessionalDeal[] {
	const normalizedClientId = clientId?.trim();
	if (!normalizedClientId) {
		return deals;
	}
	return deals.filter((deal) => deal.client_id === normalizedClientId);
}

export function countDealsForClient(
	deals: ProfessionalDeal[],
	clientId: string
): number {
	return filterDealsByClientId(deals, clientId).length;
}

export function isProfessionalDealStage(
	stage: string
): stage is ProfessionalDealStage {
	return (PROFESSIONAL_DEAL_STAGE_OPTIONS as readonly string[]).includes(stage);
}

export const PROFESSIONAL_DEAL_STAGE_OPTIONS = [
	'new',
	'showing',
	'negotiation',
	'closed',
] as const;

export type ProfessionalDealStage =
	(typeof PROFESSIONAL_DEAL_STAGE_OPTIONS)[number];

export function buildProfessionalDealCreatePayload(
	draft: ProfessionalDealCreate,
	options?: { linkedPropertyId?: string | null }
): ProfessionalDealCreate {
	const linkedPropertyId = options?.linkedPropertyId?.trim();
	if (!linkedPropertyId) {
		return draft;
	}
	return {
		...draft,
		deal_data: {
			...draft.deal_data,
			property_id: linkedPropertyId,
		},
	};
}

/** @deprecated Use `shouldIncludeDedicatedVerticalAddon` — kept for existing imports/tests. */
export function shouldIncludeDedicatedRealtorAddon(moduleKey: string): boolean {
	return shouldIncludeDedicatedVerticalAddon(moduleKey);
}

/** @deprecated Use `sortedEnabledVerticalAddonModules(modules, verticalSlug)`. */
export function sortedEnabledRealtorAddonModules(
	modules: ProfessionalRuntimeModule[],
	verticalSlug: string = PROFESSIONAL_WORLDS_VERTICAL_REALTOR
): ProfessionalRuntimeModule[] {
	return sortedEnabledVerticalAddonModules(modules, verticalSlug);
}

export function buildJtbdPreview(
	property: RealtorProperty | RealtorPropertyCreate
): string {
	const ctx = property.jtbd_context ?? {};
	const trigger =
		ctx.trigger_context?.trim() || 'когда клиент ищет новый сценарий жизни';
	const result =
		ctx.expected_result?.trim() || 'хочет выбрать подходящий объект без хаоса';
	const emotion =
		ctx.emotional_transformation?.trim() ||
		'чтобы почувствовать уверенность, спокойствие и контроль';
	return `Когда ${trigger}, хочу ${result}, чтобы ${emotion}.`;
}

export function selectRecipeKey(
	kind: 'description' | 'contentPack' | 'roleplay'
): string {
	if (kind === 'contentPack') return 'realtor_property_content_pack';
	if (kind === 'roleplay') return 'realtor_learning_roleplay';
	return 'realtor_property_description_jtbd';
}

export interface RealtorDashboardMetrics {
	propertiesTotal: number;
	activeClients: number;
	openDeals: number;
	artifactsTotal: number;
	learningCompleted: number;
	learningTotal: number;
	profileReady: boolean;
}

export function buildRealtorDashboardMetrics(input: {
	verticalSlug: string;
	profile: SpecialistProfile | null;
	properties: RealtorProperty[];
	clients: ProfessionalClient[];
	deals: ProfessionalDeal[];
	courses: ProfessionalLearningCourse[];
	artifacts: ProfessionalArtifact[];
}): RealtorDashboardMetrics {
	const learningTotal = input.courses.reduce(
		(total, course) => total + (course.lessons ?? []).length,
		0
	);
	const learningCompleted = input.courses.reduce(
		(total, course) =>
			total +
			(course.lessons ?? []).filter((lesson) => lesson.completed).length,
		0
	);
	return {
		propertiesTotal: input.properties.length,
		activeClients: input.clients.filter(
			(client) => client.status !== 'archived'
		).length,
		openDeals: input.deals.filter((deal) => deal.stage !== 'closed').length,
		artifactsTotal: input.artifacts.length,
		learningCompleted,
		learningTotal,
		profileReady:
			input.profile?.vertical_slug === input.verticalSlug &&
			Boolean(input.profile.display_name?.trim()) &&
			Boolean(input.profile.city?.trim()),
	};
}

/** CRM suggested follow-ups count for Overview Today's focus. */
export function countOverviewCrmFollowUps(
	deals: ProfessionalDeal[],
	clients: ProfessionalClient[]
): number {
	return buildRealtorCrmFollowUpItems(deals, clients, {
		dealFallback: 'deal',
		clientFallback: 'client',
	}).length;
}

/** First CRM follow-up row mapped to Communications quick-log focus (Overview CTA). */
export function pickFirstOverviewCrmFollowUpCommunicationFocus(
	deals: ProfessionalDeal[],
	clients: ProfessionalClient[],
	labels: { dealFallback: string; clientFallback: string }
): CommunicationLogFocus | null {
	const first = buildRealtorCrmFollowUpItems(deals, clients, labels)[0];
	return first ? resolveCrmFollowUpCommunicationFocus(first) : null;
}

export type OverviewClientsNavigationTarget =
	| { kind: 'clientsDirectory' }
	| { kind: 'leadsModule' };

/** Routes empty-client pulse tile to Leads addon when enabled. */
export function resolveOverviewClientsNavigation(
	activeClients: number,
	leadsModuleEnabled: boolean
): OverviewClientsNavigationTarget {
	if (activeClients === 0 && leadsModuleEnabled) {
		return { kind: 'leadsModule' };
	}
	return { kind: 'clientsDirectory' };
}
