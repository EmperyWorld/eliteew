import {
	ARCHETYPE_CATALOG,
	ARCHETYPE_QUESTION_MAPPING,
	BUSINESS_AREAS,
	EMOTIONS_JOURNEY_STAGES,
	QUESTIONS,
	SERVQUAL_DIMENSIONS,
	getIndustryBenchmark,
} from './diagnosticDefinition';
import type {
	DiagnosticAnswersByModule,
	DiagnosticModuleId,
	ServiceExpectationRealityAnswer,
	ValuesQuestionAnswer,
} from './diagnosticTypes';

export type ArchetypeScoreResult = {
	dominant: {
		id: string;
		percentage: number;
		name: string;
		description: string;
	};
	secondary: {
		id: string;
		percentage: number;
		name: string;
		description: string;
	};
	percentages: Record<string, number>;
};

export function scoreArchetype(
	answers: Record<string, number> | undefined
): ArchetypeScoreResult | null {
	if (!answers || Object.keys(answers).length === 0) return null;
	const scores: Record<string, number> = {};
	for (const k of Object.keys(ARCHETYPE_QUESTION_MAPPING)) {
		scores[k] = 0;
	}
	for (const [archetype, questionIds] of Object.entries(
		ARCHETYPE_QUESTION_MAPPING
	)) {
		for (const qid of questionIds) {
			const v = answers[String(qid)];
			if (typeof v === 'number') {
				scores[archetype] = (scores[archetype] ?? 0) + v;
			}
		}
	}
	const total = Object.values(scores).reduce((s, x) => s + x, 0);
	if (total <= 0) return null;
	const percentages: Record<string, number> = {};
	for (const [id, s] of Object.entries(scores)) {
		percentages[id] = Math.round((s / total) * 100);
	}
	const sorted = Object.entries(percentages).sort((a, b) => b[1] - a[1]);
	const d = sorted[0];
	const s2 = sorted[1];
	const dc = ARCHETYPE_CATALOG[d[0]] ?? {
		name: d[0],
		description: '',
	};
	const s2c = ARCHETYPE_CATALOG[s2[0]] ?? {
		name: s2[0],
		description: '',
	};
	return {
		dominant: {
			id: d[0],
			percentage: d[1],
			name: dc.name,
			description: dc.description,
		},
		secondary: {
			id: s2[0],
			percentage: s2[1],
			name: s2c.name,
			description: s2c.description,
		},
		percentages,
	};
}

export type ValuesScoreResult = {
	percentages: Record<string, number>;
};

/** Как `ValuesModule.calculateResults` в celzrel. */
export function scoreValues(
	answers: Record<string, ValuesQuestionAnswer> | undefined
): ValuesScoreResult | null {
	if (!answers || Object.keys(answers).length === 0) return null;
	const valueScores: Record<string, number> = {
		power: 0,
		achievement: 0,
		hedonism: 0,
		stimulation: 0,
		self_direction: 0,
		universalism: 0,
		benevolence: 0,
		tradition: 0,
		conformity: 0,
		security: 0,
	};
	for (const a of Object.values(answers)) {
		if (a.type === 'scale') {
			for (const [value, score] of Object.entries(a.values)) {
				if (valueScores[value] !== undefined) {
					valueScores[value] += score;
				}
			}
		} else if (a.type === 'choice') {
			if (valueScores[a.value] !== undefined) {
				valueScores[a.value] += 3;
			}
		} else if (a.type === 'ranking') {
			for (const [value, rank] of Object.entries(a.values)) {
				if (valueScores[value] !== undefined) {
					valueScores[value] += rank * 2;
				}
			}
		}
	}
	const totalScore = Object.values(valueScores).reduce((sum, x) => sum + x, 0);
	if (totalScore <= 0) return null;
	const percentages: Record<string, number> = {};
	for (const [value, score] of Object.entries(valueScores)) {
		percentages[value] = Math.round((score / totalScore) * 100);
	}
	return { percentages };
}

