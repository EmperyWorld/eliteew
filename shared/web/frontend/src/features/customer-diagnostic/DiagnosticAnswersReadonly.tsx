import * as React from 'react';

import {
	EMOTIONS_JOURNEY_STAGES,
	EMOTIONS_WHEEL,
	MODULE_LABELS,
	QUESTIONS,
	SERVQUAL_DIMENSIONS,
} from './diagnosticDefinition';
import type {
	DiagnosticAnswersByModule,
	DiagnosticModuleId,
	ValuesQuestionAnswer,
} from './diagnosticTypes';

const LABEL_EXP = 'Важность (ожидание)';
const LABEL_CUR = 'Восприятие';
const LABEL_GAP = 'Разрыв';

export type DiagnosticAnswersReadonlyProps = {
	answers: DiagnosticAnswersByModule;
};

function ArchetypeReadonly({
	answers,
}: {
	answers: Record<string, number> | undefined;
}) {
	if (!answers || Object.keys(answers).length === 0) {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	return (
		<ul className="flex flex-col gap-3 text-sm">
			{QUESTIONS.archetype.map((q) => {
				const v = answers[String(q.id)];
				if (v === undefined) return null;
				const opt = q.options.find((o) => o.value === v);
				return (
					<li
						key={q.id}
						className="rounded-lg border border-white/10 bg-white/5 p-2"
					>
						<p className="text-xs font-medium text-(--desktop-text-secondary)">
							{q.text}
						</p>
						<p className="mt-1 text-(--desktop-text-primary)">
							{opt?.text ?? String(v)}
						</p>
					</li>
				);
			})}
		</ul>
	);
}

function ValuesReadonly({
	answers,
}: {
	answers: Record<string, ValuesQuestionAnswer> | undefined;
}) {
	if (!answers || Object.keys(answers).length === 0) {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	return (
		<ul className="flex flex-col gap-3 text-sm">
			{QUESTIONS.values.map((q) => {
				const raw = answers[String(q.id)];
				if (!raw) return null;
				return (
					<li
						key={q.id}
						className="rounded-lg border border-white/10 bg-white/5 p-2"
					>
						<p className="text-xs font-medium text-(--desktop-text-primary)">
							{q.text}
						</p>
						{q.description ? (
							<p className="text-[0.65rem] text-(--desktop-text-secondary)">
								{q.description}
							</p>
						) : null}
						{raw.type === 'scale' && q.type === 'scale' && q.statements ? (
							<ul className="mt-2 space-y-1 text-xs">
								{q.statements.map((st) => {
									const n = raw.values[st.value];
									if (n === undefined) return null;
									return (
										<li key={st.value} className="flex justify-between gap-2">
											<span className="text-(--desktop-text-secondary)">
												{st.text}
											</span>
											<span className="shrink-0 font-medium tabular-nums">
												{n}/7
											</span>
										</li>
									);
								})}
							</ul>
						) : null}
						{raw.type === 'choice' && q.type === 'choice' && q.options ? (
							<p className="mt-2 text-xs text-(--desktop-text-primary)">
								{q.options.find((o) => String(o.value) === raw.value)?.text ??
									raw.value}
							</p>
						) : null}
						{raw.type === 'ranking' && q.type === 'ranking' && q.options ? (
							<ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-(--desktop-text-primary)">
								{Object.entries(raw.values)
									.sort((a, b) => b[1] - a[1])
									.map(([key]) => {
										const label =
											q.options?.find((o) => String(o.value) === key)?.text ??
											key;
										return <li key={key}>{label}</li>;
									})}
							</ol>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

function BusinessReadonly({
	answers,
}: {
	answers: Record<string, number> | undefined;
}) {
	if (!answers || Object.keys(answers).length === 0) {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	return (
		<ul className="flex flex-col gap-3 text-sm">
			{QUESTIONS.business.map((q) => {
				const v = answers[String(q.id)];
				if (v === undefined) return null;
				let display = String(v);
				if (q.type === 'scale' && q.scale) {
					display = `${v} (${q.scale.labels?.[0] ?? ''} … ${q.scale.labels?.[1] ?? ''})`;
				}
				if (q.type === 'choice' && q.options) {
					const opt = q.options.find((o) => o.value === v);
					display = opt?.text ?? String(v);
				}
				return (
					<li
						key={q.id}
						className="rounded-lg border border-white/10 bg-white/5 p-2"
					>
						<p className="text-xs text-(--desktop-text-secondary)">
							{q.area ? (
								<span className="mr-1 rounded bg-white/10 px-1 py-0.5 text-[0.6rem] uppercase">
									{q.area}
								</span>
							) : null}
							{q.text}
						</p>
						<p className="mt-1 text-(--desktop-text-primary)">{display}</p>
					</li>
				);
			})}
		</ul>
	);
}

function ServiceReadonly({
	answers,
}: {
	answers: Record<string, unknown> | undefined;
}) {
	if (!answers || Object.keys(answers).length === 0) {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	return (
		<ul className="flex flex-col gap-3 text-sm">
			{QUESTIONS.service.map((q) => {
				const raw = answers[String(q.id)];
				if (raw === undefined) return null;
				let body: React.ReactNode = null;
				if (
					q.type === 'expectation_reality' &&
					raw &&
					typeof raw === 'object' &&
					'expectation' in raw
				) {
					const er = raw as {
						expectation: number;
						reality: number;
						gap: number;
					};
					body = (
						<p className="text-xs text-(--desktop-text-primary)">
							{LABEL_EXP}: {er.expectation} / {LABEL_CUR}: {er.reality} (
							{LABEL_GAP}: {er.gap > 0 ? '+' : ''}
							{er.gap})
						</p>
					);
				} else if (q.type === 'effort_scale' && typeof raw === 'number') {
					body = (
						<p className="text-xs text-(--desktop-text-primary)">{raw}/5</p>
					);
				} else if (
					q.type === 'choice' &&
					q.options &&
					typeof raw === 'number'
				) {
					const opt = q.options.find((o) => o.value === raw);
					body = (
						<p className="text-xs text-(--desktop-text-primary)">
							{opt?.text ?? String(raw)}
						</p>
					);
				}
				const dim =
					'dimension' in q && q.dimension
						? SERVQUAL_DIMENSIONS[String(q.dimension)]?.name
						: null;
				return (
					<li
						key={q.id}
						className="rounded-lg border border-white/10 bg-white/5 p-2"
					>
						<p className="text-xs text-(--desktop-text-secondary)">
							{dim ? `${dim}: ` : null}
							{q.text}
						</p>
						{q.description ? (
							<p className="text-[0.65rem] text-(--desktop-text-secondary)">
								{q.description}
							</p>
						) : null}
						<div className="mt-1">{body}</div>
					</li>
				);
			})}
		</ul>
	);
}

function EmotionsReadonly({
	answers,
}: {
	answers: Record<string, unknown> | undefined;
}) {
	if (!answers || typeof answers !== 'object') {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	const tp = Array.isArray(answers.selectedTouchpoints)
		? (answers.selectedTouchpoints as string[])
		: [];
	if (tp.length === 0 && Object.keys(answers).length <= 1) {
		return <p className="text-xs text-(--desktop-text-secondary)">—</p>;
	}
	return (
		<div className="flex flex-col gap-4 text-sm">
			<div>
				<p className="mb-1 text-xs font-medium text-(--desktop-text-secondary)">
					Этапы пути клиента
				</p>
				<ul className="flex flex-col gap-1">
					{tp.map((id) => {
						const st = EMOTIONS_JOURNEY_STAGES.find((s) => s.id === id);
						return (
							<li key={id} className="text-(--desktop-text-primary)">
								{st ? `${st.icon} ${st.name}` : id}
							</li>
						);
					})}
				</ul>
			</div>
			{tp.map((tid) => {
				const emKey = `touchpoint_${tid}_emotions`;
				const imKey = `touchpoint_${tid}_impact`;
				const emRaw = answers[emKey];
				const impRaw = answers[imKey] as
					| {
							importance: number;
							quality: number;
							influence: number;
					  }
					| undefined;
				const stage = EMOTIONS_JOURNEY_STAGES.find((s) => s.id === tid);
				return (
					<div
						key={tid}
						className="rounded-lg border border-white/10 bg-white/5 p-2"
					>
						<p className="text-xs font-medium text-(--desktop-text-primary)">
							{stage ? `${stage.icon} ${stage.name}` : tid}
						</p>
						{emRaw && typeof emRaw === 'object' && !Array.isArray(emRaw) ? (
							<ul className="mt-2 space-y-1 text-xs text-(--desktop-text-secondary)">
								{Object.entries(emRaw as Record<string, unknown>).map(
									([key, val]) => {
										if (key === 'selectedTouchpoints') return null;
										const meta = EMOTIONS_WHEEL[key];
										const row = val as
											| { intensity?: number; name?: string }
											| undefined;
										if (!row || typeof row !== 'object') return null;
										return (
											<li key={key}>
												{meta?.name ?? key}: интенсивность{' '}
												{row.intensity ?? '—'}
											</li>
										);
									}
								)}
							</ul>
						) : null}
						{impRaw ? (
							<p className="mt-2 text-xs text-(--desktop-text-primary)">
								Важность: {impRaw.importance}, качество: {impRaw.quality},
								влияние: {impRaw.influence}
							</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

const MODULE_ORDER: DiagnosticModuleId[] = [
	'archetype',
	'values',
	'business',
	'service',
	'emotions',
];

export function DiagnosticAnswersReadonly({
	answers,
}: DiagnosticAnswersReadonlyProps) {
	return (
		<div className="flex flex-col gap-4">
			{MODULE_ORDER.map((mid) => (
				<section key={mid}>
					<h4 className="mb-2 text-sm font-semibold text-(--desktop-text-primary)">
						{MODULE_LABELS[mid]}
					</h4>
					{mid === 'archetype' ? (
						<ArchetypeReadonly answers={answers.archetype} />
					) : null}
					{mid === 'values' ? (
						<ValuesReadonly answers={answers.values} />
					) : null}
					{mid === 'business' ? (
						<BusinessReadonly answers={answers.business} />
					) : null}
					{mid === 'service' ? (
						<ServiceReadonly
							answers={answers.service as Record<string, unknown> | undefined}
						/>
					) : null}
					{mid === 'emotions' ? (
						<EmotionsReadonly
							answers={answers.emotions as Record<string, unknown> | undefined}
						/>
					) : null}
				</section>
			))}
		</div>
	);
}
