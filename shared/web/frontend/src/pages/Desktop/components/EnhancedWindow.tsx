/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app/folder window shell: react-rnd placement, title bar (`WindowTitleBar`), lazy app content, and minimize/maximize/close wiring.
 *
 * Invariants:
 * - Title bar control hints and `aria-label` text come from `WindowTitleBar` + i18n — do not mutate button attributes by DOM index (extra toolbar buttons broke a11y).
 * - App body is wrapped in `DesktopGuideTourOpenerProvider` so per-app tours register the title-bar «Экскурсия» button.
 * - Guide opener is stored in a ref; title bar visibility toggles only on register/unregister, not on callback identity churn.
 * - Folder windows mirror apps: **`onUpdatePayload`** pushes **`WindowInitialPayload`** patches (e.g. **`companionListingPlain`** for shell_context).
 * - Chrome size sync is localized (double rAF) without synthetic `window` resize (boot perf).
 * - Post-Suspense / unminimize layout wake (once-per-key deferred resize) lives in
 *   `desktopAppWindowBodyLayoutSync` + `EnhancedWindowAppContent` — not on every restore.
 * - Window body scroll DomFlags + `data-shell-chrome-profile` come from Shell App Registry (U1/U4).
 *
 * Related:
 * - WindowTitleBar.tsx
 * - DesktopWorkspaceContent.tsx
 * - enhancedWindow/enhancedWindowBodyScroll.ts
 * - enhancedWindow/EnhancedWindowAppContent.tsx
 * - utils/desktopAppWindowBodyLayoutSync.ts
 * - enhancedWindow/useEnhancedWindowTextContextMenu.ts
 * - shell/shellScroll.ts, shell/shellChrome.ts
 * - utils/desktopSnapGeometry.ts (`readDesktopWorkArea` for clamp-on-restore) */

import { AnimatePresence, m, type Variants } from 'framer-motion';
import { useDesktopShellMotionPrefs } from '../context/DesktopShellMotionPrefsContext';
import * as React from 'react';
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Rnd } from 'react-rnd';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { DesktopWindowStyle } from '../../../types/profile';
import {
	desktopEmbeddedFloatingMenuZIndex,
	DESKTOP_LUCIDE,
	DESKTOP_SURFACE,
} from '../constants';
import { DesktopWindowPortalStackContext } from '../context/DesktopWindowPortalStackContext';
import { DesktopGuideTourOpenerProvider } from '../context/DesktopGuideTourOpenerContext';
import { useDesktopAppProps } from '../context/DesktopAppPropsContext';
import { DesktopWindowActiveProvider } from '../context/DesktopWindowActiveContext';
import { DesktopWindowContextProvider } from '../context/DesktopWindowContext';
import { useDesktopInactiveWindowSoftBlur } from '../runtime/useDesktopInactiveWindowSoftBlur';
import type {
	BeforeCloseHandler,
	DesktopItem,
	WindowState,
} from '../types/desktop.types';
import { getDesktopWindowMinSize } from '../utils/desktopWindowMinSizeRegistry';
import { resolveShellChromeProfile } from '../shell/shellChrome';
import { resolveWindowBodyScrollDomFlags } from '../shell/shellScroll';
import {
	getDesktopWindowContentVariants,
	getDesktopWindowFrameVariants,
} from '../utils/desktopWindowMotionVariants';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	DESKTOP_WINDOW_TITLEBAR_STYLES,
} from '../utils/desktopVisualSystem';
import {
	scheduleAppWindowBodyLayoutSync,
	scheduleAppWindowContentSettledLayoutWake,
} from '../utils/desktopAppWindowBodyLayoutSync';
import { resolveDesktopWindowDisplayTitle } from '../utils/desktopWindowDisplayTitle';
import { isDesktopLaserPointerEnvironment } from '../utils/desktopLaserPointerEnvironment';
import { buildDesktopWindowMinSizeHint } from '../utils/desktopWindowChromeCopy';
import { resolveEffectiveWindowMinSize } from '../utils/desktopWindowGeometry';
import { readDesktopWorkArea } from '../utils/desktopSnapGeometry';
import { DesktopFolderWindow } from './DesktopFolderWindow';
import { WindowTitleBar } from './WindowTitleBar';
import { FolderIcon } from '@heroicons/react/24/outline';
import { EnhancedWindowAppContent } from './enhancedWindow/EnhancedWindowAppContent';
import { EnhancedWindowTextContextMenu } from './enhancedWindow/EnhancedWindowTextContextMenu';
import {
	computeViewportMaxFromWorkArea,
	DESKTOP_RND_RESIZE_HANDLE_CLASSES,
	isDesktopAppWindowBodySelfScroll,
	pointerFromDragEvent,
	type DesktopWindowDragPointer,
} from './enhancedWindow/enhancedWindowBodyScroll';
import { useEnhancedWindowTextContextMenu } from './enhancedWindow/useEnhancedWindowTextContextMenu';