export type BusinessScoreResult = {
	areaScores: Record<string, number>;
	totalHealthIndex: number;
	developmentZones: Array<{
		area: string;
		score: number;
		name: string;
		gap: number;
	}>;
	strengths: Array<{ area: string; score: number; name: string }>;
};

/** Как `BusinessModule.calculateResults` (без рекомендаций). */
export function scoreBusiness(
	answers: Record<string, number> | undefined,
	industry?: string
): BusinessScoreResult | null {
	if (!answers || Object.keys(answers).length === 0) return null;
	const areaScores: Record<string, number> = {};
	const areaMaxScores: Record<string, number> = {};
	for (const area of Object.keys(BUSINESS_AREAS)) {
		areaScores[area] = 0;
		areaMaxScores[area] = 0;
	}
	for (const q of QUESTIONS.business) {
		const ans = answers[String(q.id)];
		if (ans === undefined) continue;
		const area = q.area as string;
		areaScores[area] = (areaScores[area] ?? 0) + ans;
		if (q.type === 'scale' && 'scale' in q && q.scale) {
			areaMaxScores[area] = (areaMaxScores[area] ?? 0) + q.scale.max;
		} else if (q.type === 'choice') {
			areaMaxScores[area] = (areaMaxScores[area] ?? 0) + 5;
		}
	}
	const areaPercentages: Record<string, number> = {};
	for (const area of Object.keys(BUSINESS_AREAS)) {
		const max = areaMaxScores[area] ?? 1;
		areaPercentages[area] =
			max > 0 ? Math.round((areaScores[area] / max) * 100) : 0;
	}
	const totalHealthIndex = Math.round(
		Object.values(areaPercentages).reduce((sum, score) => sum + score, 0) / 5
	);
	const developmentZones = Object.entries(areaPercentages)
		.sort(([, a], [, b]) => a - b)
		.slice(0, 3)
		.map(([area, score]) => ({
			area,
			score,
			name: BUSINESS_AREAS[area]?.name ?? area,
			gap: getIndustryBenchmark(industry, area) - score,
		}));
	const strengths = Object.entries(areaPercentages)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 2)
		.map(([area, score]) => ({
			area,
			score,
			name: BUSINESS_AREAS[area]?.name ?? area,
		}));
	return {
		areaScores: areaPercentages,
		totalHealthIndex,
		developmentZones,
		strengths,
	};
}

function improvementPotentialLabel(gap: number): string {
	if (gap >= -0.5) return 'Низкий приоритет';
	if (gap >= -1.0) return 'Средний приоритет';
	if (gap >= -1.5) return 'Высокий приоритет';
	return 'Критический приоритет';
}

export type ServiceScoreResult = {
	dimensionResults: Record<
		string,
		{ expectation: number; reality: number; gap: number; count: number }
	>;
	overallExpectation: number;
	overallReality: number;
	overallGap: number;
	serviceQualityIndex: number;
	customerEffortScore: number;
	criticalPoints: Array<{
		dimension: string;
		name: string;
		icon: string;
		gap: number;
		improvement: string;
	}>;
	strengths: Array<{
		dimension: string;
		name: string;
		icon: string;
		reality: number;
	}>;
};

