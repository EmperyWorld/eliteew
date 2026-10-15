/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime copy regression coverage for end-user Professional Worlds chrome.
 *
 * Invariants:
 * - Main runtime subtitle, onboarding hints and safety copy avoid raw "AI"/"ИИ" labels in user-facing chrome.
 *
 * Related:
 * - src/i18n/locales/en/professionalWorlds.json
 * - src/i18n/locales/ru/professionalWorlds.json
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import enProfessionalWorlds from '@/i18n/locales/en/professionalWorlds.json';
import ruProfessionalWorlds from '@/i18n/locales/ru/professionalWorlds.json';

const rawStructuredFormatJargonPattern = /\bJSON\b|\bUUID\b/i;
const rawAiCopyPattern = /\bAI\b|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/iu;
const rawMediaDiagnosticsPattern =
	/\b(Status|Output|SSE|Review):|POST\s+\/media|PW media|schema migration/;
const rawRussianPrimaryCopyPatterns = [
	/\bpayload\b/i,
	/\bschema_key\b/,
	/\baction_key\b/,
	/\brelease_id\b/,
	/\binput_mapping\b/,
	/\{\}/,
	/(^|[^А-Яа-яЁё])лиды([^А-Яа-яЁё]|$)/iu,
	/пресет/iu,
	/плейбук/iu,
	/датасет/iu,
	/артефакт/iu,
	/AI-сценарии/iu,
	/AI-плейбуки/iu,
] as const;
const rawEnglishRuntimeJargonPatterns = [
	/\bUGS\b/,
	/\bJTBD\b/,
	/\bartifacts?\b/i,
	/\bpipeline\b/i,
	/\bCRM\b/,
	/\bSite Studio\b/,
	/\bEWRP\b/,
	/\bGAF Chat\b/,
	/\bEWDesk\b/,
	/\bUnified Content\b/,
] as const;

const rawEnglishDefaultRealtorSurfacePatterns = [
	/\bbatch\b/i,
	/\bcockpit\b/i,
	/\bhandoffs?\b/i,
	/\bjob\b/i,
	/\bruntime\b/i,
	/\bmodules?\b/i,
	/\bpacks?\b/i,
] as const;

const rawRussianUserFacingInternalPatterns = [
	/\bSite Studio\b/,
	/\bEWRP\b/,
	/\bGAF Chat\b/,
	/\bEWDesk\b/,
	/(^|[^А-Яа-яЁё])администратор([^А-Яа-яЁё]|$)/iu,
	/(^|[^А-Яа-яЁё])оператор([^А-Яа-яЁё]|$)/iu,
	/Professional Worlds/,
	/Технические детали/,
] as const;

const rawRussianDefaultRealtorSurfacePatterns = [
	/пакет/iu,
	/пресет/iu,
	/модул/iu,
	/артефакт/iu,
	/handoff/iu,
	/runtime/iu,
	/job/iu,
	/batch/iu,
] as const;

const legacyRussianDefaultSurfaceTerms = [
	/(^|[^А-Яа-яЁё])Результаты([^А-Яа-яЁё]|$)/iu,
	/(^|[^А-Яа-яЁё])Сценарии([^А-Яа-яЁё]|$)/iu,
	/профиль специалиста/iu,
] as const;

const legacyEnglishDefaultSurfaceTerms = [
	/\bspecialist profile\b/i,
	/\bsaved results\b/i,
	/\bopen scenarios\b/i,
	/\bresults library\b/i,
] as const;

const allowedTechnicalCopyPaths = new Set([
	'runtimeComponents.aiActionLauncher.payloadAria',
	'admin.playbooks.inputMapping',
	'admin.playbooks.inputMappingHint',
]);

