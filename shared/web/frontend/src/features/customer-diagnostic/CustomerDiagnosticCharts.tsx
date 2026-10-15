/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Recharts visualizations for customer diagnostic computed results.
 *
 * Invariants:
 * - Charts mount inside RechartsSizedFrame only after layout size is positive.
 *
 * Related:
 * - DiagnosticResultsSection.tsx, RechartsSizedFrame.tsx
 */
import * as React from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

import { RechartsSizedFrame } from '@/components/charts/RechartsSizedFrame';

import { hexToRgba } from './diagnosticChartColors';
import {
	ARCHETYPE_CATALOG,
	BUSINESS_AREAS,
	SERVQUAL_DIMENSIONS,
} from './diagnosticDefinition';
import type { DiagnosticComputedResults } from './diagnosticScoring';

const TOOLTIP_STYLE: React.CSSProperties = {
	backgroundColor:
		'color-mix(in srgb, var(--desktop-surface-panel) 94%, transparent)',
	border:
		'1px solid color-mix(in srgb, var(--desktop-border-subtle) 85%, transparent)',
	borderRadius: '8px',
	fontSize: '12px',
	color: 'var(--desktop-text-primary)',
	boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
};

const TOOLTIP_PROPS = {
	contentStyle: TOOLTIP_STYLE,
	labelStyle: { color: 'var(--desktop-text-secondary)' } as React.CSSProperties,
	itemStyle: { color: 'var(--desktop-text-primary)' } as React.CSSProperties,
	cursor: false as const,
};

/** Порядок вершин радара — как в каталоге, иначе полигон «ломается». */
const ARCHETYPE_DISPLAY_ORDER = Object.keys(ARCHETYPE_CATALOG);

const BUSINESS_AREA_ORDER = Object.keys(BUSINESS_AREAS);

const SERVICE_DIM_ORDER = [
	'tangibles',
	'reliability',
	'responsiveness',
	'assurance',
	'empathy',
] as const;

const RADAR_TEAL = '#2dd4bf';
const RADAR_TEAL_FILL = 'rgba(45, 212, 191, 0.25)';
const RADAR_PURPLE = '#a78bfa';
const RADAR_PURPLE_FILL = 'rgba(167, 139, 250, 0.22)';
const BAR_REALITY = '#2dd4bf';