/** Как `ServiceModule.calculateResults`. */
export function scoreService(
	answers: Record<string, number | ServiceExpectationRealityAnswer> | undefined
): ServiceScoreResult | null {
	if (!answers || Object.keys(answers).length === 0) return null;
	const dimensionResults: Record<
		string,
		{ expectation: number; reality: number; gap: number; count: number }
	> = {};
	for (const dim of Object.keys(SERVQUAL_DIMENSIONS)) {
		if (dim === 'effort') continue;
		dimensionResults[dim] = {
			expectation: 0,
			reality: 0,
			gap: 0,
			count: 0,
		};
	}
	for (const q of QUESTIONS.service) {
		const answer = answers[String(q.id)];
		if (!answer || !('dimension' in q)) continue;
		const dimension = q.dimension as string;
		if (dimension === 'effort') continue;
		if (
			typeof answer === 'object' &&
			'expectation' in answer &&
			'reality' in answer
		) {
			const er = answer as ServiceExpectationRealityAnswer;
			const dr = dimensionResults[dimension];
			if (dr) {
				dr.expectation += er.expectation;
				dr.reality += er.reality;
				dr.gap += er.gap;
				dr.count += 1;
			}
		}
	}
	for (const dim of Object.keys(dimensionResults)) {
		const r = dimensionResults[dim];
		if (r.count > 0) {
			r.expectation = Number((r.expectation / r.count).toFixed(2));
			r.reality = Number((r.reality / r.count).toFixed(2));
			r.gap = Number((r.gap / r.count).toFixed(2));
		}
	}
	const dims = Object.values(dimensionResults);
	const overallExpectation =
		dims.reduce((sum, dim) => sum + dim.expectation, 0) / 5;
	const overallReality = dims.reduce((sum, dim) => sum + dim.reality, 0) / 5;
	const overallGap = overallReality - overallExpectation;
	const serviceQualityIndex = Number(((overallReality / 7) * 10).toFixed(1));
	const criticalPoints = Object.entries(dimensionResults)
		.filter(([, result]) => result.count > 0)
		.sort(([, a], [, b]) => a.gap - b.gap)
		.slice(0, 3)
		.map(([dimension, result]) => ({
			dimension,
			name: SERVQUAL_DIMENSIONS[dimension]?.name ?? dimension,
			icon: SERVQUAL_DIMENSIONS[dimension]?.icon ?? '',
			gap: result.gap,
			improvement: improvementPotentialLabel(result.gap),
		}));
	const effortQuestions = QUESTIONS.service.filter(
		(q) => q.dimension === 'effort'
	);
	let effortScore = 0;
	let effortCount = 0;
	for (const q of effortQuestions) {
		const a = answers[String(q.id)];
		if (typeof a === 'number') {
			effortScore += a;
			effortCount += 1;
		}
	}
	const customerEffortScore =
		effortCount > 0 ? Number((effortScore / effortCount).toFixed(1)) : 0;
	const strengths = Object.entries(dimensionResults)
		.filter(([, result]) => result.count > 0 && result.gap >= -0.5)
		.sort(([, a], [, b]) => b.reality - a.reality)
		.slice(0, 2)
		.map(([dimension, result]) => ({
			dimension,
			name: SERVQUAL_DIMENSIONS[dimension]?.name ?? dimension,
			icon: SERVQUAL_DIMENSIONS[dimension]?.icon ?? '',
			reality: result.reality,
		}));
	return {
		dimensionResults,
		overallExpectation: Number(overallExpectation.toFixed(2)),
		overallReality: Number(overallReality.toFixed(2)),
		overallGap: Number(overallGap.toFixed(2)),
		serviceQualityIndex,
		customerEffortScore,
		criticalPoints,
		strengths,
	};
}

type EmotionAnswerEntry = {
	name: string;
	intensity: number;
	valence: number;
	color: string;
};

type ImpactAnswer = {
	importance: number;
	quality: number;
	influence: number;
	touchpoint: string;
};

function touchpointStatus(
	emotionalScore: number,
	qualityGap: number,
	criticality: number
): { type: string; label: string; color: string } {
	if (emotionalScore > 1 && qualityGap >= 0) {
		return { type: 'excellent', label: 'Превосходно', color: '#66BB6A' };
	}
	if (emotionalScore > 0 && qualityGap >= -1) {
		return { type: 'good', label: 'Хорошо', color: '#26A69A' };
	}
	if (emotionalScore >= -1 && qualityGap >= -2) {
		return { type: 'average', label: 'Средне', color: '#FF8C00' };
	}
	if (criticality >= 4) {
		return { type: 'critical', label: 'Критично', color: '#F44336' };
	}
	return {
		type: 'needs_improvement',
		label: 'Требует улучшения',
		color: '#FF5722',
	};
}