const userFacingRuntimeCopy = [
	enProfessionalWorlds.subtitle,
	enProfessionalWorlds.safety.body,
	enProfessionalWorlds.onboardingWizard.defaultSteps.firstObjectDesc,
	enProfessionalWorlds.onboardingWizard.defaultSteps.firstArtifactDesc,
	ruProfessionalWorlds.subtitle,
	ruProfessionalWorlds.safety.body,
	ruProfessionalWorlds.onboardingWizard.defaultSteps.firstObjectDesc,
	ruProfessionalWorlds.onboardingWizard.defaultSteps.firstArtifactDesc,
] as const;

const mediaRuntimeCopy = [
	enProfessionalWorlds.mediaWorkbench.albumsBlockedByMigration,
	enProfessionalWorlds.mediaWorkbench.processingStatus,
	enProfessionalWorlds.mediaWorkbench.outputReady,
	enProfessionalWorlds.mediaWorkbench.outputWaiting,
	enProfessionalWorlds.mediaWorkbench.progressSignalLabel,
	enProfessionalWorlds.mediaWorkbench.reviewDecisionLabel,
	...Object.values(enProfessionalWorlds.properties.uploadStatuses),
	...Object.values(enProfessionalWorlds.mediaWorkbench.jobStatuses),
	...Object.values(enProfessionalWorlds.mediaWorkbench.progressSignals),
	ruProfessionalWorlds.mediaWorkbench.albumsBlockedByMigration,
	ruProfessionalWorlds.mediaWorkbench.processingStatus,
	ruProfessionalWorlds.mediaWorkbench.outputReady,
	ruProfessionalWorlds.mediaWorkbench.outputWaiting,
	ruProfessionalWorlds.mediaWorkbench.progressSignalLabel,
	ruProfessionalWorlds.mediaWorkbench.reviewDecisionLabel,
	...Object.values(ruProfessionalWorlds.properties.uploadStatuses),
	...Object.values(ruProfessionalWorlds.mediaWorkbench.jobStatuses),
	...Object.values(ruProfessionalWorlds.mediaWorkbench.progressSignals),
] as const;

function normalizeCopyPath(path: string): string {
	return path
		.split('.')
		.map((segment) => segment.replace(/-/g, ''))
		.join('.');
}

function collectStrings(
	value: unknown,
	prefix: string,
	acc: Array<{ path: string; text: string }>
): Array<{ path: string; text: string }> {
	if (typeof value === 'string') {
		acc.push({ path: normalizeCopyPath(prefix), text: value });
		return acc;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			collectStrings(item, `${prefix}.${index}`, acc);
		});
		return acc;
	}
	if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			collectStrings(child, prefix ? `${prefix}.${key}` : key, acc);
		}
	}
	return acc;
}

const russianPrimaryCopy = [
	['runtime', ruProfessionalWorlds.runtime],
	['runtimeComponents', ruProfessionalWorlds.runtimeComponents],
	['playbooksPanel', ruProfessionalWorlds.playbooksPanel],
	['professionTools', ruProfessionalWorlds.professionTools],
	['admin.aiActions', ruProfessionalWorlds.admin.aiActions],
	['admin.evaluation', ruProfessionalWorlds.admin.evaluation],
	['admin.playbooks', ruProfessionalWorlds.admin.playbooks],
	['admin.packs', ruProfessionalWorlds.admin.packs],
].flatMap(([path, value]) =>
	collectStrings(value, path as string, []).filter(
		(row) => !allowedTechnicalCopyPaths.has(row.path)
	)
);

