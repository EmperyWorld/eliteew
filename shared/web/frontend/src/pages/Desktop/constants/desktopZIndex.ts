/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop z-index policy, portal stack bumps, and embedded floating menu stacking.
 *
 * Invariants:
 * - Symbol names and values unchanged from pre-P38 constants barrel; structural split only.
 *
 * Related:
 * - constants/index.ts (re-export barrel)
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */
/**
 * Z-index policy (ascending): overlay < panel < snap preview < skip-link/toast < context menu < modal < desktop shell.
 * Use these constants so stacking order stays consistent (tooltips, dropdowns, modals, welcome).
 *
 * **GAF Chat** (`GAF_*`): in-app overlays inside the window; numeric band 9999–10060 matches former literals.
 *
 * **Nested windows:** in-window menus/modals use `DesktopWindowPortalStackContext` base +
 * `DESKTOP_PORTAL_STACK_BUMP.*`; do not add ad-hoc globals unless the surface is outside
 * any window (e.g. companion fullscreen media → `COMPANION_FULLSCREEN_MEDIA`).
 */
export const DESKTOP_Z_INDEX = {
	/** Dimmed backdrop behind panels (notifications, side panels) */
	OVERLAY: 1000,
	/** Floating panels (Start menu, widgets flyout, notification center) */
	PANEL: 1100,
	/** Snap/align preview when dragging windows */
	SNAP_PREVIEW: 10000,
	/** Skip-to-content link when focused (above snap preview) */
	SKIP_LINK: 10001,
	/** Ephemeral toast / stalled-loading banner (below context menus) */
	TOAST: 10002,
	/** Быстрые действия Assistant/GAF при выделении ярлыков на столе (над taskbar, ниже контекстных меню) */
	ASSISTANT_SELECTION_RAIL: 10035,
	/** Context menus, dropdowns (above panels) */
	CONTEXT_MENU: 10100,
	/** Modal backdrop (fullscreen) */
	MODAL: 9998,
	/** Modal content (dialog) */
	MODAL_CONTENT: 9999,
	/**
	 * Порталы из Studio GU / модулей без `DesktopWindowPortalStackContext`: ниже глобальной
	 * полосы контекстных меню (10100); тот же порядок, что у портала контекстного меню холста в WorkflowBuilder (`portalStackBase` вне окна = эта база).
	 */
	STUDIO_MODULE_PORTAL: 10_050,
	/** Desktop shell (welcome screen, desktop root) */
	DESKTOP_SHELL: 99999,
	/**
	 * EWA companion fullscreen media (transform video portal) — above shell canvas,
	 * below maintenance freeze. Prefer this over `DESKTOP_SHELL + N` literals.
	 */
	COMPANION_FULLSCREEN_MEDIA: 100_049,
	/** Server restart freeze overlay above workspace chrome */
	MAINTENANCE: 100_000,
	/**
	 * Low chrome on the desktop canvas (selection marquee, sync status chip).
	 * Above background/icons layer, below OVERLAY (1000).
	 */
	SHELL_CANVAS_CHROME: 100,
	/** GAF Chat: new-chat / user picker modal backdrop */
	GAF_NEW_CHAT_BACKDROP: 9999,
	/** GAF Chat: confirm / destructive action modal backdrop */
	GAF_CONFIRM_BACKDROP: 10_000,
	/** GAF Chat: unified content library picker (portal; above in-window modals) */
	GAF_CONTENT_LIBRARY_BACKDROP: 10_070,
	/** GAF Chat: full-screen attachment preview (image/PDF) */
	GAF_ATTACHMENT_PREVIEW_BACKDROP: 10_060,
	/**
	 * GAF Chat: relative stacking inside composer / message surface (local z-order;
	 * not global shell bands like CONTEXT_MENU).
	 */
	GAF_INNER_BASE: 10,
	GAF_INNER_OVERLAY: 20,
	/**
	 * Относительный порядок внутри одного stacking context (лента ошибок GAF над телом чата).
	 */
	GAF_RELATIVE_ALERT_CONTROL: 1,
	GAF_RELATIVE_ALERT_STRIP: 2,
} as const;

/**
 * Смещения поверх базы портала окна (`DesktopWindowPortalStackContext`) для вложенных меню.
 */