export type EmotionsScoreResult = {
	overallEmotionalIndex: number;
	touchpointResults: Array<{
		id: string;
		name: string;
		icon: string;
		status: { type: string; label: string; color: string };
	}>;
};

/** Как `EmotionsModule.calculateResults` (сокращённый вывод для UI). */
export function scoreEmotions(
	emotionsAnswers: Record<string, unknown> | undefined
): EmotionsScoreResult | null {
	if (!emotionsAnswers) return null;
	const touchpoints = emotionsAnswers.selectedTouchpoints;
	if (!Array.isArray(touchpoints) || touchpoints.length === 0) return null;
	const ids = touchpoints.filter((x): x is string => typeof x === 'string');
	let totalEmotionalScore = 0;
	let totalTouchpoints = 0;
	const touchpointResults: EmotionsScoreResult['touchpointResults'] = [];
	for (const touchpointId of ids) {
		const stage = EMOTIONS_JOURNEY_STAGES.find((s) => s.id === touchpointId);
		const emotionsAnswer = emotionsAnswers[
			`touchpoint_${touchpointId}_emotions`
		] as Record<string, EmotionAnswerEntry> | undefined;
		const impactAnswer = emotionsAnswers[`touchpoint_${touchpointId}_impact`] as
			| ImpactAnswer
			| undefined;
		if (!emotionsAnswer || !impactAnswer || !stage) continue;
		let positiveScore = 0;
		let negativeScore = 0;
		let emotionCount = 0;
		for (const emotion of Object.values(emotionsAnswer)) {
			if (emotion.valence === 1) positiveScore += emotion.intensity;
			else if (emotion.valence === -1) negativeScore += emotion.intensity;
			emotionCount += 1;
		}
		const emotionalBalance = positiveScore - negativeScore;
		const touchpointScore =
			(emotionalBalance + positiveScore * 0.5) / Math.max(1, emotionCount);
		const criticalityScore =
			(impactAnswer.importance + impactAnswer.influence) / 2;
		const qualityGap = impactAnswer.quality - criticalityScore;
		totalEmotionalScore += touchpointScore * criticalityScore;
		totalTouchpoints += criticalityScore;
		touchpointResults.push({
			id: touchpointId,
			name: stage.name,
			icon: stage.icon,
			status: touchpointStatus(touchpointScore, qualityGap, criticalityScore),
		});
	}
	if (touchpointResults.length === 0) return null;
	const overallEmotionalIndex =
		totalTouchpoints > 0
			? Math.round((totalEmotionalScore / totalTouchpoints) * 20)
			: 0;
	return { overallEmotionalIndex, touchpointResults };
}

export type DiagnosticComputedResults = {
	archetype: ArchetypeScoreResult | null;
	values: ValuesScoreResult | null;
	business: BusinessScoreResult | null;
	service: ServiceScoreResult | null;
	emotions: EmotionsScoreResult | null;
};

export function computeAllResults(
	answers: DiagnosticAnswersByModule,
	industry?: string
): DiagnosticComputedResults {
	return {
		archetype: scoreArchetype(answers.archetype),
		values: scoreValues(answers.values),
		business: scoreBusiness(answers.business, industry),
		service: scoreService(answers.service),
		emotions: scoreEmotions(answers.emotions),
	};
}

/** Снимок метрик одного модуля для истории на сервере (PATCH completed_module_metrics). */
export function computeModuleMetrics(
	moduleId: DiagnosticModuleId,
	answers: DiagnosticAnswersByModule,
	industry?: string
): Record<string, unknown> {
	switch (moduleId) {
		case 'archetype':
			return { archetype: scoreArchetype(answers.archetype) };
		case 'values':
			return { values: scoreValues(answers.values) };
		case 'business':
			return { business: scoreBusiness(answers.business, industry) };
		case 'service':
			return { service: scoreService(answers.service) };
		case 'emotions':
			return { emotions: scoreEmotions(answers.emotions) };
	}
}