const englishPrimaryRuntimeCopy = [
	['shared', enProfessionalWorlds.shared],
	['onboardingWizard', enProfessionalWorlds.onboardingWizard],
	['nav', enProfessionalWorlds.nav],
	['metrics', enProfessionalWorlds.metrics],
	['overview', enProfessionalWorlds.overview],
	['properties', enProfessionalWorlds.properties],
	['ai', enProfessionalWorlds.ai],
	['professionTools', enProfessionalWorlds.professionTools],
	['clients', enProfessionalWorlds.clients],
	['brand', enProfessionalWorlds.brand],
	['integrationHandoff', enProfessionalWorlds.integrationHandoff],
	['crossAppDrafts', enProfessionalWorlds.crossAppDrafts],
	['runtimeComponents', enProfessionalWorlds.runtimeComponents],
	['beforeAfter', enProfessionalWorlds.beforeAfter],
	['mobileEmbedded', enProfessionalWorlds.mobileEmbedded],
	['realtorPro', enProfessionalWorlds.realtorPro],
	['artifacts', enProfessionalWorlds.artifacts],
	['playbooksPanel', enProfessionalWorlds.playbooksPanel],
	['guide', enProfessionalWorlds.guide],
].flatMap(([path, value]) => collectStrings(value, path as string, []));

const defaultSurfaceExcludedPathPattern =
	/(batch|mediaAdvanced|mediaActionsHint|mediaNextSteps|mediaUuid|photoAdvanced|photoPresetFallback|runtime\.placeholder|support|uploadProgressTitle)/i;

const englishDefaultRealtorSurfaceCopy = [
	['nav', enProfessionalWorlds.nav],
	['metrics', enProfessionalWorlds.metrics],
	['overview', enProfessionalWorlds.overview],
	['profile', enProfessionalWorlds.profile],
	['properties', enProfessionalWorlds.properties],
	['clients', enProfessionalWorlds.clients],
	['brand', enProfessionalWorlds.brand],
	['artifacts', enProfessionalWorlds.artifacts],
	['playbooksPanel', enProfessionalWorlds.playbooksPanel],
].flatMap(([path, value]) =>
	collectStrings(value, path as string, []).filter(
		(row) => !defaultSurfaceExcludedPathPattern.test(row.path)
	)
);

const russianUserFacingRuntimeCopy = [
	['shared', ruProfessionalWorlds.shared],
	[
		'title',
		{
			title: ruProfessionalWorlds.title,
			subtitle: ruProfessionalWorlds.subtitle,
		},
	],
	['nav', ruProfessionalWorlds.nav],
	['safety', ruProfessionalWorlds.safety],
	['errors', ruProfessionalWorlds.errors],
	['activationGate', ruProfessionalWorlds.activationGate],
	['profile.publicPresence', ruProfessionalWorlds.profile.publicPresence],
	['properties', ruProfessionalWorlds.properties],
	['mediaWorkbench', ruProfessionalWorlds.mediaWorkbench],
	['brand', ruProfessionalWorlds.brand],
	['integrationHandoff', ruProfessionalWorlds.integrationHandoff],
	['crossAppDrafts', ruProfessionalWorlds.crossAppDrafts],
	['beforeAfter', ruProfessionalWorlds.beforeAfter],
	['mobileEmbedded', ruProfessionalWorlds.mobileEmbedded],
	['playbooksPanel', ruProfessionalWorlds.playbooksPanel],
	['guide', ruProfessionalWorlds.guide],
].flatMap(([path, value]) => collectStrings(value, path as string, []));

const russianDefaultRealtorSurfaceCopy = [
	['nav', ruProfessionalWorlds.nav],
	['metrics', ruProfessionalWorlds.metrics],
	['overview', ruProfessionalWorlds.overview],
	['profile', ruProfessionalWorlds.profile],
	['properties', ruProfessionalWorlds.properties],
	['clients', ruProfessionalWorlds.clients],
	['brand', ruProfessionalWorlds.brand],
	['artifacts', ruProfessionalWorlds.artifacts],
	['playbooksPanel', ruProfessionalWorlds.playbooksPanel],
].flatMap(([path, value]) =>
	collectStrings(value, path as string, []).filter(
		(row) => !defaultSurfaceExcludedPathPattern.test(row.path)
	)
);

const userFacingFormatCopy = [
	enProfessionalWorlds.properties.intakeDiagnostics.modelNonJson,
	enProfessionalWorlds.runtimeComponents.aiActionLauncher.invalidPayload,
	ruProfessionalWorlds.properties.intakeDiagnostics.modelNonJson,
	ruProfessionalWorlds.runtimeComponents.aiActionLauncher.invalidPayload,
] as const;

