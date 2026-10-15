/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Service module step: expectation/reality, effort scale, and choice answers.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { QUESTIONS } from '../diagnosticDefinition';
import type { CustomerDiagnosticDraftUpdater } from './runnerTypes';

export function ServiceStep({
	step,
	answers,
	updateDraft,
}: {
	step: number;
	answers: Record<string, unknown>;
	updateDraft: CustomerDiagnosticDraftUpdater;
}) {
	const q = QUESTIONS.service[step];
	if (!q) return null;

	if (q.type === 'expectation_reality') {
		const existing = answers[String(q.id)] as
			| { expectation: number; reality: number; gap: number }
			| undefined;
		const setEr = (exp: number, real: number): void => {
			updateDraft((p) => ({
				...p,
				answers: {
					...p.answers,
					service: {
						...p.answers.service,
						[String(q.id)]: {
							expectation: exp,
							reality: real,
							gap: real - exp,
						},
					},
				},
			}));
		};
		return (
			<div className="flex flex-col gap-3">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				<div>
					<p className="text-xs text-(--desktop-text-secondary)">Важность</p>
					<div className="flex flex-wrap gap-1">
						{[1, 2, 3, 4, 5, 6, 7].map((n) => (
							<label
								key={`e${n}`}
								className="flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
							>
								<input
									type="radio"
									name={`svc_e_${q.id}`}
									checked={existing?.expectation === n}
									onChange={() => setEr(n, existing?.reality ?? n)}
								/>
								{n}
							</label>
						))}
					</div>
				</div>
				<div>
					<p className="text-xs text-(--desktop-text-secondary)">
						Текущее состояние
					</p>
					<div className="flex flex-wrap gap-1">
						{[1, 2, 3, 4, 5, 6, 7].map((n) => (
							<label
								key={`r${n}`}
								className="flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
							>
								<input
									type="radio"
									name={`svc_r_${q.id}`}
									checked={existing?.reality === n}
									onChange={() => setEr(existing?.expectation ?? n, n)}
								/>
								{n}
							</label>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (q.type === 'effort_scale') {
		const v = answers[String(q.id)] as number | undefined;
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				<div className="flex flex-wrap gap-1">
					{[1, 2, 3, 4, 5].map((n) => (
						<label
							key={n}
							className="flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs"
						>
							<input
								type="radio"
								name={`svc_eff_${q.id}`}
								checked={v === n}
								onChange={() =>
									updateDraft((p) => ({
										...p,
										answers: {
											...p.answers,
											service: { ...p.answers.service, [String(q.id)]: n },
										},
									}))
								}
							/>
							{n}
						</label>
					))}
				</div>
			</div>
		);
	}

	if (q.type === 'choice' && q.options) {
		const v = answers[String(q.id)] as number | undefined;
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				{q.options.map((opt) => (
					<label
						key={opt.value}
						className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
					>
						<input
							type="radio"
							name={`svc_ch_${q.id}`}
							checked={v === opt.value}
							onChange={() =>
								updateDraft((p) => ({
									...p,
									answers: {
										...p.answers,
										service: {
											...p.answers.service,
											[String(q.id)]: opt.value,
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

	return null;
}