function truncateLabel(s: string, max = 14): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1)}…`;
}

export function DiagnosticResultsCharts({
	results,
	t,
}: {
	results: DiagnosticComputedResults;
	t: (key: string, options?: Record<string, string | number>) => string;
}): React.ReactNode {
	const archetypeData = React.useMemo(() => {
		const p = results.archetype?.percentages;
		if (!p) return [];
		const topIds = Object.entries(p)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([id]) => id);
		const pick = new Set(topIds);
		return ARCHETYPE_DISPLAY_ORDER.filter((id) => pick.has(id))
			.map((id) => ({
				id,
				name: truncateLabel(ARCHETYPE_CATALOG[id]?.name ?? id),
				value: p[id] ?? 0,
			}))
			.filter((row) => row.value > 0);
	}, [results.archetype]);

	const valuesData = React.useMemo(() => {
		const p = results.values?.percentages;
		if (!p) return [];
		const order = [
			'power',
			'achievement',
			'hedonism',
			'stimulation',
			'self_direction',
			'universalism',
			'benevolence',
			'tradition',
			'conformity',
			'security',
		];
		return order
			.filter((k) => p[k] !== undefined)
			.map((k) => ({
				key: k,
				name: truncateLabel(t(`diagnostic.valueAxis.${k}`)),
				value: p[k] ?? 0,
			}));
	}, [results.values, t]);

	const businessData = React.useMemo(() => {
		const a = results.business?.areaScores;
		if (!a) return [];
		return BUSINESS_AREA_ORDER.map((areaKey) => ({
			key: areaKey,
			name: truncateLabel(BUSINESS_AREAS[areaKey]?.name ?? areaKey, 22),
			score: a[areaKey] ?? 0,
			fill: BUSINESS_AREAS[areaKey]?.color ?? RADAR_TEAL,
		}));
	}, [results.business]);

	const serviceData = React.useMemo(() => {
		const d = results.service?.dimensionResults;
		if (!d) return [];
		return SERVICE_DIM_ORDER.filter((dim) => d[dim] && d[dim].count > 0).map(
			(dim) => {
				const v = d[dim];
				const base = SERVQUAL_DIMENSIONS[dim]?.color ?? BAR_REALITY;
				return {
					dimKey: dim,
					name: truncateLabel(SERVQUAL_DIMENSIONS[dim]?.name ?? dim),
					expectation: v.expectation,
					reality: v.reality,
					expectFill: hexToRgba(base, 0.38),
					realityFill: base,
				};
			}
		);
	}, [results.service]);

	const hasAny =
		archetypeData.length > 0 ||
		valuesData.length > 0 ||
		businessData.length > 0 ||
		serviceData.length > 0;

	if (!hasAny) return null;

	return (
		<div className="flex flex-col gap-6">
			{archetypeData.length > 0 ? (
				<section className="flex flex-col gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.chartArchetype')}
					</h3>
					<RechartsSizedFrame className="h-[260px]" minHeight={260}>
						<RadarChart
							cx="50%"
							cy="50%"
							outerRadius="70%"
							data={archetypeData}
						>
							<PolarGrid stroke="var(--desktop-border-subtle)" />
							<PolarAngleAxis
								dataKey="name"
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 10 }}
							/>
							<PolarRadiusAxis
								angle={30}
								domain={[0, 100]}
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 9 }}
							/>
							<Radar
								name={t('diagnostic.chartShare')}
								dataKey="value"
								stroke={RADAR_TEAL}
								fill={RADAR_TEAL_FILL}
								fillOpacity={0.85}
							/>
							<Tooltip {...TOOLTIP_PROPS} />
						</RadarChart>
					</RechartsSizedFrame>
				</section>
			) : null}

			{valuesData.length > 0 ? (
				<section className="flex flex-col gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.chartValues')}
					</h3>
					<RechartsSizedFrame className="h-[280px]" minHeight={280}>
						<RadarChart cx="50%" cy="50%" outerRadius="68%" data={valuesData}>
							<PolarGrid stroke="var(--desktop-border-subtle)" />
							<PolarAngleAxis
								dataKey="name"
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 9 }}
							/>
							<PolarRadiusAxis
								angle={30}
								domain={[0, 100]}
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 9 }}
							/>
							<Radar
								name={t('diagnostic.chartShare')}
								dataKey="value"
								stroke={RADAR_PURPLE}
								fill={RADAR_PURPLE_FILL}
								fillOpacity={0.9}
							/>
							<Tooltip {...TOOLTIP_PROPS} />
						</RadarChart>
					</RechartsSizedFrame>
				</section>
			) : null}

			{businessData.length > 0 ? (
				<section className="flex flex-col gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.chartBusiness')}
					</h3>
					<RechartsSizedFrame className="h-[220px]" minHeight={220}>
						<BarChart
							data={businessData}
							margin={{ left: 4, right: 8, top: 8 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--desktop-border-subtle)"
								vertical={false}
								opacity={0.5}
							/>
							<XAxis
								dataKey="name"
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 10 }}
								stroke="var(--desktop-border-subtle)"
								interval={0}
								height={52}
								tickMargin={6}
							/>
							<YAxis
								domain={[0, 100]}
								width={36}
								stroke="var(--desktop-border-subtle)"
								tick={{
									fill: 'var(--desktop-text-secondary)',
									fontSize: 10,
								}}
							/>
							<Tooltip {...TOOLTIP_PROPS} />
							<Bar
								dataKey="score"
								name={t('diagnostic.chartScore')}
								radius={[4, 4, 0, 0]}
								activeBar={false}
							>
								{businessData.map((row) => (
									<Cell key={row.key} fill={row.fill} />
								))}
							</Bar>
						</BarChart>
					</RechartsSizedFrame>
				</section>
			) : null}

			{serviceData.length > 0 ? (
				<section className="flex flex-col gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
						{t('diagnostic.chartService')}
					</h3>
					<RechartsSizedFrame className="h-[240px]" minHeight={240}>
						<BarChart data={serviceData} margin={{ left: 4, right: 8, top: 8 }}>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--desktop-border-subtle)"
								vertical={false}
								opacity={0.5}
							/>
							<XAxis
								dataKey="name"
								tick={{ fill: 'var(--desktop-text-secondary)', fontSize: 10 }}
								stroke="var(--desktop-border-subtle)"
								interval={0}
								height={52}
								tickMargin={6}
							/>
							<YAxis
								domain={[0, 7]}
								width={30}
								stroke="var(--desktop-border-subtle)"
								tick={{
									fill: 'var(--desktop-text-secondary)',
									fontSize: 10,
								}}
							/>
							<Tooltip {...TOOLTIP_PROPS} />
							<Legend
								wrapperStyle={{
									fontSize: '11px',
									color: 'var(--desktop-text-secondary)',
								}}
							/>
							<Bar
								dataKey="expectation"
								name={t('diagnostic.chartExpectation')}
								radius={[4, 4, 0, 0]}
								activeBar={false}
							>
								{serviceData.map((row) => (
									<Cell key={`e-${row.dimKey}`} fill={row.expectFill} />
								))}
							</Bar>
							<Bar
								dataKey="reality"
								name={t('diagnostic.chartReality')}
								radius={[4, 4, 0, 0]}
								activeBar={false}
							>
								{serviceData.map((row) => (
									<Cell key={`r-${row.dimKey}`} fill={row.realityFill} />
								))}
							</Bar>
						</BarChart>
					</RechartsSizedFrame>
				</section>
			) : null}
		</div>
	);
}