export { isDesktopAppWindowBodySelfScroll };

interface EnhancedWindowProps {
	desktopWindow: WindowState;
	/** When window is a folder, optional item for color/name (from desktop items) */
	folderItem?: DesktopItem | null;
	isActive?: boolean;
	isTabVisible?: boolean;
	onDragStart: () => void;
	onDrag: (x: number, y: number, pointer: DesktopWindowDragPointer) => void;
	onDragEnd: (
		x: number,
		y: number,
		pointer: DesktopWindowDragPointer | null
	) => void;
	onResize: (width: number, height: number) => void;
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
	onFocus: () => void;
	registerBeforeClose?: (id: string, fn: BeforeCloseHandler) => void;
	unregisterBeforeClose?: (id: string) => void;
	/** Called when app wants to update window payload (e.g. DocEditor sets documentId after user selects doc). */
	onUpdatePayload?: (
		payload: import('../types/desktop.types').WindowInitialPayload
	) => void;
	/** Navigate folder window to another folder (tree / breadcrumb). */
	onRetargetFolder?: (target: {
		folderId: string;
		title: string;
		path: string[];
	}) => void;
	visualStyle?: DesktopWindowStyle;
	/** Подпись про лимит окон из витрины (рядом с типом окна в заголовке). */
	storeInstancePolicyLabel?: string;
	alwaysOnTop?: boolean;
	onToggleAlwaysOnTop?: () => void;
}

