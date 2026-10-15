import * as React from 'react';
import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from 'recharts';

import {
	ARCHETYPE_CATALOG,
	BUSINESS_AREAS,
	SERVQUAL_DIMENSIONS,
} from './diagnosticDefinition';
import type {
	DiagnosticAnswersByModule,
	DiagnosticModuleId,
} from './diagnosticTypes';
import {
	scoreArchetype,
	scoreBusiness,
	scoreEmotions,
	scoreService,
	scoreValues,
} from './diagnosticScoring';

const MINI_BAR = '#2dd4bf';
const MINI_BAR_ALT = '#a78bfa';

function trunc(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1)}…`;
}

const EMOTION_STATUS_VALUE: Record<string, number> = {
	excellent: 100,
	good: 78,
	average: 55,
	critical: 28,
	needs_improvement: 42,
};

function MiniBarHorizontal({
	data,
	dataKey,
	barColor,
	yWidth,
	domainMax = 100,
	cellFills,
}: {
	data: Array<Record<string, string | number>>;
	dataKey: string;
	barColor: string;
	yWidth: number;
	domainMax?: number;
	cellFills?: string[];
}): React.ReactNode {
	if (data.length === 0) return null;
	return (
		<div className="mt-2 h-[84px] w-full min-w-0 border-t border-white/10 pt-2">
			<ResponsiveContainer width="100%" height="100%">
				<BarChart
					data={data}
					layout="vertical"
					margin={{ left: 2, right: 6, top: 2, bottom: 0 }}
				>
					<XAxis type="number" domain={[0, domainMax]} hide />
					<YAxis
						type="category"
						dataKey="name"
						width={yWidth}
						tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 9 }}
						axisLine={false}
						tickLine={false}
					/>
					<Bar dataKey={dataKey} radius={[0, 3, 3, 0]} barSize={9}>
						{data.map((_, i) => (
							<Cell
								key={String(i)}
								fill={cellFills?.[i] ?? (i % 2 === 0 ? barColor : MINI_BAR_ALT)}
							/>
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

export function ModuleCompletionPreview({
	moduleId,
	answers,
	t,
}: {
	moduleId: DiagnosticModuleId;
	answers: DiagnosticAnswersByModule;
	t: (key: string, options?: Record<string, string | number>) => string;
}): React.ReactNode {
	switch (moduleId) {
		case 'archetype': {
			const r = scoreArchetype(answers.archetype);
			if (!r) return null;
			const data = Object.entries(r.percentages)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([id, v]) => ({
					name: trunc(ARCHETYPE_CATALOG[id]?.name ?? id, 11),
					v,
				}));
			return (
				<MiniBarHorizontal
					data={data}
					dataKey="v"
					barColor={MINI_BAR}
					yWidth={58}
				/>
			);
		}
		case 'values': {
			const r = scoreValues(answers.values);
			if (!r) return null;
			const data = Object.entries(r.percentages)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 6)
				.map(([key, v]) => ({
					name: trunc(t(`diagnostic.valueAxis.${key}`), 12),
					v,
				}));
			return (
				<MiniBarHorizontal
					data={data}
					dataKey="v"
					barColor={MINI_BAR}
					yWidth={54}
				/>
			);
		}
		case 'business': {
			const r = scoreBusiness(answers.business);
			if (!r) return null;
			const order = Object.keys(BUSINESS_AREAS);
			const data = order.map((areaKey) => ({
				name: trunc(BUSINESS_AREAS[areaKey]?.name ?? areaKey, 13),
				v: r.areaScores[areaKey] ?? 0,
			}));
			return (
				<MiniBarHorizontal
					data={data}
					dataKey="v"
					barColor={MINI_BAR}
					yWidth={64}
				/>
			);
		}
		case 'service': {
			const r = scoreService(answers.service);
			if (!r) return null;
			const dimOrder = [
				'tangibles',
				'reliability',
				'responsiveness',
				'assurance',
				'empathy',
			] as const;
			const data = dimOrder
				.filter((dim) => r.dimensionResults[dim]?.count > 0)
				.map((dim) => {
					const dimR = r.dimensionResults[dim];
					return {
						name: trunc(SERVQUAL_DIMENSIONS[dim]?.name ?? dim, 11),
						v: Math.min(100, Math.round((dimR.reality / 7) * 100)),
					};
				});
			return (
				<MiniBarHorizontal
					data={data}
					dataKey="v"
					barColor={MINI_BAR}
					yWidth={56}
				/>
			);
		}
		case 'emotions': {
			const r = scoreEmotions(answers.emotions);
			if (!r || r.touchpointResults.length === 0) return null;
			const data = r.touchpointResults.map((tp) => ({
				name: trunc(`${tp.icon} ${tp.name}`, 14),
				v: EMOTION_STATUS_VALUE[tp.status.type] ?? 50,
			}));
			const cellFills = r.touchpointResults.map((tp) => tp.status.color);
			return (
				<MiniBarHorizontal
					data={data}
					dataKey="v"
					barColor={MINI_BAR}
					yWidth={68}
					cellFills={cellFills}
				/>
			);
		}
		default:
			return null;
	}
}
