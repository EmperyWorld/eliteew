/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derive draft publish readiness counts for admin workflow strip and sticky action bar.
 *
 * Invariants:
 * - Mirrors SurveyAdminPublishChecklist gates (title, questions, audience, preview, reward).
 *
 * Related:
 * - SurveyAdminPublishChecklist.tsx
 * - SurveyAdminDraftActionBar.tsx
 */
export type PublishReadinessInput = {
	title: string;
	questionCount: number;
	groupCount: number;
	userCount: number;
	previewCount: number | null;
	rewardConfigured: boolean;
};

export type PublishReadiness = {
	readyCount: number;
	totalCount: number;
	publishReady: boolean;
	completionRate: number | null;
};

export function computePublishReadiness(
	input: PublishReadinessInput
): PublishReadiness {
	const audienceAssigned = input.groupCount > 0 || input.userCount > 0;
	const checks = [
		Boolean(input.title.trim()),
		input.questionCount > 0,
		audienceAssigned,
		audienceAssigned && input.previewCount !== null && input.previewCount > 0,
		input.rewardConfigured,
	];
	const readyCount = checks.filter(Boolean).length;
	const publishReady =
		Boolean(input.title.trim()) && input.questionCount > 0 && audienceAssigned;
	const completionRate =
		audienceAssigned && input.previewCount !== null && input.previewCount > 0
			? 0
			: null;

	return {
		readyCount,
		totalCount: checks.length,
		publishReady,
		completionRate,
	};
}
