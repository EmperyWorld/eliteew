/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * useShellPortal — apps request floating UI through Shell; stacking, Escape, and
 * focus trap are owned by portalStackController + this host (U1.d / U1.e).
 *
 * Invariants:
 * - Apps do not call createPortal(document.body); Portal wraps ShellBodyPortal.
 * - zIndex / data-shell-portal-* come only from the stack controller.
 * - portal.policy === 'forbidden' → throw on open (dev/test assert).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md §5.3
 * - shell/portalStackController.ts
 * - shell/shellBodyPortal.tsx
 */

import {
	type CSSProperties,
	type ComponentType,
	type MutableRefObject,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';

import {
	focusFirstElement,
	restoreFocus,
	saveFocus,
} from '@/utils/accessibility';

import { useDesktopWindowPortalStackBase } from '../context/DesktopWindowPortalStackContext';
import { useDesktopModalFocusTrap } from '../hooks/useDesktopModalFocusTrap';

import {
	getShellAppRegistration,
	type ShellPortalLayerKind,
} from './appRegistry';
import {
	closeShellPortalSurface,
	getShellPortalSurface,
	isTopShellPortalSurface,
	listShellPortalSurfaces,
	openShellPortalSurface,
	subscribeShellPortalStack,
} from './portalStackController';
import { ShellBodyPortal } from './shellBodyPortal';
import { getDesktopPortalShellProps } from './shellPortalTheme';

export type UseShellPortalOptions = {
	/** Layer kind from Shell App Registry design (not raw z-index). */
	layer?: ShellPortalLayerKind;
	dismissOnEscape?: boolean;
	/** Default: true for embedded_modal / embedded_modal_backdrop. */
	trapFocus?: boolean;
	appComponent?: string;
	windowId?: string | null;
	/** Called when Shell dismisses top portal via Escape. */
	onDismiss?: () => void;
};

export type ShellPortalPropsBag = {
	style: CSSProperties;
	theme: 'light' | 'dark';
	zIndex: number;
	'data-shell-portal-id': string;
	'data-shell-portal-top'?: 'true';
	'data-shell-portal-layer': ShellPortalLayerKind;
};

export type UseShellPortalResult = {
	/** Mount children through Shell body portal (no app createPortal). */
	Portal: ComponentType<{ children: ReactNode }>;
	/** Latest surface snapshot while Portal is mounted (optional styling). */
	portalProps: ShellPortalPropsBag | null;
	surfaceId: string | null;
	isTop: boolean;
};

function defaultTrapFocus(layer: ShellPortalLayerKind): boolean {
	return layer === 'embedded_modal' || layer === 'embedded_modal_backdrop';
}

function assertPortalPolicyAllowed(appComponent?: string): void {
	if (!appComponent?.trim()) return;
	const reg = getShellAppRegistration(appComponent);
	if (reg?.portal.policy === 'forbidden') {
		throw new Error(
			`useShellPortal: portal.policy=forbidden for appComponent="${appComponent}"`
		);
	}
}

function getStackSnapshot(): string {
	return listShellPortalSurfaces()
		.map((s) => `${s.id}:${s.zIndex}`)
		.join('|');
}

type ShellPortalHostProps = {
	layer: ShellPortalLayerKind;
	dismissOnEscape: boolean;
	trapFocus: boolean;
	appComponent?: string;
	windowId?: string | null;
	onDismissRef: MutableRefObject<(() => void) | undefined>;
	surfaceIdRef: MutableRefObject<string | null>;
	onSurfaceId: (id: string | null) => void;
	children: ReactNode;
};

function ShellPortalHost({
	layer,
	dismissOnEscape,
	trapFocus,
	appComponent,
	windowId,
	onDismissRef,
	surfaceIdRef,
	onSurfaceId,
	children,
}: ShellPortalHostProps) {
	const windowPortalBase = useDesktopWindowPortalStackBase();
	const rootRef = useRef<HTMLDivElement>(null);

	const stackSnapshot = useSyncExternalStore(
		subscribeShellPortalStack,
		getStackSnapshot,
		() => ''
	);

	const surfaceId = surfaceIdRef.current;
	const surface = surfaceId ? getShellPortalSurface(surfaceId) : null;
	const isTop = surface ? isTopShellPortalSurface(surface.id) : false;

	useEffect(() => {
		assertPortalPolicyAllowed(appComponent);
		const id = openShellPortalSurface({
			layer,
			appComponent,
			windowId,
			windowPortalBase,
			dismissOnEscape,
			onRequestClose: () => {
				onDismissRef.current?.();
			},
		});
		surfaceIdRef.current = id;
		onSurfaceId(id);
		return () => {
			closeShellPortalSurface(id);
			if (surfaceIdRef.current === id) {
				surfaceIdRef.current = null;
			}
			onSurfaceId(null);
		};
	}, [
		layer,
		appComponent,
		windowId,
		windowPortalBase,
		dismissOnEscape,
		onDismissRef,
		surfaceIdRef,
		onSurfaceId,
	]);

	useDesktopModalFocusTrap(Boolean(trapFocus && isTop && surface), rootRef);

	useEffect(() => {
		if (!trapFocus || !isTop || !surface) return;
		saveFocus();
		const root = rootRef.current;
		const raf = window.requestAnimationFrame(() => {
			if (root) focusFirstElement(root);
		});
		return () => {
			window.cancelAnimationFrame(raf);
			restoreFocus();
		};
	}, [trapFocus, isTop, surface]);

	// Touch stackSnapshot so top/zIndex attrs refresh when another surface opens above.
	void stackSnapshot;

	const themeProps = getDesktopPortalShellProps();
	const zIndex = surface?.zIndex ?? windowPortalBase;

	return (
		<ShellBodyPortal>
			<div
				ref={rootRef}
				data-shell-portal-id={surface?.id}
				data-shell-portal-top={isTop ? 'true' : undefined}
				data-shell-portal-layer={layer}
				data-testid="shell-portal-surface"
				className={
					themeProps.theme === 'dark'
						? 'dark shell-portal-surface'
						: 'shell-portal-surface'
				}
				style={{
					...themeProps.style,
					zIndex,
					position: 'relative',
				}}
			>
				{children}
			</div>
		</ShellBodyPortal>
	);
}

/**
 * Request a Shell-managed floating surface. Pass `layer` (kind); Shell assigns z-index.
 * Render content as `<Portal>{content}</Portal>` — do not portal to document.body yourself.
 */
export function useShellPortal(
	options: UseShellPortalOptions = {}
): UseShellPortalResult {
	const layer = options.layer ?? 'embedded_popover';
	const dismissOnEscape = options.dismissOnEscape ?? true;
	const trapFocus = options.trapFocus ?? defaultTrapFocus(layer);
	const appComponent = options.appComponent;
	const windowId = options.windowId ?? null;

	const onDismissRef = useRef(options.onDismiss);
	onDismissRef.current = options.onDismiss;

	const surfaceIdRef = useRef<string | null>(null);
	const [surfaceId, setSurfaceId] = useState<string | null>(null);

	const stackSnapshot = useSyncExternalStore(
		subscribeShellPortalStack,
		getStackSnapshot,
		() => ''
	);
	void stackSnapshot;

	const onSurfaceId = useMemo(
		() => (id: string | null) => {
			setSurfaceId(id);
		},
		[]
	);

	const Portal = useMemo(() => {
		function PortalComponent({ children }: { children: ReactNode }) {
			return (
				<ShellPortalHost
					layer={layer}
					dismissOnEscape={dismissOnEscape}
					trapFocus={trapFocus}
					appComponent={appComponent}
					windowId={windowId}
					onDismissRef={onDismissRef}
					surfaceIdRef={surfaceIdRef}
					onSurfaceId={onSurfaceId}
				>
					{children}
				</ShellPortalHost>
			);
		}
		PortalComponent.displayName = 'ShellPortal';
		return PortalComponent;
	}, [layer, dismissOnEscape, trapFocus, appComponent, windowId, onSurfaceId]);

	const themeProps = getDesktopPortalShellProps();
	const surface = surfaceId ? getShellPortalSurface(surfaceId) : null;
	const isTop = surface ? isTopShellPortalSurface(surface.id) : false;
	const portalProps: ShellPortalPropsBag | null = surface
		? {
				style: {
					...themeProps.style,
					zIndex: surface.zIndex,
					position: 'relative',
				},
				theme: themeProps.theme,
				zIndex: surface.zIndex,
				'data-shell-portal-id': surface.id,
				'data-shell-portal-top': isTop ? 'true' : undefined,
				'data-shell-portal-layer': surface.layer,
			}
		: null;

	return {
		Portal,
		portalProps,
		surfaceId,
		isTop,
	};
}

/**
 * Declarative mount helper for overlays that previously used DesktopShellFloatingPortal.
 * Defaults match the legacy adapter (shell_global, Escape owned by caller).
 */
export function ShellPortalMount({
	children,
	layer = 'shell_global',
	dismissOnEscape = false,
	trapFocus = false,
	appComponent,
	windowId,
	onDismiss,
}: UseShellPortalOptions & { children: ReactNode }) {
	const { Portal } = useShellPortal({
		layer,
		dismissOnEscape,
		trapFocus,
		appComponent,
		windowId,
		onDismiss,
	});
	return <Portal>{children}</Portal>;
}
