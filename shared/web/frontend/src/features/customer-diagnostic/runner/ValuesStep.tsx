/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Values module step: scale, choice, and ranking answers.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { QUESTIONS } from '../diagnosticDefinition';
import type { ValuesQuestionAnswer } from '../diagnosticTypes';
import type { CustomerDiagnosticDraftUpdater } from './runnerTypes';

export function ValuesStep({
	step,
	answers,
	updateDraft,
}: {
	step: number;
	answers: Record<string, ValuesQuestionAnswer>;
	updateDraft: CustomerDiagnosticDraftUpdater;
}) {
	const q = QUESTIONS.values[step];
	if (!q) return null;

	if (q.type === 'scale' && q.statements) {
		const existing = answers[String(q.id)];
		const values = existing?.type === 'scale' ? existing.values : {};
		const setStmt = (stmt: string, v: number): void => {
			updateDraft((p) => {
				const prev = p.answers.values?.[String(q.id)];
				const merged =
					prev?.type === 'scale'
						? { ...prev.values, [stmt]: v }
						: { [stmt]: v };
				return {
					...p,
					answers: {
						...p.answers,
						values: {
							...p.answers.values,
							[String(q.id)]: { type: 'scale', values: merged },
						},
					},
				};
			});
		};
		return (
			<div className="flex flex-col gap-3">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				{q.statements.map((st) => (
					<div key={st.value} className="flex flex-col gap-1">
						<p className="text-xs text-(--desktop-text-secondary)">{st.text}</p>
						<div className="flex flex-wrap gap-1">
							{[1, 2, 3, 4, 5, 6, 7].map((n) => (
								<label
									key={n}
									className="flex cursor-pointer items-center gap-1 rounded border border-(--desktop-border-subtle) px-2 py-0.5 text-xs"
								>
									<input
										type="radio"
										name={`val_${q.id}_${st.value}`}
										checked={values[st.value] === n}
										onChange={() => setStmt(st.value, n)}
									/>
									{n}
								</label>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (q.type === 'choice' && q.options) {
		const existing = answers[String(q.id)];
		const val = existing?.type === 'choice' ? existing.value : '';
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				{q.options.map((opt) => (
					<label
						key={opt.value}
						className="flex cursor-pointer items-center gap-2 rounded-md border border-(--desktop-border-subtle) px-2 py-1.5 text-sm"
					>
						<input
							type="radio"
							name={`val_${q.id}`}
							checked={val === opt.value}
							onChange={() =>
								updateDraft((p) => ({
									...p,
									answers: {
										...p.answers,
										values: {
											...p.answers.values,
											[String(q.id)]: {
												type: 'choice',
												value: String(opt.value),
											},
										},
									},
								}))
							}
						/>
						{opt.text}
					</label>
				))}
			</div>
		);
	}

	if (q.type === 'ranking' && q.options) {
		const existing = answers[String(q.id)];
		const order =
			existing?.type === 'ranking'
				? Object.entries(existing.values)
						.sort((a, b) => b[1] - a[1])
						.map(([k]) => k)
				: q.options.map((o) => String(o.value));
		const move = (idx: number, dir: -1 | 1): void => {
			const next = [...order];
			const j = idx + dir;
			if (j < 0 || j >= next.length) return;
			[next[idx], next[j]] = [next[j], next[idx]];
			const ranking: Record<string, number> = {};
			next.forEach((key, i) => {
				ranking[key] = next.length - i;
			});
			updateDraft((p) => ({
				...p,
				answers: {
					...p.answers,
					values: {
						...p.answers.values,
						[String(q.id)]: { type: 'ranking', values: ranking },
					},
				},
			}));
		};
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				<p className="text-xs text-(--desktop-text-secondary)">
					Вверху — важнее (кнопки вверх/вниз).
				</p>
				<ul className="flex flex-col gap-1">
					{order.map((key, idx) => {
						const label =
							q.options?.find((o) => String(o.value) === key)?.text ?? key;
						return (
							<li
								key={key}
								className="flex items-center justify-between gap-2 rounded border border-(--desktop-border-subtle) px-2 py-1 text-sm"
							>
								<span>{label}</span>
								<span className="flex gap-1">
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={() => move(idx, -1)}
									>
										↑
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										onClick={() => move(idx, 1)}
									>
										↓
									</DesktopAppButton>
								</span>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	return null;
}