export const EnhancedWindow: React.FC<EnhancedWindowProps> = memo(
	({
		desktopWindow,
		folderItem: _folderMeta = null,
		isActive = false,
		isTabVisible = true,
		onDragStart,
		onDrag,
		onDragEnd,
		onResize,
		onClose,
		onMinimize,
		onMaximize,
		onFocus,
		registerBeforeClose,
		unregisterBeforeClose,
		onUpdatePayload,
		onRetargetFolder,
		visualStyle = 'glass',
		storeInstancePolicyLabel,
		alwaysOnTop = false,
		onToggleAlwaysOnTop,
	}) => {
		const { t } = useTranslation('desktopUi');
		const win = desktopWindow;
		const isMaximized = desktopWindow.isMaximized;
		const appProps = useDesktopAppProps();
		const { reduceMotion, speed } = useDesktopShellMotionPrefs();
		const windowVariants: Variants = useMemo(
			() => getDesktopWindowFrameVariants(reduceMotion, speed),
			[reduceMotion, speed]
		);
		const contentVariants: Variants = useMemo(
			() => getDesktopWindowContentVariants(reduceMotion),
			[reduceMotion]
		);
		const frameStyle = useMemo(
			() =>
				DESKTOP_WINDOW_FRAME_STYLES[visualStyle] ??
				DESKTOP_WINDOW_FRAME_STYLES.glass,
			[visualStyle]
		);
		const inactiveSoftBlurShell = useDesktopInactiveWindowSoftBlur({
			isActive,
			isMinimized: desktopWindow.isMinimized,
			isMinimizing: desktopWindow.isMinimizing ?? false,
		});
		const titleBarPreset = useMemo(
			() =>
				DESKTOP_WINDOW_TITLEBAR_STYLES[visualStyle] ??
				DESKTOP_WINDOW_TITLEBAR_STYLES.glass,
			[visualStyle]
		);
		const [contentKey, setContentKey] = React.useState(0);
		const {
			textContextMenu,
			textContextRangeRef,
			closeTextContextMenu,
			onBodyContextMenu,
		} = useEnhancedWindowTextContextMenu(desktopWindow.id);
		const floatingMenuZIndex = desktopEmbeddedFloatingMenuZIndex(
			desktopWindow.zIndex
		);
		const floatingMenuBackdropZIndex = floatingMenuZIndex - 1;

		const titleBarTitle = useMemo(() => {
			return resolveDesktopWindowDisplayTitle(win);
		}, [win]);

		useEffect(() => {
			return () => {
				unregisterBeforeClose?.(win.id);
			};
		}, [win.id, unregisterBeforeClose]);

		// Render app component based on window type
		const renderAppContent = useCallback(() => {
			if (win.type === 'folder') {
				return (
					<DesktopFolderWindow
						win={win}
						windowId={win.id}
						visualStyle={visualStyle}
						contentVariants={contentVariants}
						reduceMotion={reduceMotion}
						floatingMenuZIndex={floatingMenuZIndex}
						floatingMenuBackdropZIndex={floatingMenuBackdropZIndex}
						titleBarPreset={titleBarPreset}
						onUpdatePayload={onUpdatePayload}
						onRetargetFolder={onRetargetFolder}
					/>
				);
			}

			return (
				<EnhancedWindowAppContent
					win={win}
					visualStyle={visualStyle}
					appProps={appProps}
					contentKey={contentKey}
					onRetry={() => setContentKey((k) => k + 1)}
					onClose={onClose}
					onMaximize={onMaximize}
					onUpdatePayload={onUpdatePayload}
				/>
			);
		}, [
			win,
			visualStyle,
			titleBarPreset,
			appProps,
			contentKey,
			onClose,
			onMaximize,
			onUpdatePayload,
			onRetargetFolder,
			floatingMenuBackdropZIndex,
			floatingMenuZIndex,
			reduceMotion,
			contentVariants,
		]);

		// Memoize position and size to prevent unnecessary re-renders.
		// Be defensive against legacy/corrupted window state where position/size might be missing.
		const position = useMemo(() => {
			const pos = win.position ?? { x: 200, y: 120 };
			return {
				x: typeof pos.x === 'number' ? pos.x : 200,
				y: typeof pos.y === 'number' ? pos.y : 120,
			};
		}, [win.position]);

		const size = useMemo(() => {
			const minSizeLocal = getDesktopWindowMinSize(desktopWindow);
			const fallback = {
				width: minSizeLocal.minWidth,
				height: minSizeLocal.minHeight,
			};
			const s = win.size ?? fallback;
			const raw = s as { width?: unknown; height?: unknown };
			return {
				width: typeof raw.width === 'number' ? raw.width : fallback.width,
				height: typeof raw.height === 'number' ? raw.height : fallback.height,
			};
		}, [win.size, desktopWindow]);

		// Viewport-based max size (recompute on resize).
		// NOTE: use globalThis to avoid shadowing the WindowState prop named "window".
		const [viewportMax, setViewportMax] = useState(() =>
			computeViewportMaxFromWorkArea()
		);
		const guideTourOpenerRef = useRef<(() => void) | null>(null);
		const [guideTourOpenerReady, setGuideTourOpenerReady] = useState(false);
		const setGuideTourOpener = useCallback((fn: (() => void) | null) => {
			const wasReady = guideTourOpenerRef.current != null;
			const isReady = fn != null;
			guideTourOpenerRef.current = fn;
			if (wasReady !== isReady) {
				setGuideTourOpenerReady(isReady);
			}
		}, []);
		const invokeGuideTourOpener = useCallback(() => {
			guideTourOpenerRef.current?.();
		}, []);

		useEffect(() => {
			if (typeof globalThis === 'undefined') {
				return;
			}
			const gw = globalThis as unknown as Window;
			if (typeof gw.addEventListener !== 'function') {
				return;
			}
			const onResize = () => {
				setViewportMax(computeViewportMaxFromWorkArea());
			};
			gw.addEventListener('resize', onResize);
			return () => gw.removeEventListener('resize', onResize);
		}, []);

		const minSize = useMemo(
			() =>
				resolveEffectiveWindowMinSize(
					getDesktopWindowMinSize(desktopWindow),
					viewportMax
				),
			[desktopWindow, viewportMax]
		);
		const [minSizeHintVisible, setMinSizeHintVisible] = useState(false);
		const minSizeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
			null
		);

		const flashMinSizeHint = useCallback(() => {
			setMinSizeHintVisible(true);
			if (minSizeHintTimerRef.current) {
				clearTimeout(minSizeHintTimerRef.current);
			}
			minSizeHintTimerRef.current = setTimeout(() => {
				setMinSizeHintVisible(false);
				minSizeHintTimerRef.current = null;
			}, 2400);
		}, []);

		useEffect(() => {
			return () => {
				if (minSizeHintTimerRef.current) {
					clearTimeout(minSizeHintTimerRef.current);
				}
			};
		}, []);

		/**
		 * Window-body overflow / `data-desktop-scroll` from Shell App Registry (U1).
		 * Apps declare scroll.mode in catalog; do not mutate shell section overflow in feature code.
		 */
		const windowBodyScrollDom = useMemo(
			() => resolveWindowBodyScrollDomFlags(win.type, win.appComponent),
			[win.type, win.appComponent]
		);

		/** Chrome profile from registry (U4) — CSS/diagnostics attribute on window body. */
		const shellChromeProfile = useMemo(
			() =>
				win.type === 'app'
					? resolveShellChromeProfile(win.appComponent)
					: resolveShellChromeProfile(null),
			[win.type, win.appComponent]
		);

		const isMinimizedHidden =
			desktopWindow.isMinimized && !desktopWindow.isMinimizing;

		const shellRef = useRef<HTMLDivElement>(null);
		const appWindowBodyRef = useRef<HTMLElement | null>(null);
		const wasAppWindowMinimizedRef = useRef(false);

		/** Nested flex + lazy Suspense: localized geometry read after paint — no global resize fan-out. */
		// biome-ignore lint/correctness/useExhaustiveDependencies: geometry sync when window chrome size changes
		useLayoutEffect(() => {
			if (win.type !== 'app') return;
			scheduleAppWindowBodyLayoutSync(appWindowBodyRef.current);
		}, [win.type, size.width, size.height, isMaximized]);

		useLayoutEffect(() => {
			if (win.type !== 'app') return;
			const nowHidden = Boolean(
				desktopWindow.isMinimized || desktopWindow.isMinimizing
			);
			if (wasAppWindowMinimizedRef.current && !nowHidden) {
				// User restore from tray — wake apps that listen for resize (once per cycle).
				scheduleAppWindowContentSettledLayoutWake(
					`${win.id}:unminimize:${Date.now()}`,
					appWindowBodyRef.current
				);
			}
			wasAppWindowMinimizedRef.current = nowHidden;
		}, [
			win.id,
			win.type,
			desktopWindow.isMinimized,
			desktopWindow.isMinimizing,
		]);

		/** Свёрнутое окно помечается `inert` / скрыто от AT — убираем фокус с потомков, иначе Chrome: aria-hidden + focus. */
		useLayoutEffect(() => {
			if (!isMinimizedHidden) return;
			const root = shellRef.current;
			if (!root) return;
			const ae = document.activeElement;
			if (ae instanceof HTMLElement && root.contains(ae)) {
				ae.blur();
			}
		}, [isMinimizedHidden]);

		useEffect(() => {
			if (!isDesktopLaserPointerEnvironment()) return;
			const releaseDragResize = () => {
				try {
					document.dispatchEvent(
						new MouseEvent('mouseup', {
							bubbles: true,
							cancelable: true,
							view: window,
						})
					);
				} catch {
					// ignore
				}
			};
			window.addEventListener('pointerup', releaseDragResize, {
				capture: true,
			});
			window.addEventListener('pointercancel', releaseDragResize, {
				capture: true,
			});
			return () => {
				window.removeEventListener('pointerup', releaseDragResize, {
					capture: true,
				});
				window.removeEventListener('pointercancel', releaseDragResize, {
					capture: true,
				});
			};
		}, []);

		useEffect(() => {
			if (
				desktopWindow.isMaximized ||
				desktopWindow.isMinimized ||
				desktopWindow.isMinimizing
			) {
				return;
			}
			const gw =
				typeof globalThis !== 'undefined'
					? (globalThis as unknown as Window)
					: null;
			if (!gw || typeof gw.innerWidth !== 'number') {
				return;
			}
			const w = size.width;
			const h = size.height;
			const wa = readDesktopWorkArea();
			const maxX = Math.max(0, wa.width - w);
			const maxY = Math.max(0, wa.height - h);
			const nx = Math.min(Math.max(0, position.x), maxX);
			const ny = Math.min(Math.max(0, position.y), maxY);
			if (nx !== position.x || ny !== position.y) {
				onDragEnd(nx, ny, null);
			}
		}, [
			desktopWindow.isMaximized,
			desktopWindow.isMinimized,
			desktopWindow.isMinimizing,
			position.x,
			position.y,
			size.width,
			size.height,
			onDragEnd,
		]);

		return (
			<>
				<AnimatePresence mode="wait">
					<Rnd
						key={desktopWindow.id}
						cancel="[data-desktop-window-control], .desktop-window-no-drag"
						size={size}
						position={position}
						onDragStart={() => onDragStart()}
						onDrag={(e, data) => {
							const p = pointerFromDragEvent(e);
							onDrag(data.x, data.y, p);
						}}
						onDragStop={(e, data) => {
							onDragEnd(data.x, data.y, pointerFromDragEvent(e));
						}}
						onResizeStop={(_e, _direction, ref) => {
							onResize(
								parseInt(ref.style.width, 10),
								parseInt(ref.style.height, 10)
							);
						}}
						onResize={(_e, _direction, ref) => {
							const w = parseInt(ref.style.width, 10);
							const h = parseInt(ref.style.height, 10);
							if (w <= minSize.minWidth + 1 || h <= minSize.minHeight + 1) {
								flashMinSizeHint();
							}
						}}
						minWidth={minSize.minWidth}
						minHeight={minSize.minHeight}
						maxWidth={desktopWindow.isMaximized ? '100%' : viewportMax.width}
						maxHeight={desktopWindow.isMaximized ? '100%' : viewportMax.height}
						disableDragging={
							desktopWindow.isMaximized ||
							desktopWindow.isMinimizing ||
							desktopWindow.isMinimized
						}
						enableResizing={
							!desktopWindow.isMaximized &&
							!desktopWindow.isMinimizing &&
							!desktopWindow.isMinimized
						}
						onContextMenu={(e) => {
							// Resize handles sit outside body section; suppress native + open chrome menu.
							e.preventDefault();
							e.stopPropagation();
							window.dispatchEvent(
								new CustomEvent('desktop-window-context-menu', {
									detail: {
										windowId: desktopWindow.id,
										x: e.clientX,
										y: e.clientY,
									},
								})
							);
						}}
						dragHandleClassName="desktop-window-drag-handle"
						resizeHandleClasses={DESKTOP_RND_RESIZE_HANDLE_CLASSES}
						bounds="window"
						style={{
							zIndex: isMinimizedHidden
								? 0
								: desktopWindow.isMinimizing
									? 0
									: desktopWindow.zIndex,
							pointerEvents:
								desktopWindow.isMinimizing || isMinimizedHidden
									? 'none'
									: 'auto',
							visibility: isMinimizedHidden ? 'hidden' : 'visible',
						}}
						className={cn(
							'desktop-window-root overflow-hidden',
							frameStyle.frame,
							isMaximized
								? 'rounded-none border-0 shadow-none! ring-0 [box-shadow:none]'
								: [
										DESKTOP_SURFACE.radiusFrame,
										DESKTOP_SURFACE.shadow,
										isActive && !win.isMinimizing
											? frameStyle.active
											: frameStyle.inactive,
									]
						)}
						data-desktop-window
						data-desktop-window-active={isActive ? 'true' : 'false'}
						inert={isMinimizedHidden ? true : undefined}
					>
						<m.div
							ref={shellRef}
							variants={windowVariants}
							initial="initial"
							animate={
								desktopWindow.isMinimizing || desktopWindow.isMinimized
									? 'minimized'
									: 'animate'
							}
							exit="exit"
							className={cn(
								'relative w-full h-full flex flex-col min-h-0',
								frameStyle.shell,
								isActive ? 'brightness-100' : 'brightness-[0.96]',
								inactiveSoftBlurShell && 'desktop-window-inactive-soft-blur'
							)}
							onClick={onFocus}
						>
							{!isMaximized ? (
								<div
									aria-hidden
									className={`pointer-events-none absolute left-4 right-4 top-0 h-px ${frameStyle.accentLine}`}
								/>
							) : null}
							<WindowTitleBar
								className="desktop-window-drag-handle relative z-10 min-w-0 shrink-0 [&_button:focus-visible]:relative [&_button:focus-visible]:z-1"
								title={titleBarTitle}
								windowId={desktopWindow.id}
								windowMorphActive={!isMinimizedHidden}
								icon={
									desktopWindow.type === 'folder' ? (
										<FolderIcon
											className="h-full w-full p-0.5 text-(--desktop-text-primary)"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : (
										desktopWindow.icon
									)
								}
								onClose={onClose}
								onMinimize={onMinimize}
								onMaximize={onMaximize}
								isMaximized={isMaximized}
								alwaysOnTop={alwaysOnTop}
								onToggleAlwaysOnTop={onToggleAlwaysOnTop}
								windowType={desktopWindow.type === 'app' ? 'app' : 'folder'}
								instancePolicyPill={
									desktopWindow.type === 'app'
										? storeInstancePolicyLabel
										: undefined
								}
								onContextMenu={(e) => {
									e.preventDefault();
									e.stopPropagation();
									window.dispatchEvent(
										new CustomEvent('desktop-window-context-menu', {
											detail: {
												windowId: desktopWindow.id,
												x: e.clientX,
												y: e.clientY,
											},
										})
									);
								}}
								visualStyle={visualStyle}
								onGuideTour={
									desktopWindow.type === 'app' && guideTourOpenerReady
										? invokeGuideTourOpener
										: undefined
								}
							/>

							{/* Content - scrollable, never overlaps title bar */}
							<section
								ref={appWindowBodyRef}
								aria-label={t('windowChrome.windowContentAria')}
								className={cn(
									'flex-1 min-h-0 relative',
									frameStyle.content,
									windowBodyScrollDom.overflowClassName
								)}
								data-desktop-window-body={desktopWindow.id}
								data-desktop-scroll={windowBodyScrollDom.dataDesktopScroll}
								data-shell-scroll-mode={windowBodyScrollDom.mode}
								data-shell-scroll-container={
									windowBodyScrollDom.scrollContainerId
								}
								data-shell-chrome-profile={shellChromeProfile}
								onContextMenu={onBodyContextMenu}
							>
								<DesktopGuideTourOpenerProvider setOpener={setGuideTourOpener}>
									<DesktopWindowPortalStackContext.Provider
										value={floatingMenuZIndex}
									>
										<DesktopWindowActiveProvider
											isActive={isActive}
											isMinimized={desktopWindow.isMinimized}
											isMinimizing={desktopWindow.isMinimizing}
											isTabVisible={isTabVisible}
										>
											{registerBeforeClose && unregisterBeforeClose ? (
												<DesktopWindowContextProvider
													windowId={desktopWindow.id}
													registerBeforeClose={registerBeforeClose}
													unregisterBeforeClose={unregisterBeforeClose}
												>
													{renderAppContent()}
												</DesktopWindowContextProvider>
											) : (
												renderAppContent()
											)}
										</DesktopWindowActiveProvider>
									</DesktopWindowPortalStackContext.Provider>
								</DesktopGuideTourOpenerProvider>
							</section>
							{minSizeHintVisible ? (
								<div
									role="status"
									aria-live="polite"
									className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-3 py-1.5 text-center text-xs text-(--desktop-text-primary) shadow-[inset_0_0_12px_rgb(var(--desktop-accent-rgb)/0.15)]"
								>
									{buildDesktopWindowMinSizeHint(
										t,
										minSize.minWidth,
										minSize.minHeight
									)}
								</div>
							) : null}
						</m.div>
					</Rnd>
				</AnimatePresence>
				{textContextMenu ? (
					<EnhancedWindowTextContextMenu
						menu={textContextMenu}
						visualStyle={visualStyle}
						reduceMotion={reduceMotion}
						floatingMenuZIndex={floatingMenuZIndex}
						floatingMenuBackdropZIndex={floatingMenuBackdropZIndex}
						textContextRangeRef={textContextRangeRef}
						onClose={closeTextContextMenu}
					/>
				) : null}
			</>
		);
	}
);

EnhancedWindow.displayName = 'EnhancedWindow';
