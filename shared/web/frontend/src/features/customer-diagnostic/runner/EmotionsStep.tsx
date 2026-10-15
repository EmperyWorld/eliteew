/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Emotions module step: touchpoint selection, emotion wheel, and impact scales.
 *
 * Invariants:
 * - Step 0 requires 4–8 touchpoints; later steps pair emotion + impact per touchpoint.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 */

import {
	EMOTIONS_JOURNEY_STAGES,
	EMOTIONS_WHEEL,
} from '../diagnosticDefinition';
import type { CustomerDiagnosticSessionState } from '../diagnosticTypes';
import type { CustomerDiagnosticDraftUpdater } from './runnerTypes';

export function EmotionsStep({
	draft,
	updateDraft,
	step,
}: {
	draft: CustomerDiagnosticSessionState;
	updateDraft: CustomerDiagnosticDraftUpdater;
	step: number;
}) {
	const em = draft.answers.emotions;
	const tp =
		em && typeof em === 'object' && Array.isArray(em.selectedTouchpoints)
			? (em.selectedTouchpoints as string[])
			: [];

	if (step === 0) {
		const toggle = (id: string): void => {
			updateDraft((p) => {
				const cur = p.answers.emotions;
				const list: string[] =
					cur &&
					typeof cur === 'object' &&
					Array.isArray(cur.selectedTouchpoints)
						? [...(cur.selectedTouchpoints as string[])]
						: [];
				const i = list.indexOf(id);
				if (i >= 0) list.splice(i, 1);
				else if (list.length < 8) list.push(id);
				return {
					...p,
					answers: {
						...p.answers,
						emotions: {
							...(typeof cur === 'object' ? cur : {}),
							selectedTouchpoints: list,
						},
					},
				};
			});
		};
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-(--desktop-text-primary)">
					Выберите от 4 до 8 этапов пути клиента.
				</p>
				<div className="flex flex-col gap-1">
					{EMOTIONS_JOURNEY_STAGES.map((s) => (
						<label
							key={s.id}
							className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm"
						>
							<input
								type="checkbox"
								checked={tp.includes(s.id)}
								onChange={() => toggle(s.id)}
							/>
							<span>
								{s.icon} {s.name}
							</span>
						</label>
					))}
				</div>
				<p className="text-xs text-(--desktop-text-secondary)">
					Выбрано: {tp.length}
				</p>
			</div>
		);
	}

	const stageIndex = step - 1;
	if (stageIndex < 0 || stageIndex >= tp.length * 2) return null;
	const touchIdx = Math.floor(stageIndex / 2);
	const isEmo = stageIndex % 2 === 0;
	const tid = tp[touchIdx];
	const stage = EMOTIONS_JOURNEY_STAGES.find((s) => s.id === tid);
	if (!stage) return null;

	if (isEmo) {
		const qid = `touchpoint_${tid}_emotions`;
		const cur =
			em && typeof em === 'object'
				? (em[qid] as
						| Record<
								string,
								{
									name: string;
									intensity: number;
									valence: number;
									color: string;
								}
						  >
						| undefined)
				: undefined;
		const setEmotionRow = (
			key: string,
			patch: { active: boolean; intensity?: number }
		): void => {
			updateDraft((p) => {
				const base = p.answers.emotions;
				const prev = base && typeof base === 'object' ? { ...base } : {};
				const ex = { ...(typeof cur === 'object' ? cur : {}) };
				const meta = EMOTIONS_WHEEL[key];
				if (!patch.active) {
					delete ex[key];
				} else {
					const intensity = patch.intensity ?? ex[key]?.intensity ?? 3;
					ex[key] = {
						name: meta.name,
						intensity,
						valence: meta.valence,
						color: meta.color,
					};
				}
				return {
					...p,
					answers: {
						...p.answers,
						emotions: { ...prev, [qid]: ex, selectedTouchpoints: tp },
					},
				};
			});
		};
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">
					{stage.icon} {stage.name}: эмоции
				</p>
				<p className="text-xs text-(--desktop-text-secondary)">
					Отметьте эмоции и интенсивность (можно несколько).
				</p>
				{Object.entries(EMOTIONS_WHEEL).map(([key, meta]) => {
					const row = cur?.[key];
					const active = Boolean(row);
					return (
						<div
							key={key}
							className="rounded border border-(--desktop-border-subtle) p-2"
						>
							<label className="flex cursor-pointer items-center gap-2 text-xs">
								<input
									type="checkbox"
									checked={active}
									onChange={(e) =>
										setEmotionRow(key, { active: e.target.checked })
									}
								/>
								{meta.name}
							</label>
							{active ? (
								<div className="mt-1 flex flex-wrap gap-1">
									{[1, 2, 3, 4, 5].map((n) => (
										<label key={n} className="flex items-center gap-1 text-xs">
											<input
												type="radio"
												name={`emo_${tid}_${key}_i`}
												checked={row?.intensity === n}
												onChange={() =>
													setEmotionRow(key, { active: true, intensity: n })
												}
											/>
											{n}
										</label>
									))}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		);
	}

	const iq = `touchpoint_${tid}_impact`;
	const imp =
		em && typeof em === 'object'
			? (em[iq] as
					| {
							importance: number;
							quality: number;
							influence: number;
							touchpoint: string;
					  }
					| undefined)
			: undefined;
	const setImp = (
		field: 'importance' | 'quality' | 'influence',
		n: number
	): void => {
		updateDraft((p) => {
			const base = p.answers.emotions;
			const prev = base && typeof base === 'object' ? { ...base } : {};
			const next = {
				importance: imp?.importance ?? 4,
				quality: imp?.quality ?? 4,
				influence: imp?.influence ?? 4,
				touchpoint: tid,
				[field]: n,
			};
			return {
				...p,
				answers: {
					...p.answers,
					emotions: { ...prev, [iq]: next, selectedTouchpoints: tp },
				},
			};
		});
	};
	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm font-medium">
				{stage.icon} {stage.name}: влияние
			</p>
			{(
				[
					['importance', 'Важность этапа'],
					['quality', 'Качество опыта'],
					['influence', 'Влияние на решение'],
				] as const
			).map(([field, label]) => (
				<div key={field}>
					<p className="text-xs text-(--desktop-text-secondary)">{label}</p>
					<div className="flex flex-wrap gap-1">
						{[1, 2, 3, 4, 5, 6, 7].map((n) => (
							<label key={n} className="flex items-center gap-1 text-xs">
								<input
									type="radio"
									name={`imp_${tid}_${field}`}
									checked={imp?.[field] === n}
									onChange={() => setImp(field, n)}
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