const sourceCopyGuardFiles = [
	'src/features/professional-worlds/desktop/BeforeAfterMediaCompare.tsx',
	'src/features/professional-worlds/desktop/ProfessionalToast.ts',
	'src/pages/MobileProfessionalWorlds/MobileProfessionalWorldsPage.tsx',
] as const;

const bannedUserFacingSourceLiterals = [
	'Before / after',
	'Accept enhanced media',
	'Accepting…',
	'Rejecting…',
	'Professional Worlds открывается',
	'Переподключаем Professional Worlds',
	'Открываем Professional Worlds',
	'The runtime job finished successfully.',
	'The runtime job reported a warning.',
	'The runtime job stopped with an error.',
] as const;

describe('Professional Worlds runtime copy', () => {
	it('keeps intake and AI action errors free of JSON/UUID jargon', () => {
		for (const text of userFacingFormatCopy) {
			expect(text).not.toMatch(rawStructuredFormatJargonPattern);
		}
	});

	it('keeps main runtime chrome free of raw AI labels', () => {
		for (const text of userFacingRuntimeCopy) {
			expect(text).not.toMatch(rawAiCopyPattern);
		}
	});

	it('keeps media runtime copy free of raw job diagnostics', () => {
		for (const text of mediaRuntimeCopy) {
			expect(text).not.toMatch(rawMediaDiagnosticsPattern);
		}
	});

	it('keeps focused Russian runtime/admin copy free of raw primary jargon', () => {
		for (const { path, text } of russianPrimaryCopy) {
			for (const pattern of rawRussianPrimaryCopyPatterns) {
				expect(`${path}: ${text}`).not.toMatch(pattern);
			}
		}
	});

	it('keeps focused English runtime copy free of internal product jargon', () => {
		for (const { path, text } of englishPrimaryRuntimeCopy) {
			for (const pattern of rawEnglishRuntimeJargonPatterns) {
				expect(text, path).not.toMatch(pattern);
			}
		}
	});

	it('keeps focused Russian user runtime copy free of internal product and operator jargon', () => {
		for (const { path, text } of russianUserFacingRuntimeCopy) {
			for (const pattern of rawRussianUserFacingInternalPatterns) {
				expect(`${path}: ${text}`).not.toMatch(pattern);
			}
		}
	});

	it('keeps default realtor surfaces free of operator workflow terms', () => {
		for (const { path, text } of englishDefaultRealtorSurfaceCopy) {
			for (const pattern of rawEnglishDefaultRealtorSurfacePatterns) {
				expect(text, path).not.toMatch(pattern);
			}
		}
		for (const { path, text } of russianDefaultRealtorSurfaceCopy) {
			for (const pattern of rawRussianDefaultRealtorSurfacePatterns) {
				expect(text, path).not.toMatch(pattern);
			}
		}
	});

	it('keeps default realtor surfaces free of legacy Results/Scenarios copy', () => {
		for (const { path, text } of englishDefaultRealtorSurfaceCopy) {
			for (const pattern of legacyEnglishDefaultSurfaceTerms) {
				expect(text, path).not.toMatch(pattern);
			}
		}
		for (const { path, text } of russianDefaultRealtorSurfaceCopy) {
			for (const pattern of legacyRussianDefaultSurfaceTerms) {
				expect(`${path}: ${text}`).not.toMatch(pattern);
			}
		}
	});

	it('keeps audited source files free of known raw user-facing fallback strings', () => {
		const source = sourceCopyGuardFiles
			.map((filePath) => readFileSync(join(process.cwd(), filePath), 'utf8'))
			.join('\n');
		for (const literal of bannedUserFacingSourceLiterals) {
			expect(source).not.toContain(literal);
		}
	});
});
