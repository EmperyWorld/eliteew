/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin re-export aggregator for desktop user API client (`/api/v1/desktop/*`).
 * Implementation lives in `./desktopApi/*` (P35 atomization).
 *
 * Invariants:
 * - All public symbols remain importable from this path (zero consumer changes).
 * - Shell-state etag/dedupe/cache behavior owned by `./desktopApi/shellState.ts`.
 *
 * Related:
 * - `shared/api/routers/desktop.py`
 * - `documentation/product/desktop/DESKTOP-STATE-PERSISTENCE.md`
 * - `documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md`
 */

export {
	DESKTOP_API_V1_BASE,
	DESKTOP_USER_API_PREFIX,
	SHELL_STATE_CONFLICT_MESSAGE,
} from './desktopApi/constants';

export {
	DesktopShellStateConflictError,
	isDesktopShellStateConflictError,
	isDesktopShellStateConflictMessage,
} from './desktopApi/conflict';

export type {
	Position,
	IconSize,
	Theme,
	ItemType,
	WidgetsPanelPosition,
	DesktopConfigResponse,
	DesktopConfigUpdate,
	DesktopItemResponse,
	DesktopItemCreate,
	DesktopClipboardShellRecord,
	DesktopNowPlayingShellState,
	DesktopMusicPlaybackShellState,
	MusicPlaylistShellRow,
	DesktopShellState,
	DesktopShellStatePatch,
	CoalescedDesktopShellStatePatch,
	ExpansionShellSlicePatch,
	ExpansionShellState,
	ExpansionShellStatePatch,
	EXPANSION_SHELL_STATE_PATCH_KEYS,
	DesktopShellStateHttpResult,
	PatchDesktopShellStateOptions,
	StoreAccessGroupRef,
	StoreAppResponse,
	StoreAppDetailResponse,
	EwWalletResponse,
	StoreResponse,
	InstalledResponse,
	WidgetNoteResponse,
	WidgetTodoResponse,
	DashboardFavoriteResponse,
	DashboardFavoriteCreate,
	DesktopWidgetSyncOpKind,
	DesktopWidgetSyncOp,
	DesktopWidgetSyncOpResult,
	DesktopWidgetSyncResponse,
	DesktopInstallProfileResponse,
	DesktopCalendarEventResponse,
	DesktopCalendarEventWrite,
} from './desktopApi/types';

export { getDesktopConfig, updateDesktopConfig } from './desktopApi/config';

export {
	SHELL_STATE_INVALIDATED_BC,
	getDesktopShellState,
	applyDesktopShellStateConflictEtag,
	invalidateDesktopShellStateRamCache,
	reloadDesktopShellStateForce,
	patchDesktopShellState,
	peekDesktopShellStateCache,
	seedDesktopShellStateFromBootstrap,
	fetchDesktopShellStateDeduplicated,
	patchDesktopShellStateMerged,
	patchDesktopShellStateKeepalive,
	clearDesktopShellStateCache,
} from './desktopApi/shellState';

export {
	getDesktopItems,
	upsertDesktopItem,
	updateDesktopItem,
	deleteDesktopItem,
	replaceDesktopItems,
} from './desktopApi/items';

export {
	getEwWallet,
	getStore,
	getStoreApp,
	getInstalled,
	installApp,
	uninstallApp,
} from './desktopApi/store';

export { getDesktopInstallProfile } from './desktopApi/installProfile';

export {
	getWidgetNotes,
	createWidgetNote,
	updateWidgetNote,
	deleteWidgetNote,
	getWidgetTodos,
	createWidgetTodo,
	updateWidgetTodo,
	deleteWidgetTodo,
	getDashboardFavorites,
	createDashboardFavorite,
	deleteDashboardFavorite,
	reorderDashboardFavorites,
	syncDesktopWidgets,
} from './desktopApi/widgets';

export {
	listDesktopCalendarEvents,
	createDesktopCalendarEvent,
	updateDesktopCalendarEvent,
	deleteDesktopCalendarEvent,
} from './desktopApi/calendar';

export {
	toApiItem,
	fromApiItem,
	fromApiIconSize,
	toApiIconSize,
	fromApiTheme,
	toApiTheme,
} from './desktopApi/converters';
