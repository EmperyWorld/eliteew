/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static adoption audit: OpenAPI-aligned Zod body parsers on write paths, plus fail-closed ban on api.<unknown> / getNoCache<unknown> in desktop/api.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(__dirname, '..');
const FRONTEND_ROOT = join(DESKTOP_ROOT, '../../../../');
/** Barrel + cluster modules under `desktop/api/` (Fast-Track split). */
const API_SOURCE = [
	readFileSync(join(DESKTOP_ROOT, 'api.ts'), 'utf8'),
	...readdirSync(join(DESKTOP_ROOT, 'api'))
		.filter((name) => name.endsWith('.ts'))
		.map((name) => readFileSync(join(DESKTOP_ROOT, 'api', name), 'utf8')),
].join('\n');
const WRITE_EXCEPTIONS = JSON.parse(
	readFileSync(
		join(
			FRONTEND_ROOT,
			'openapi/pilot-professional-worlds-write-path-exceptions.json'
		),
		'utf8'
	)
) as {
	empty_body_post: string[];
	no_body_post: string[];
	multipart: string[];
};

/** Write-path body parsers that must appear in `api.ts` call sites (fail closed). */
const WRITE_PATH_BODY_PARSERS = [
	'parseCommunicationLogCreateBody',
	'parseProfessionalClientCreateBody',
	'parseProfessionalDealCreateBody',
	'parseProfessionalDealUpdateBody',
	'parseRealtorPropertyCreateBody',
	'parseRealtorPropertyUpdateBody',
	'parseRealtorLeadCreateBody',
	'parseRealtorTaskCreateBody',
	'parseRealtorTaskUpdateBody',
	'parseRealtorPropertyShowingCreateBody',
	'parseRealtorPropertyShowingUpdateBody',
	'parseSpecialistProfileUpsertBody',
	'parseRealtorBuyerRequirementCreateBody',
	'parseRealtorBuyerRequirementUpdateBody',
	'parseRealtorSellerProfileCreateBody',
	'parseRealtorSellerProfileUpdateBody',
	'parseDealEventAppendBody',
	'parseRealtorProDocumentCreateBody',
	'parseRealtorProDocumentUpdateBody',
	'parseMarketingCampaignCreateBody',
	'parseMarketingCampaignUpdateBody',
	'parsePriceAnalysisSnapshotCreateBody',
	'parseRealtorPropertyMediaCreateBody',
	'parseRealtorMediaBatchCreateBody',
	'parseRealtorMediaBatchItemReviewBody',
	'parseProfessionalMediaAlbumCreateBody',
	'parseProfessionalMediaAlbumPatchBody',
	'parseProfessionalVerticalOnboardingPatchBody',
	'parseBrandVisualKitUpsertBody',
	'parseProfessionalVerticalActivationUpsertBody',
	'parseRealtorPropertyDraftPayloadBody',
	'parseObjectIntakeParseRequestBody',
	'parseObjectIntakeCommitRequestBody',
	'parseProfessionalPlaybookLaunchBody',
	'parseObjectionReplyUpsertBody',
	'parsePublicationChannelUpsertBody',
	'parsePublicationChannelPatchBody',
	'parseMediaEnhancementRequestBody',
	'parseRealtorGenerationBody',
	'parseCoachSimulationBody',
] as const;

/** Response parsers required on high-traffic REST reads (sample; full list in professionalWorldsApiZod.ts). */
const RESPONSE_PARSERS_SAMPLE = [
	'parseProfessionalWorldsSnapshotOut',
	'parseRealtorCommunicationLogOut',
	'parseRealtorObjectionReplyOutList',
	'parseRealtorPublicationChannelOutList',
	'parseProfessionalDealPropertyLinkBackfillOut',
] as const;

describe('professionalWorldsApi adoption audit', () => {
	it('api.ts wires all write-path Zod body parsers', () => {
		for (const parser of WRITE_PATH_BODY_PARSERS) {
			expect(
				API_SOURCE.includes(parser),
				`expected api.ts to call ${parser}`
			).toBe(true);
		}
	});

	it('api.ts wires sample response Zod parsers on REST boundaries', () => {
		for (const parser of RESPONSE_PARSERS_SAMPLE) {
			expect(
				API_SOURCE.includes(parser),
				`expected api.ts to call ${parser}`
			).toBe(true);
		}
	});

	it('documents intentional empty-body and multipart write exceptions', () => {
		for (const fn of WRITE_EXCEPTIONS.empty_body_post) {
			expect(
				API_SOURCE.includes(`export async function ${fn}`),
				`expected empty-body exception ${fn} in api.ts`
			).toBe(true);
		}
		for (const fn of WRITE_EXCEPTIONS.no_body_post) {
			expect(
				API_SOURCE.includes(`export async function ${fn}`),
				`expected no-body exception ${fn} in api.ts`
			).toBe(true);
		}
		for (const fn of WRITE_EXCEPTIONS.multipart) {
			expect(
				API_SOURCE.includes(`export async function ${fn}`),
				`expected multipart exception ${fn} in api.ts`
			).toBe(true);
		}
	});

	it('streamProfessionalPlaybook validates launch body before SSE POST', () => {
		expect(API_SOURCE).toMatch(
			/streamProfessionalPlaybook[\s\S]*parseProfessionalPlaybookLaunchBody/
		);
	});

	it('resumeProfessionalPlaybookStream validates launch body before SSE POST', () => {
		expect(API_SOURCE).toMatch(
			/resumeProfessionalPlaybookStream[\s\S]*parseProfessionalPlaybookLaunchBody/
		);
	});

	it('desktop/api REST clients do not use api.<unknown> or getNoCache<unknown>', () => {
		const apiUnknown = API_SOURCE.match(
			/api\.(get|post|put|patch|delete)\s*<\s*unknown\s*>/g
		);
		const cacheUnknown = API_SOURCE.match(/getNoCache\s*<\s*unknown\s*>/g);
		expect(apiUnknown ?? [], 'api.<unknown> residuals in desktop/api').toEqual(
			[]
		);
		expect(
			cacheUnknown ?? [],
			'getNoCache<unknown> residuals in desktop/api'
		).toEqual([]);
	});
});
