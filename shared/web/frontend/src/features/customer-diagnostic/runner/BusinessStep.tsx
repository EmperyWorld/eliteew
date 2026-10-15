/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Business module step: scale and choice answers.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { QUESTIONS } from '../diagnosticDefinition';

export function BusinessStep({
	step,
	answers,
	setAnswer,
}: {
	step: number;
	answers: Record<string, number>;
	setAnswer: (qid: number, v: number) => void;
}) {
	const q = QUESTIONS.business[step];
	if (!q) return null;
	const val = answers[String(q.id)];
	if (q.type === 'scale' && q.scale) {
		const opts: number[] = [];
		for (let i = q.scale.min; i <= q.scale.max; i++) opts.push(i);
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				<div className="flex flex-wrap gap-1">
					{opts.map((n) => (
						<label
							key={n}
							className="flex cursor-pointer items-center gap-1 rounded border border-(--desktop-border-subtle) px-2 py-1 text-xs"
						>
							<input
								type="radio"
								name={`bus_${q.id}`}
								checked={val === n}
								onChange={() => setAnswer(q.id, n)}
							/>
							{n}
						</label>
					))}
				</div>
			</div>
		);
	}
	if (q.type === 'choice' && q.options) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
				<div className="flex flex-col gap-1">
					{q.options.map((opt) => (
						<label
							key={opt.value}
							className="flex cursor-pointer items-center gap-2 rounded-md border border-(--desktop-border-subtle) px-2 py-1.5 text-sm"
						>
							<input
								type="radio"
								name={`bus_${q.id}`}
								checked={val === opt.value}
								onChange={() => setAnswer(q.id, opt.value)}
							/>
							{opt.text}
						</label>
					))}
				</div>
			</div>
		);
	}
	return null;
}
