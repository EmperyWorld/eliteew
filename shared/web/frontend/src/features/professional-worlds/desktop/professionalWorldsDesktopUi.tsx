/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Re-exports for Professional Worlds layout chrome and form utilities (stable import path).
 *
 * Invariants:
 * - Layout components live under `layout/`; non-UI helpers under `utils/`.
 *
 * Related:
 * - layout/index.ts
 * - utils/professionalWorldsFormUtils.ts
 */

export {
	ProfessionalWorldsAiOutputPanel,
	ProfessionalWorldsFormField,
	ProfessionalWorldsInlineHint,
	ProfessionalWorldsMetricCard,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
	ProfessionalWorldsWorkspaceSection,
	ProfessionalWorldsWorkspaceSubtabs,
	PW_FORM_GRID_CLASS,
	PW_METRIC_GRID_CLASS,
	PW_SPLIT_CAPTURE_CLASS,
	PW_SPLIT_DIRECTORY_CLASS,
	PW_WORKSPACE_SECTION_GAP,
} from './layout';

export {
	PROFESSIONAL_WORLDS_FIELD_CLASS,
	albumBelongsToProperty,
	createIdempotencyKey,
	toInputValue,
	toNullableNumber,
} from './utils/professionalWorldsFormUtils';

/** @deprecated Use `ProfessionalWorldsFormField` */
export { ProfessionalWorldsFormField as FieldLabel } from './layout';

/** @deprecated Use `ProfessionalWorldsWorkspaceSubtabs` */
export { ProfessionalWorldsWorkspaceSubtabs as WorkspaceSubtabs } from './layout';
