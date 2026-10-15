/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source-level UX contracts for Survey Hub waves 14–21 (sort, session, reset, admin arch).
 *
 * Related:
 * - SurveyHubDesktopApp.tsx · surveyHubHistorySession.ts · SURVEY-HUB.md
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
	const dir = dirname(fileURLToPath(import.meta.url));
	return readFileSync(join(dir, relativePath), 'utf8');
}

describe('surveyHub UX contracts (waves 14–21)', () => {
	it('SurveyHubDesktopApp sorts available by deadline and completed by date', () => {
		const src = readSource('../SurveyHubDesktopApp.tsx');
		expect(src).toContain('sortAvailableSurveysByDeadline');
		expect(src).toContain('sortCompletedSurveysByDate');
		expect(src).toContain('sortedAvailable[0]');
	});

	it('SurveyHubDesktopApp persists and resets history filters', () => {
		const src = readSource('../SurveyHubDesktopApp.tsx');
		expect(src).toContain('readHistorySearchQuery');
		expect(src).toContain('persistHistorySearchQuery');
		expect(src).toContain('isSurveyHubHistoryFiltersActive');
		expect(src).toContain('clearSurveyHubHistoryPrefs');
		expect(src).toContain('history.resetFilters');
	});

	it('surveyHubHistorySession merges prefs and clears session key', () => {
		const src = readSource('../surveyHubHistorySession.ts');
		expect(src).toContain('persistPrefs');
		expect(src).toContain('clearSurveyHubHistoryPrefs');
		expect(src).toContain('isSurveyHubHistoryFiltersActive');
	});

	it('SurveyAdminPublishedToolbar includes GAF actions', () => {
		const src = readSource(
			'../../../../pages/Admin/surveys/SurveyAdminPublishedToolbar.tsx'
		);
		expect(src).toContain('admin.gafActions.undelivered');
		expect(src).toContain('onGafRemind');
	});

	it('SurveysAdminSection stays under arch cap with catalog panel split (wave 21)', () => {
		const sectionSrc = readSource(
			'../../../../pages/Admin/SurveysAdminSection.tsx'
		);
		expect(sectionSrc).toContain('SurveyAdminCatalogPanel');
		expect(sectionSrc).toMatch(
			/import\s+\{\s*SurveyAdminCatalogPanel\s*\}\s+from\s+['"]\.\/surveys\/SurveyAdminCatalogPanel['"]/
		);
		expect(sectionSrc.split('\n').length).toBeLessThanOrEqual(800);
	});
});

describe('surveyHub premium runner contracts (wave 22)', () => {
	it('SurveyRunner uses hero strip and sticky primary action bar', () => {
		const runnerSrc = readSource('../SurveyRunner.tsx');
		const actionBarSrc = readSource('../SurveyRunnerActionBar.tsx');
		expect(runnerSrc).toContain('SurveyRunnerHero');
		expect(runnerSrc).toContain('SurveyRunnerActionBar');
		expect(actionBarSrc).toContain('SH_RUNNER_ACTION_BAR_CLASS');
		expect(runnerSrc).toContain('SurveyRunnerSuccessPanel');
		expect(runnerSrc).not.toContain('surveyHasReward(survey.reward)');
	});

	it('SurveyRunnerHero surfaces trust note and progressive keyboard hint', () => {
		const src = readSource('../SurveyRunnerHero.tsx');
		expect(src).toContain('runner.trustNote');
		expect(src).toContain('runner.keyboardHintMore');
		expect(src).toContain('SH_RUNNER_HERO_CLASS');
		expect(src).toContain('runner.stepsRemaining');
	});

	it('SurveyQuestionStep uses runner layout tokens for choices and text', () => {
		const src = readSource('../SurveyQuestionStep.tsx');
		expect(src).toContain('SH_RUNNER_CHOICE_SELECTED_CLASS');
		expect(src).toContain('SH_RUNNER_TEXTAREA_CLASS');
		expect(src).toContain('SH_RUNNER_SCALE_VALUE_CLASS');
		expect(src).toContain('SH_RUNNER_SCALE_CHIP_CLASS');
		expect(src).toContain('textMaxLength');
	});
});

describe('surveyHub premium runner contracts (wave 23)', () => {
	it('SurveyRunner gates primary CTA until step answer validates', () => {
		const runnerSrc = readSource('../SurveyRunner.tsx');
		const flowSrc = readSource('../useSurveyRunnerFlow.ts');
		expect(flowSrc).toContain('canProceedCurrent');
		expect(runnerSrc).toContain('primaryDisabled={!flow.canProceedCurrent}');
		expect(flowSrc).toContain('scrollPanelTop');
	});

	it('SurveyRunnerHero shows trust note only on review phase', () => {
		const src = readSource('../SurveyRunnerHero.tsx');
		expect(src).toMatch(/review\s*\?\s*\(/);
		expect(src).toContain('runner.reviewPhaseHint');
	});
});

describe('surveyHub premium runner contracts (wave 24)', () => {
	it('SurveyRunner confirms exit when partial answers exist', () => {
		const runnerSrc = readSource('../SurveyRunner.tsx');
		const flowSrc = readSource('../useSurveyRunnerFlow.ts');
		expect(runnerSrc).toContain('SurveyRunnerExitConfirm');
		expect(flowSrc).toContain('requestCancel');
		expect(flowSrc).toContain('countSurveyAnsweredQuestions');
		expect(runnerSrc).toContain('runner.primaryHintRequired');
		expect(flowSrc).toContain('focus({ preventScroll: true })');
	});

	it('SurveyRunnerStepDots uses numbered pills for short surveys', () => {
		const src = readSource('../SurveyRunnerStepDots.tsx');
		expect(src).toContain('SH_RUNNER_STEP_PILL_CLASS');
		expect(src).toContain('MAX_NUMBERED_STEPS');
	});

	it('SurveyHubDesktopApp highlights urgent survey cards', () => {
		const src = readSource('../SurveyHubDesktopApp.tsx');
		expect(src).toContain('SH_SURVEY_CARD_URGENT_CLASS');
		expect(src).toContain('surveyClosesSoon(item.closes_at)');
	});
});

describe('surveyHub premium runner contracts (wave 25)', () => {
	it('SurveyRunner persists tab-local session and shows resume banner', () => {
		const src = readSource('../SurveyRunner.tsx');
		const flowSrc = readSource('../useSurveyRunnerFlow.ts');
		const bannerSrc = readSource('../SurveyRunnerResumeBanner.tsx');
		expect(flowSrc).toContain('persistSurveyRunnerSession');
		expect(flowSrc).toContain('readSurveyRunnerSession');
		expect(flowSrc).toContain('clearSurveyRunnerSession');
		expect(src).toContain('SurveyRunnerResumeBanner');
		expect(bannerSrc).toContain('runner.resumeContinue');
	});

	it('SurveyRunnerExitConfirm mentions tab-local session retention', () => {
		const src = readSource('../SurveyRunnerExitConfirm.tsx');
		expect(src).toContain('runner.exitConfirm.sessionNote');
	});

	it('surveyRunnerSession module handles intro dismissed flag', () => {
		const src = readSource('../surveyRunnerSession.ts');
		expect(src).toContain('persistSurveyRunnerIntroDismissed');
		expect(src).toContain('eliteew-survey-runner:');
	});
});

describe('surveyHub premium runner contracts (wave 26)', () => {
	it('SurveyRunner announces step changes via aria-live region', () => {
		const src = readSource('../SurveyRunner.tsx');
		expect(src).toContain('aria-live="polite"');
	});

	it('SurveyQuestionStep supports number keys and scale arrows', () => {
		const src = readSource('../SurveyQuestionStep.tsx');
		expect(src).toContain("event.key === '0'");
		expect(src).toContain('ArrowLeft');
		expect(src).toContain('ArrowRight');
	});

	it('SurveyRunnerStepDots marks future steps aria-disabled', () => {
		const src = readSource('../SurveyRunnerStepDots.tsx');
		expect(src).toContain('aria-disabled');
	});
});

describe('surveyHub premium runner contracts (wave 27)', () => {
	it('SurveyRunnerReviewPanel highlights incomplete answers before submit', () => {
		const src = readSource('../SurveyRunnerReviewPanel.tsx');
		expect(src).toContain('collectSurveyReviewIssues');
		expect(src).toContain('runner.reviewIncompleteSummary');
		expect(src).toContain('border-amber-500/45');
	});

	it('SurveyRunner delegates review UI to extracted panel', () => {
		const src = readSource('../SurveyRunner.tsx');
		expect(src).toContain('SurveyRunnerReviewPanel');
	});
});

describe('surveyHub premium runner contracts (wave 28)', () => {
	it('SurveyRunnerIntro provides single Start CTA with survey context', () => {
		const src = readSource('../SurveyRunnerIntro.tsx');
		expect(src).toContain('runner.introStart');
		expect(src).toContain('SurveyUserDeadlineBadge');
		expect(src).toContain('runner.introQuestionCount');
	});

	it('SurveyRunner skips intro when resuming stored session', () => {
		const runnerSrc = readSource('../SurveyRunner.tsx');
		const sessionSrc = readSource('../surveyRunnerSession.ts');
		expect(runnerSrc).toContain('SurveyRunnerIntro');
		expect(runnerSrc).toContain('useSurveyRunnerFlow');
		expect(sessionSrc).toContain('hasRestorableSurveyRunnerSession');
	});

	it('SurveyHubDesktopApp runner header is title-only', () => {
		const src = readSource('../SurveyHubDesktopApp.tsx');
		expect(src).toContain('detailQ.data.title');
		expect(src).not.toMatch(
			/activeId && detailQ\.data[\s\S]{0,400}description_user/
		);
	});
});

describe('surveyHub premium runner contracts (wave 29)', () => {
	it('SurveyRunner orchestrator stays under 400 lines with extracted panels', () => {
		const src = readSource('../SurveyRunner.tsx');
		expect(src).toContain('SurveyRunnerActionBar');
		expect(src).toContain('SurveyRunnerSuccessPanel');
		expect(src).toContain('SurveyRunnerReadOnlyPanel');
		expect(src.split('\n').length).toBeLessThanOrEqual(400);
	});
});

describe('surveyHub premium runner contracts (wave 30)', () => {
	it('SurveyQuestionStep uses NPS semantic labels and DesktopAppInput for text_short', () => {
		const src = readSource('../SurveyQuestionStep.tsx');
		expect(src).toContain('surveyNpsSemanticLabel');
		expect(src).toContain('runner.npsLabel.');
		expect(src).toContain('DesktopAppInput');
		expect(src).toContain('surveyScaleEndpointLabels');
		expect(src).toContain("question.question_type === 'text_long'");
	});
});