export const DESKTOP_PORTAL_STACK_BUMP = {
	/** Контекстное меню строки в ленте центра уведомлений — над хромом списка */
	NOTIFICATION_HUB_ITEM_MENU: 2,
	/**
	 * Плавающий виджет рабочего стола (часы/KPI): ПКМ — как прежде `CONTEXT_MENU + 3` на базе портала.
	 */
	WORKSPACE_FLOATING_WIDGET_MENU: 3,
	/**
	 * Лаунчер QuickSearch: ПКМ по строке — как прежде `CONTEXT_MENU + 5`.
	 */
	QUICK_SEARCH_CTX_MENU: 5,
	/**
	 * Вложенный flyout в `EnhancedContextMenu` над корнем меню (legacy `CONTEXT_MENU + 50` при базе shell).
	 */
	ENHANCED_CONTEXT_SUBMENU: 50,
	/**
	 * Карточка шага guided tour над корневым слоем тура (Desktop AI Chat, маркетинг, Studio, контент-менеджер).
	 */
	GUIDE_TOUR_CARD: 2,
	/** ПКМ по строке в панели истории команд (Studio GU / Voice). */
	COMMAND_HISTORY_ROW_CONTEXT_MENU: 2,
	/**
	 * Модалка с `createPortal` из вложенного приложения: выше контекстных меню того же окна
	 * (`portalStackBase` = `CONTEXT_MENU + window.zIndex` в `EnhancedWindow`).
	 */
	EMBEDDED_MODAL_BACKDROP: 200,
	EMBEDDED_MODAL_CONTENT: 201,
	/**
	 * Полноэкранная модалка Mermaid в Desktop AI Chat: `portalStackBase + this` даёт прежний порядок
	 * (~`100050` при базе `CONTEXT_MENU` и `window.zIndex === 0`).
	 */
	MERMAID_FULLSCREEN_MODAL: 89_950,
	/**
	 * `UnifiedContentPickerModal` без явного `portalZIndex`: было `z-[50000]` при базе `CONTEXT_MENU` + `window.zIndex === 0`.
	 * Вне окна — задавать **`portalZIndex`** (`MODAL`, **`STUDIO_MODULE_PORTAL`**, **`GAF_*`** и т.д.).
	 */
	UNIFIED_CONTENT_PICKER_PORTAL: 39_900,
	/**
	 * Ultimate Doc Editor: `absolute` / `sticky` внутри корня `.ultimate-doc-editor` (не `createPortal`).
	 * Сумма с `portalStackBase` совпадает по шкале с порталами того же окна; ниже **`EMBEDDED_MODAL_*`** (200+).
	 * Порядок: FAB 17 → … → боковая панель 35 → порталы хрома (экспорт, color picker) 36 → контекстные меню (редактор, строка в файловом менеджере) 37.
	 */
	DOC_EDITOR_IN_WINDOW_SCROLL_FAB: 17,
	/** Sticky оболочка `EditorToolbar` / markdown chrome в колонке редактора. */
	DOC_EDITOR_IN_WINDOW_STICKY_TOOLBAR: 18,
	/** Sticky полоса управления документом (вкладки, главный хром). */
	DOC_EDITOR_IN_WINDOW_STICKY_DOC_HEADER: 19,
	DOC_EDITOR_IN_WINDOW_STICKY_ALERT: 20,
	DOC_EDITOR_IN_WINDOW_GUIDE_CARD: 22,
	DOC_EDITOR_IN_WINDOW_MEMORY_TOAST: 26,
	DOC_EDITOR_IN_WINDOW_DRAG_OVERLAY: 30,
	/**
	 * Фиксированные правые панели Ultimate Doc Editor (файлы, поиск, комментарии, …) в окне десктопа.
	 */
	DOC_EDITOR_IN_WINDOW_SIDE_PANEL: 35,
	/**
	 * `createPortal` в `document.body` из shell редактора (меню экспорта, `ColorPicker`), выше правых панелей.
	 */
	DOC_EDITOR_IN_WINDOW_TOOLBAR_PORTAL_POPOVER: 36,
	/**
	 * ПКМ: меню по тексту в Tiptap (`EditorContextMenu`) и по строке документа в файловом менеджере (`FileManagerDocContextMenu`).
	 */
	DOC_EDITOR_IN_WINDOW_CONTEXT_MENU: 37,
} as const;

/**
 * Тот же расчёт, что у плавающих меню окна (ПКМ по тексту, папка): меню не теряется под соседними окнами.
 */
export function desktopEmbeddedFloatingMenuZIndex(
	windowZIndex: number
): number {
	return DESKTOP_Z_INDEX.CONTEXT_MENU + windowZIndex;
}
