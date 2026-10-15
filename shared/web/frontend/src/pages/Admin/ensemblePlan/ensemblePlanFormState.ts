/**
 * Form state ↔ PlanTemplate JSON for ensemble blueprint admin editor.
 */

export type PlanSlotRow = { key: string; value: number; uiKey: string };

export type PlanStepRow = {
	uiKey: string;
	step_id: string;
	title: string;
	instruction_for_model: string;
	required_slots: PlanSlotRow[];
};

export type PlanOutlineSubRow = {
	heading: string;
	step_id: string;
	uiKey: string;
};

export type PlanOutlineSectionRow = {
	heading: string;
	section_id: string;
	step_ids: string[];
	subsections: PlanOutlineSubRow[];
	uiKey: string;
};

export type EnsemblePlanFormState = {
	schema_version: number;
	version: number;
	title: string;
	description: string;
	slots: PlanSlotRow[];
	max_steps_per_hero: number;
	allow_mermaid: boolean;
	steps: PlanStepRow[];
	outline: PlanOutlineSectionRow[];
};

function newSlotUiKey(): string {
	return `slot_${crypto.randomUUID?.() ?? String(Date.now())}_${Math.random().toString(36).slice(2)}`;
}

function newSubUiKey(): string {
	return `sub_${crypto.randomUUID?.() ?? String(Date.now())}_${Math.random().toString(36).slice(2)}`;
}

function newSectionUiKey(): string {
	return `sec_${crypto.randomUUID?.() ?? String(Date.now())}_${Math.random().toString(36).slice(2)}`;
}

function newStepUiKey(): string {
	return `step_${crypto.randomUUID?.() ?? String(Date.now())}_${Math.random().toString(36).slice(2)}`;
}

function parseSlots(obj: unknown): PlanSlotRow[] {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
	const rows: PlanSlotRow[] = [];
	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		const key = String(k).trim();
		if (!key) continue;
		const n = Number(v);
		if (!Number.isFinite(n)) continue;
		rows.push({ key, value: Math.trunc(n), uiKey: newSlotUiKey() });
	}
	return rows;
}

function slotsToRecord(rows: PlanSlotRow[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const { key, value } of rows) {
		const k = key.trim();
		if (!k) continue;
		out[k] = value;
	}
	return out;
}

export function emptyEnsemblePlanFormState(): EnsemblePlanFormState {
	return {
		schema_version: 1,
		version: 1,
		title: '',
		description: '',
		slots: [],
		max_steps_per_hero: 2,
		allow_mermaid: false,
		steps: [],
		outline: [],
	};
}

export function nextStepId(existing: EnsemblePlanFormState): string {
	const used = new Set(existing.steps.map((s) => s.step_id.trim()));
	let n = existing.steps.length + 1;
	let cand = `s${n}`;
	while (used.has(cand)) {
		n += 1;
		cand = `s${n}`;
	}
	return cand;
}

export function newEmptyStepRow(existing: EnsemblePlanFormState): PlanStepRow {
	return {
		uiKey: newStepUiKey(),
		step_id: nextStepId(existing),
		title: '',
		instruction_for_model: '',
		required_slots: [],
	};
}

export function emptyOutlineSubrow(): PlanOutlineSubRow {
	return { heading: '', step_id: '', uiKey: newSubUiKey() };
}

export function emptyOutlineSection(): PlanOutlineSectionRow {
	return {
		heading: '',
		section_id: '',
		step_ids: [],
		subsections: [],
		uiKey: newSectionUiKey(),
	};
}

export function newEmptySlotRow(): PlanSlotRow {
	return { key: '', value: 1, uiKey: newSlotUiKey() };
}

/** One outline section per step (heading = step title or step_id). Replaces current outline. */
export function outlineOneSectionPerStep(
	state: EnsemblePlanFormState
): EnsemblePlanFormState {
	const outline: PlanOutlineSectionRow[] = state.steps.map((s) => {
		const sid = s.step_id.trim();
		const heading = (s.title.trim() || sid || 'section').slice(0, 200);
		return {
			heading,
			section_id: '',
			step_ids: sid ? [sid] : [],
			subsections: [],
			uiKey: newSectionUiKey(),
		};
	});
	return { ...state, outline };
}

export function renameStepIdInState(
	state: EnsemblePlanFormState,
	oldId: string,
	newId: string
): EnsemblePlanFormState {
	const o = oldId.trim();
	const n = newId.trim();
	if (!o || !n || o === n) return state;
	const steps = state.steps.map((s) =>
		s.step_id.trim() === o ? { ...s, step_id: n } : s
	);
	const outline = state.outline.map((sec) => ({
		...sec,
		step_ids: sec.step_ids.map((id) => (id.trim() === o ? n : id)),
		subsections: sec.subsections.map((sub) => ({
			...sub,
			step_id: sub.step_id.trim() === o ? n : sub.step_id,
		})),
	}));
	return { ...state, steps, outline };
}

export type EnsemblePlanFormParseFailure = {
	ok: false;
	error: string;
	errorParams?: Record<string, string | number>;
};

