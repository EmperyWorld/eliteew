/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Archetype module step: single-choice radio answers.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import { QUESTIONS } from '../diagnosticDefinition';

export function ArchetypeStep({
	step,
	answers,
	setAnswer,
}: {
	step: number;
	answers: Record<string, number>;
	setAnswer: (qid: number, v: number) => void;
}) {
	const q = QUESTIONS.archetype[step];
	if (!q) return null;
	const val = answers[String(q.id)];
	return (
		<div className="flex flex-col gap-2">
			<p className="text-sm text-(--desktop-text-primary)">{q.text}</p>
			<div className="flex flex-col gap-1">
				{q.options.map((opt) => (
					<label
						key={opt.value}
						className="flex cursor-pointer items-center gap-2 rounded-md border border-(--desktop-border-subtle) px-2 py-1.5 text-sm hover:bg-(--desktop-surface-muted)"
					>
						<input
							type="radio"
							name={`arch_${q.id}`}
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
