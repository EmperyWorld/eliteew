/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public barrel for Admin New World design system (tokens + atoms).
 *
 * Invariants:
 * - No re-exports of Old World chrome (adminUiShared, adminChrome, DESKTOP_INTERACTIVE).
 * - Feature panels import from this barrel or atoms/* only.
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

export {
	ADMIN_UI_ROOT_CLASS,
	adminUiBannerTone,
	adminUiButtonBase,
	adminUiButtonVariant,
	adminUiFieldClass,
	adminUiFocusRing,
	adminUiModalBackdropClass,
	adminUiModalPanelClass,
	adminUiTableWrapClass,
	type AdminUiBannerTone,
	type AdminUiButtonVariant,
} from './adminTokens';

export { AdminButton, type AdminButtonProps } from './atoms/AdminButton';
export { AdminField, type AdminFieldProps } from './atoms/AdminField';
export { AdminSelect, type AdminSelectProps } from './atoms/AdminSelect';
export { AdminToggle, type AdminToggleProps } from './atoms/AdminToggle';
export {
	AdminStatusBanner,
	type AdminStatusBannerProps,
} from './atoms/AdminStatusBanner';
export { AdminModal, type AdminModalProps } from './atoms/AdminModal';
export {
	DangerConfirmModal,
	type DangerConfirmModalProps,
} from './atoms/DangerConfirmModal';
export {
	AdminDataTable,
	type AdminDataTableColumn,
	type AdminDataTableProps,
} from './atoms/AdminDataTable';
export {
	AdminRowActions,
	type AdminRowActionsProps,
} from './atoms/AdminRowActions';
export {
	AdminSectionTabs,
	type AdminSectionTabItem,
	type AdminSectionTabsProps,
} from './atoms/AdminSectionTabs';
export {
	OpsProbePanel,
	type OpsProbePanelProps,
} from './atoms/OpsProbePanel';
export {
	PackStemPicker,
	type PackStemPickerProps,
} from './atoms/PackStemPicker';
export {
	EntityLifecycleBar,
	type EntityLifecycleBarProps,
} from './atoms/EntityLifecycleBar';
export { AdminDrawer, type AdminDrawerProps } from './atoms/AdminDrawer';
export {
	AdminJsonPreview,
	type AdminJsonPreviewProps,
} from './atoms/AdminJsonPreview';