export function parsePlanBodyToForm(
	raw: unknown
): { ok: true; state: EnsemblePlanFormState } | EnsemblePlanFormParseFailure {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { ok: false, error: 'expectObject' };
	}
	const d = raw as Record<string, unknown>;
	const stepsRaw = d.steps;
	if (!Array.isArray(stepsRaw)) {
		return { ok: false, error: 'stepsMustBeArray' };
	}
	const outlineRaw = d.document_outline;
	if (!Array.isArray(outlineRaw)) {
		return { ok: false, error: 'outlineMustBeArray' };
	}

	const steps: PlanStepRow[] = [];
	for (let i = 0; i < stepsRaw.length; i += 1) {
		const s = stepsRaw[i];
		if (!s || typeof s !== 'object' || Array.isArray(s)) {
			return {
				ok: false,
				error: 'stepIndexExpectObject',
				errorParams: { index: i },
			};
		}
		const o = s as Record<string, unknown>;
		const sid = String(o.step_id ?? '').trim();
		const title = String(o.title ?? '').trim();
		const instr = String(o.instruction_for_model ?? '');
		if (!sid) {
			return {
				ok: false,
				error: 'stepIndexEmptyId',
				errorParams: { index: i },
			};
		}
		steps.push({
			uiKey: newStepUiKey(),
			step_id: sid,
			title,
			instruction_for_model: instr,
			required_slots: parseSlots(o.required_slots),
		});
	}

	const outline: PlanOutlineSectionRow[] = [];
	for (let i = 0; i < outlineRaw.length; i += 1) {
		const sec = outlineRaw[i];
		if (!sec || typeof sec !== 'object' || Array.isArray(sec)) {
			return {
				ok: false,
				error: 'outlineIndexExpectObject',
				errorParams: { index: i },
			};
		}
		const o = sec as Record<string, unknown>;
		const heading = String(o.heading ?? '').trim();
		const section_id = o.id != null ? String(o.id).trim() : '';
		const stepIdsRaw = o.step_ids;
		const step_ids = Array.isArray(stepIdsRaw)
			? stepIdsRaw.map((x) => String(x).trim()).filter(Boolean)
			: [];
		const subsRaw = o.subsections;
		const subsections: PlanOutlineSubRow[] = [];
		if (Array.isArray(subsRaw)) {
			for (let j = 0; j < subsRaw.length; j += 1) {
				const su = subsRaw[j];
				if (!su || typeof su !== 'object') {
					return {
						ok: false,
						error: 'outlineSubExpectObject',
						errorParams: { i, j },
					};
				}
				const u = su as Record<string, unknown>;
				subsections.push({
					heading: String(u.heading ?? '').trim(),
					step_id: String(u.step_id ?? '').trim(),
					uiKey: newSubUiKey(),
				});
			}
		}
		outline.push({
			heading,
			section_id,
			step_ids,
			subsections,
			uiKey: newSectionUiKey(),
		});
	}

	const maxRaw = d.max_steps_per_hero;
	let max_steps_per_hero = 2;
	if (maxRaw != null) {
		const m = Number(maxRaw);
		if (Number.isFinite(m))
			max_steps_per_hero = Math.min(10, Math.max(1, Math.trunc(m)));
	}

	const state: EnsemblePlanFormState = {
		schema_version:
			Number(d.schema_version) === 1 ? 1 : Number(d.schema_version) || 1,
		version: Number.isFinite(Number(d.version))
			? Math.max(1, Math.trunc(Number(d.version)))
			: 1,
		title: String(d.title ?? ''),
		description: String(d.description ?? ''),
		slots: parseSlots(d.slots),
		max_steps_per_hero,
		allow_mermaid: Boolean(d.allow_mermaid),
		steps,
		outline,
	};
	return { ok: true, state };
}

export function formStateToPlanBody(
	state: EnsemblePlanFormState,
	templateId: string
): Record<string, unknown> {
	const tid = templateId.trim();
	const outline = state.outline.map((sec) => {
		const block: Record<string, unknown> = {
			heading: sec.heading,
			step_ids: [...sec.step_ids],
		};
		if (sec.section_id.trim()) block.id = sec.section_id.trim();
		if (sec.subsections.length) {
			block.subsections = sec.subsections.map((s) => ({
				heading: s.heading,
				step_id: s.step_id.trim(),
			}));
		}
		return block;
	});
	return {
		schema_version: state.schema_version,
		id: tid,
		version: state.version,
		title: state.title,
		description: state.description,
		slots: slotsToRecord(state.slots),
		max_steps_per_hero: state.max_steps_per_hero,
		allow_mermaid: state.allow_mermaid,
		steps: state.steps.map((s) => ({
			step_id: s.step_id.trim(),
			title: s.title,
			instruction_for_model: s.instruction_for_model,
			required_slots: slotsToRecord(s.required_slots),
		})),
		document_outline: outline,
	};
}

export function validateStepIdsUnique(
	state: EnsemblePlanFormState
): string | null {
	const seen = new Set<string>();
	for (const s of state.steps) {
		const id = s.step_id.trim();
		if (!id) return 'emptyStepId';
		if (seen.has(id)) return `duplicateStepId:${id}`;
		seen.add(id);
	}
	const all = seen;
	for (const sec of state.outline) {
		for (const sid of sec.step_ids) {
			if (!all.has(sid.trim())) {
				return `outlineUnknownStepId:${sid}`;
			}
		}
		for (const sub of sec.subsections) {
			const u = sub.step_id.trim();
			if (u && !all.has(u)) {
				return `subUnknownStepId:${u}`;
			}
		}
	}
	return null;
}
