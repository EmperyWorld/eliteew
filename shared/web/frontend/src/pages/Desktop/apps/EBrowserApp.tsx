/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EBrowser Desktop app chrome — toolbar, tabs, find/zoom, media toggles,
 * downloads tray, and host surface for the native WebKit stage.
 * EmpiierOS opens the seat overlay and does not paint https inside this window.
 *
 * Invariants:
 * - Cloud / non-native: honest degrade (no fake browser).
 * - Navigation pre-check is UX only; Rust on_navigation + Rust-fetched policy are authoritative.
 * - Native pages paint in a product-parent stage over the host div (not a free OS window).
 * - Chrome uses DesktopAppChrome tokens/primitives (premium-user-interface).
 * - Wave P chrome sync (events + adaptive poll); Wave U find/zoom/shortcuts/i18n.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 * - documentation/reference/solution-readiness/2026-09-10-ebrowser-ux-wave-u.md
 * - pages/Desktop/apps/ebrowser/*
 * - features/ebrowser/*
 */

import { cn } from '@/utils/cn';
import {
	ArrowLeftIcon,
	ArrowPathIcon,
	ArrowRightIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	MicrophoneIcon,
	MinusIcon,
	PlusIcon,
	SpeakerWaveIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type FormEvent,
	type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppSurface,
	DesktopAppToolbar,
	DesktopProductStatusBanner,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { requestDesktopFolderLibraryCountsInvalidate } from '@/services/unifiedContentEvents';
import {
	evaluateNavigation,
	type EBrowserNavPolicy,
} from '@/features/ebrowser/navPolicy';
import {
	EBROWSER_BOUNDS_DEBOUNCE_MS,
	EBROWSER_CHROME_BURST_WINDOW_MS,
	ebrowserBoundsEqual,
	ebrowserChromePollIntervalMs,
	ebrowserDownloadsFingerprint,
	ebrowserTabsFingerprint,
} from '@/features/ebrowser/ebrowserChromeSync';
import {
	activateNativeEBrowserTab,
	closeNativeEBrowser,
	closeNativeEBrowserTab,
	createNativeEBrowserTab,
	ebrowserStageBoundsFromElement,
	getNativeEBrowserChromeSnapshot,
	getNativeEBrowserLocation,
	getNativeEBrowserMediaToggles,
	isEliteewNativeDesktopProductShell,
	listNativeEBrowserTabs,
	listenNativeEBrowserChrome,
	nativeEBrowserFind,
	nativeEBrowserGetZoom,
	nativeEBrowserHistoryBack,
	nativeEBrowserHistoryForward,
	nativeEBrowserReload,
	nativeEBrowserSetZoom,
	navigateNativeEBrowser,
	openNativeEBrowser,
	policyApiToSnapshot,
	refreshNativeEBrowserPolicy,
	setNativeEBrowserBounds,
	setNativeEBrowserMediaToggles,
	type EBrowserChromeSnapshot,
	type EBrowserDownloadItem,
	type EBrowserMediaToggles,
	type EBrowserTabView,
} from '@/features/ebrowser/ebrowserNative';
import {
	ebrowserPolicyDeniedMessage,
	ebrowserPrecheckDeniedMessage,
} from '@/features/ebrowser/ebrowserDenyCopy';
import { fetchOwnEBrowserPolicy } from '@/features/ebrowser/ebrowserPolicyApi';
import { isEmpiierosFoflineHost } from '@/services/desktopClient/eliteewProductHost';
import {
	closeEmpiierosSeatBrowser,
	openEmpiierosSeatBrowser,
} from '@/features/ebrowser/ebrowserEmpiieros';
import { EBrowserDownloadsTray } from '@/pages/Desktop/apps/ebrowser/EBrowserDownloadsTray';
import { EBrowserFindBar } from '@/pages/Desktop/apps/ebrowser/EBrowserFindBar';
import { EBrowserTabStrip } from '@/pages/Desktop/apps/ebrowser/EBrowserTabStrip';
import { useEBrowserAppKeyboard } from '@/pages/Desktop/apps/ebrowser/useEBrowserAppKeyboard';

const DEFAULT_TOGGLES: EBrowserMediaToggles = {
	camera: false,
	microphone: false,
	audio_out: true,
};

function seatBrowserBanner(
	code: string | undefined,
	policyIsDefault: boolean,
	t: (key: string, opts?: Record<string, unknown>) => string
): string {
	if (code === 'seat_browser_unavailable') {
		return t('ebrowserApp.seatBrowserUnavailable');
	}
	if (code === 'seat_browser_scheme' || code === 'scheme') {
		return t('ebrowserApp.seatBrowserScheme');
	}
	if (code === 'tab_limit') {
		return t('ebrowserApp.tabLimit', { max: 3 });
	}
	if (code === 'download_busy') {
		return t('ebrowserApp.seatDownloadBusy');
	}
	if (
		code === 'allowlist_miss' ||
		code === 'policy_denied' ||
		code === 'policy_auth_required' ||
		code === 'policy_unauthorized' ||
		code === 'policy_fetch_failed' ||
		code === 'policy_invalid'
	) {
		return code === 'allowlist_miss'
			? ebrowserPrecheckDeniedMessage(code, policyIsDefault)
			: ebrowserPolicyDeniedMessage(policyIsDefault, code);
	}
	return t('ebrowserApp.openFailed');
}

function normalizeAddress(raw: string): string {
	const t = raw.trim();
	if (!t) return 'about:blank';
	if (t === 'about:blank' || t.startsWith('about:blank?')) return t;
	if (/^https:\/\//i.test(t)) return t;
	if (/^http:\/\//i.test(t)) return t;
	return `https://${t}`;
}

export function EBrowserApp(): ReactElement {
	const { t } = useTranslation('desktopUi');
	const native = isEliteewNativeDesktopProductShell();
	const empiierosHost = isEmpiierosFoflineHost();
	const stageHostRef = useRef<HTMLDivElement | null>(null);
	const addressInputRef = useRef<HTMLInputElement | null>(null);
	const findInputRef = useRef<HTMLInputElement | null>(null);
	const [address, setAddress] = useState('https://');
	const [policy, setPolicy] = useState<EBrowserNavPolicy | null>(null);
	const [policyIsDefault, setPolicyIsDefault] = useState(false);
	const [policyError, setPolicyError] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [toggles, setToggles] = useState<EBrowserMediaToggles>(DEFAULT_TOGGLES);
	const [opened, setOpened] = useState(false);
	const [canGoBack, setCanGoBack] = useState(false);
	const [canGoForward, setCanGoForward] = useState(false);
	const [pageTitle, setPageTitle] = useState('');
	const [downloads, setDownloads] = useState<EBrowserDownloadItem[]>([]);
	const [tabs, setTabs] = useState<EBrowserTabView[]>([]);
	const [maxTabs, setMaxTabs] = useState(3);
	const [findOpen, setFindOpen] = useState(false);
	const [findQuery, setFindQuery] = useState('');
	const [zoom, setZoom] = useState(1);
	const burstUntilRef = useRef(0);
	const lastBoundsRef = useRef<ReturnType<
		typeof ebrowserStageBoundsFromElement
	> | null>(null);
	const downloadsFpRef = useRef('');
	const tabsFpRef = useRef('');

	const modeLabel = useCallback(
		(mode: string | undefined): string => {
			switch (mode) {
				case 'open':
					return t('ebrowserApp.modeOpen');
				case 'allowlist':
					return t('ebrowserApp.modeAllowlist');
				case 'denylist':
					return t('ebrowserApp.modeDenylist');
				default:
					return t('ebrowserApp.modeUnknown');
			}
		},
		[t]
	);

	const markChromeBurst = useCallback(() => {
		burstUntilRef.current = Date.now() + EBROWSER_CHROME_BURST_WINDOW_MS;
	}, []);

	const applyChromeSnapshot = useCallback((snap: EBrowserChromeSnapshot) => {
		const loc = snap.location;
		if (loc?.ok && loc.url) {
			setCanGoBack(loc.canGoBack);
			setCanGoForward(loc.canGoForward);
			setPageTitle(loc.pageTitle.trim());
			const focused = addressInputRef.current === document.activeElement;
			if (!focused) {
				setAddress((prev) => (prev === loc.url ? prev : loc.url));
			}
		}
		const nextDownloads = snap.downloads.slice(-3);
		const dFp = ebrowserDownloadsFingerprint(nextDownloads);
		if (dFp !== downloadsFpRef.current) {
			downloadsFpRef.current = dFp;
			setDownloads(nextDownloads);
			if (nextDownloads.some((d) => d.phase === 'library')) {
				requestDesktopFolderLibraryCountsInvalidate();
			}
		}
		const tFp = ebrowserTabsFingerprint(snap.tabs, snap.maxTabs);
		if (tFp !== tabsFpRef.current) {
			tabsFpRef.current = tFp;
			setTabs(snap.tabs);
			setMaxTabs(snap.maxTabs);
		}
	}, []);

	const pullChromeSnapshot = useCallback(async () => {
		const snap = await getNativeEBrowserChromeSnapshot();
		if (snap) applyChromeSnapshot(snap);
	}, [applyChromeSnapshot]);

	const refreshPolicy =
		useCallback(async (): Promise<EBrowserNavPolicy | null> => {
			try {
				const api = await fetchOwnEBrowserPolicy();
				const snap = policyApiToSnapshot(api);
				setPolicy(snap);
				setPolicyIsDefault(Boolean(api.is_default));
				setPolicyError(null);
				if (isEliteewNativeDesktopProductShell()) {
					await refreshNativeEBrowserPolicy();
				}
				return snap;
			} catch {
				setPolicy(null);
				setPolicyIsDefault(false);
				setPolicyError(t('ebrowserApp.policyLoadFailed'));
				return null;
			}
		}, [t]);

	useEffect(() => {
		void refreshPolicy();
		const id = window.setInterval(() => void refreshPolicy(), 60_000);
		return () => {
			window.clearInterval(id);
			if (native) void closeNativeEBrowser();
			if (empiierosHost) void closeEmpiierosSeatBrowser();
		};
	}, [native, empiierosHost, refreshPolicy]);

	useEffect(() => {
		if (!native) return;
		void (async () => {
			const remote = await getNativeEBrowserMediaToggles();
			if (remote) setToggles(remote);
			const z = await nativeEBrowserGetZoom();
			setZoom(z);
		})();
	}, [native]);

	useEffect(() => {
		if (!native || !opened) return;
		const el = stageHostRef.current;
		if (!el) return;
		let timer: number | null = null;
		const sync = () => {
			const bounds = ebrowserStageBoundsFromElement(stageHostRef.current);
			if (!bounds) return;
			if (ebrowserBoundsEqual(bounds, lastBoundsRef.current)) return;
			lastBoundsRef.current = bounds;
			void setNativeEBrowserBounds(bounds);
		};
		const schedule = () => {
			if (timer != null) window.clearTimeout(timer);
			timer = window.setTimeout(sync, EBROWSER_BOUNDS_DEBOUNCE_MS);
		};
		sync();
		const ro = new ResizeObserver(() => schedule());
		ro.observe(el);
		window.addEventListener('resize', schedule);
		return () => {
			if (timer != null) window.clearTimeout(timer);
			ro.disconnect();
			window.removeEventListener('resize', schedule);
		};
	}, [native, opened]);

	useEffect(() => {
		if (!native || !opened) return;
		let cancelled = false;
		let unlisten: (() => void) | null = null;
		let pollTimer: number | null = null;

		const schedulePoll = () => {
			if (cancelled) return;
			if (pollTimer != null) window.clearTimeout(pollTimer);
			const delay = ebrowserChromePollIntervalMs({
				hidden: document.hidden,
				burstUntilMs: burstUntilRef.current,
				nowMs: Date.now(),
			});
			pollTimer = window.setTimeout(() => {
				void (async () => {
					await pullChromeSnapshot();
					schedulePoll();
				})();
			}, delay);
		};

		void (async () => {
			unlisten = await listenNativeEBrowserChrome((snap) => {
				if (cancelled) return;
				applyChromeSnapshot(snap);
				markChromeBurst();
				schedulePoll();
			});
			if (cancelled) {
				unlisten();
				return;
			}
			await pullChromeSnapshot();
			schedulePoll();
		})();

		const onVisibility = () => schedulePoll();
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisibility);
			if (pollTimer != null) window.clearTimeout(pollTimer);
			unlisten?.();
		};
	}, [
		native,
		opened,
		applyChromeSnapshot,
		pullChromeSnapshot,
		markChromeBurst,
	]);

	const applyToggles = useCallback(
		async (next: EBrowserMediaToggles) => {
			setToggles(next);
			if (!native) return;
			await setNativeEBrowserMediaToggles(next);
		},
		[native]
	);

	const go = useCallback(
		async (raw: string) => {
			const url = normalizeAddress(raw);
			setAddress(url);
			setBanner(null);

			if (!native && !empiierosHost) {
				setBanner(t('ebrowserApp.cloudBanner'));
				return;
			}

			let effective = policy;
			let decision = evaluateNavigation(url, effective);
			if (
				!decision.allowed &&
				(decision.reason === 'expired' || decision.reason === 'missing_policy')
			) {
				effective = await refreshPolicy();
				decision = evaluateNavigation(url, effective);
			}
			if (!decision.allowed) {
				const hostIsSoT =
					empiierosHost &&
					(decision.reason === 'missing_policy' ||
						decision.reason === 'expired');
				if (!hostIsSoT) {
					setBanner(
						ebrowserPrecheckDeniedMessage(decision.reason, policyIsDefault)
					);
					return;
				}
			}

			setBusy(true);
			try {
				if (empiierosHost) {
					const bounds = ebrowserStageBoundsFromElement(stageHostRef.current);
					const result = await openEmpiierosSeatBrowser({ url, bounds });
					if (!result.ok) {
						setBanner(seatBrowserBanner(result.code, policyIsDefault, t));
						return;
					}
					setOpened(true);
					return;
				}
				if (opened) {
					const result = await navigateNativeEBrowser(url);
					if (!result.ok) {
						setBanner(
							result.code === 'policy_denied' ||
								result.code === 'policy_auth_required' ||
								result.code === 'policy_unauthorized' ||
								result.code === 'policy_fetch_failed' ||
								result.code === 'policy_invalid'
								? ebrowserPolicyDeniedMessage(policyIsDefault, result.code)
								: result.message || t('ebrowserApp.openFailed')
						);
					} else {
						markChromeBurst();
						void pullChromeSnapshot();
					}
					return;
				}
				const bounds = ebrowserStageBoundsFromElement(stageHostRef.current);
				if (!bounds || bounds.width < 48 || bounds.height < 48) {
					setBanner(t('ebrowserApp.stageNotReady'));
					return;
				}
				const result = await openNativeEBrowser(url, bounds);
				if (!result.ok) {
					setBanner(
						result.code === 'policy_denied' ||
							result.code === 'policy_auth_required' ||
							result.code === 'policy_unauthorized' ||
							result.code === 'policy_fetch_failed' ||
							result.code === 'policy_invalid'
							? ebrowserPolicyDeniedMessage(policyIsDefault, result.code)
							: result.message || t('ebrowserApp.openFailed')
					);
					return;
				}
				setOpened(true);
				markChromeBurst();
				void pullChromeSnapshot();
			} finally {
				setBusy(false);
			}
		},
		[
			native,
			empiierosHost,
			opened,
			policy,
			policyIsDefault,
			refreshPolicy,
			markChromeBurst,
			pullChromeSnapshot,
			t,
		]
	);

	const reload = useCallback(async () => {
		if (!native || !opened) return;
		setBusy(true);
		setBanner(null);
		try {
			const result = await nativeEBrowserReload();
			if (!result.ok) {
				setBanner(result.message || t('ebrowserApp.reloadFailed'));
			} else {
				markChromeBurst();
				void pullChromeSnapshot();
			}
		} finally {
			setBusy(false);
		}
	}, [native, opened, markChromeBurst, pullChromeSnapshot, t]);

	const syncZoomFromNative = useCallback(async () => {
		const z = await nativeEBrowserGetZoom();
		setZoom(z);
	}, []);

	const reportFindFailure = useCallback(
		(code: string | undefined) => {
			if (code === 'find_unsupported') {
				setBanner(t('ebrowserApp.findUnsupported'));
				return;
			}
			if (code === 'find_query_too_long') {
				setBanner(t('ebrowserApp.findQueryTooLong'));
				return;
			}
			setBanner(t('ebrowserApp.findFailed'));
		},
		[t]
	);

	const newTab = useCallback(async () => {
		if (!native || !stageHostRef.current) return;
		const bounds = ebrowserStageBoundsFromElement(stageHostRef.current);
		if (!bounds) return;
		setBusy(true);
		try {
			const result = await createNativeEBrowserTab(bounds, 'about:blank');
			if (!result.ok) {
				setBanner(
					result.code === 'ebrowser_tabs_busy'
						? t('ebrowserApp.tabLimit', { max: maxTabs })
						: result.message || t('ebrowserApp.tabCreateFailed')
				);
				return;
			}
			setOpened(true);
			setAddress('about:blank');
			markChromeBurst();
			await pullChromeSnapshot();
			await syncZoomFromNative();
		} finally {
			setBusy(false);
		}
	}, [
		native,
		maxTabs,
		markChromeBurst,
		pullChromeSnapshot,
		syncZoomFromNative,
		t,
	]);

	const switchTab = useCallback(
		async (tabId: number) => {
			const result = await activateNativeEBrowserTab(tabId);
			if (!result.ok) {
				setBanner(result.message || t('ebrowserApp.tabSwitchFailed'));
				return;
			}
			markChromeBurst();
			await pullChromeSnapshot();
			const loc = await getNativeEBrowserLocation();
			if (loc?.ok) {
				if (loc.url) setAddress(loc.url);
				setPageTitle(loc.pageTitle.trim());
				setCanGoBack(loc.canGoBack);
				setCanGoForward(loc.canGoForward);
			} else {
				setPageTitle('');
				setCanGoBack(false);
				setCanGoForward(false);
			}
			await syncZoomFromNative();
		},
		[markChromeBurst, pullChromeSnapshot, syncZoomFromNative, t]
	);

	const removeTab = useCallback(
		async (tabId: number) => {
			const result = await closeNativeEBrowserTab(tabId);
			if (!result.ok) {
				setBanner(result.message || t('ebrowserApp.tabCloseFailed'));
				return;
			}
			markChromeBurst();
			await pullChromeSnapshot();
			const tabState = await listNativeEBrowserTabs();
			if (tabState.tabs.length === 0) {
				setOpened(false);
				setAddress('about:blank');
				setPageTitle('');
				setFindOpen(false);
				setZoom(1);
				void nativeEBrowserFind('finish');
				return;
			}
			const loc = await getNativeEBrowserLocation();
			if (loc?.ok && loc.url) {
				setAddress(loc.url);
				setPageTitle(loc.pageTitle.trim());
			}
			await syncZoomFromNative();
		},
		[markChromeBurst, pullChromeSnapshot, syncZoomFromNative, t]
	);

	const closeOtherTabs = useCallback(
		async (keepId: number) => {
			const others = tabs.filter((tab) => tab.id !== keepId);
			let failed = false;
			for (const tab of others) {
				const result = await closeNativeEBrowserTab(tab.id);
				if (!result.ok) {
					failed = true;
					break;
				}
			}
			const keep = await activateNativeEBrowserTab(keepId);
			if (!keep.ok) {
				setBanner(keep.message || t('ebrowserApp.tabSwitchFailed'));
			}
			if (failed) {
				setBanner(t('ebrowserApp.tabCloseFailed'));
			}
			markChromeBurst();
			await pullChromeSnapshot();
			await syncZoomFromNative();
		},
		[tabs, markChromeBurst, pullChromeSnapshot, syncZoomFromNative, t]
	);

	const closeActiveTab = useCallback(() => {
		const active = tabs.find((tab) => tab.active);
		if (active) void removeTab(active.id);
	}, [tabs, removeTab]);

	const openFind = useCallback(() => {
		if (!opened) return;
		setFindOpen(true);
		window.setTimeout(() => findInputRef.current?.focus(), 0);
	}, [opened]);

	const closeFind = useCallback(() => {
		setFindOpen(false);
		setFindQuery('');
		void nativeEBrowserFind('finish');
	}, []);

	const runFindStart = useCallback(() => {
		void (async () => {
			const result = await nativeEBrowserFind('start', findQuery);
			if (!result.ok) reportFindFailure(result.code);
		})();
	}, [findQuery, reportFindFailure]);

	const runFindStep = useCallback(
		(action: 'next' | 'previous') => {
			void (async () => {
				const result = await nativeEBrowserFind(action);
				if (!result.ok) reportFindFailure(result.code);
			})();
		},
		[reportFindFailure]
	);

	const adjustZoom = useCallback(
		async (next: number) => {
			const result = await nativeEBrowserSetZoom(next);
			if (!result.ok) {
				if (result.code === 'zoom_unsupported') {
					setBanner(t('ebrowserApp.zoomUnsupported'));
				} else {
					setBanner(t('ebrowserApp.zoomFailed'));
				}
				return;
			}
			setZoom(result.level);
		},
		[t]
	);

	useEBrowserAppKeyboard({
		enabled: native,
		opened,
		addressInputRef,
		findInputRef,
		findOpen,
		onOpenFind: openFind,
		onCloseFind: closeFind,
		onNewTab: () => void newTab(),
		onCloseActiveTab: closeActiveTab,
		onZoomIn: () => void adjustZoom(zoom + 0.1),
		onZoomOut: () => void adjustZoom(zoom - 0.1),
		onZoomReset: () => void adjustZoom(1),
	});

	const mediaControls = (
		<fieldset
			className="flex items-center gap-1 border-0 p-0"
			aria-label={t('ebrowserApp.mediaLegend')}
		>
			<legend className="sr-only">{t('ebrowserApp.mediaLegend')}</legend>
			{(
				[
					['camera', t('ebrowserApp.camera'), toggles.camera, VideoCameraIcon],
					[
						'microphone',
						t('ebrowserApp.microphone'),
						toggles.microphone,
						MicrophoneIcon,
					],
					[
						'audio_out',
						t('ebrowserApp.audioOut'),
						toggles.audio_out,
						SpeakerWaveIcon,
					],
				] as const
			).map(([key, label, on, Icon]) => (
				<DesktopChromeTooltip key={key} content={label} placement="bottom">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						aria-label={label}
						aria-pressed={on}
						disabled={!native}
						active={on}
						onClick={() =>
							void applyToggles({
								...toggles,
								[key]: !on,
							})
						}
						className="h-9 w-9 min-h-9 min-w-9"
					>
						<Icon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</DesktopAppButton>
				</DesktopChromeTooltip>
			))}
		</fieldset>
	);

	return (
		<DesktopAppContentWrapper>
			<DesktopAppSurface className="flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0">
				<header className="flex shrink-0 items-center gap-3 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 px-3 py-2">
					<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.1)]">
						<GlobeAltIcon
							className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb))]"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</span>
					<div className="min-w-0 flex-1">
						<h1
							className={cn(
								'truncate font-semibold text-(--desktop-text-primary)',
								DESKTOP_TYPOGRAPHY.shellCopy15
							)}
						>
							{opened && pageTitle ? pageTitle : t('ebrowserApp.title')}
						</h1>
						<p
							className={cn(
								'truncate text-(--desktop-text-secondary)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{opened && pageTitle
								? t('ebrowserApp.subtitleLive')
								: t('ebrowserApp.subtitle')}
						</p>
					</div>
					{native ? mediaControls : null}
				</header>

				{native && (opened || tabs.length > 0) ? (
					<EBrowserTabStrip
						tabs={tabs}
						pageTitle={pageTitle}
						maxTabs={maxTabs}
						busy={busy}
						labels={{
							tabs: t('ebrowserApp.tabsLabel'),
							newTab: t('ebrowserApp.newTab'),
							closeTab: (id) => t('ebrowserApp.closeTab', { id }),
							closeOthers: t('ebrowserApp.closeOtherTabs'),
							blankTab: t('ebrowserApp.newTabLabel'),
						}}
						onSwitch={(id) => void switchTab(id)}
						onClose={(id) => void removeTab(id)}
						onNew={() => void newTab()}
						onCloseOthers={(id) => void closeOtherTabs(id)}
					/>
				) : null}

				<form
					onSubmit={(e: FormEvent) => {
						e.preventDefault();
						void go(address);
					}}
					aria-label={t('ebrowserApp.addressLabel')}
					className="shrink-0"
				>
					<DesktopAppToolbar className="flex flex-wrap items-center gap-1.5 border-b border-(--desktop-border-subtle) px-2 py-1.5">
						<DesktopChromeTooltip
							content={t('ebrowserApp.back')}
							placement="bottom"
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								disabled={!opened || busy || !canGoBack}
								onClick={() => void nativeEBrowserHistoryBack()}
								aria-label={t('ebrowserApp.back')}
								className="h-9 w-9 min-h-9 min-w-9"
							>
								<ArrowLeftIcon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('ebrowserApp.forward')}
							placement="bottom"
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								disabled={!opened || busy || !canGoForward}
								onClick={() => void nativeEBrowserHistoryForward()}
								aria-label={t('ebrowserApp.forward')}
								className="h-9 w-9 min-h-9 min-w-9"
							>
								<ArrowRightIcon className="h-4 w-4" aria-hidden />
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopChromeTooltip
							content={t('ebrowserApp.reload')}
							placement="bottom"
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								disabled={!opened || busy}
								onClick={() => void reload()}
								aria-label={t('ebrowserApp.reload')}
								className="h-9 w-9 min-h-9 min-w-9"
							>
								<ArrowPathIcon
									className={cn('h-4 w-4', busy && opened && 'animate-spin')}
									aria-hidden
								/>
							</DesktopAppButton>
						</DesktopChromeTooltip>
						<DesktopAppInput
							ref={addressInputRef}
							type="text"
							value={address}
							onChange={(e) => setAddress(e.target.value)}
							className="min-w-[10rem] flex-1"
							placeholder={t('ebrowserApp.addressPlaceholder')}
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
						/>
						<DesktopAppButton
							type="submit"
							variant="accent"
							size="sm"
							disabled={busy}
							className="shrink-0"
						>
							{t('ebrowserApp.open')}
						</DesktopAppButton>
						{native && opened ? (
							<>
								<DesktopChromeTooltip
									content={t('ebrowserApp.findLabel')}
									placement="bottom"
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t('ebrowserApp.findLabel')}
										onClick={openFind}
										className="h-9 w-9 min-h-9 min-w-9"
									>
										<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
									</DesktopAppButton>
								</DesktopChromeTooltip>
								<DesktopChromeTooltip
									content={t('ebrowserApp.zoomOut')}
									placement="bottom"
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t('ebrowserApp.zoomOut')}
										onClick={() => void adjustZoom(zoom - 0.1)}
										className="h-9 w-9 min-h-9 min-w-9"
									>
										<MinusIcon className="h-4 w-4" aria-hidden />
									</DesktopAppButton>
								</DesktopChromeTooltip>
								<DesktopChromeTooltip
									content={t('ebrowserApp.zoomReset')}
									placement="bottom"
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										aria-label={t('ebrowserApp.zoomReset')}
										onClick={() => void adjustZoom(1)}
										className="min-w-10"
									>
										{Math.round(zoom * 100)}%
									</DesktopAppButton>
								</DesktopChromeTooltip>
								<DesktopChromeTooltip
									content={t('ebrowserApp.zoomIn')}
									placement="bottom"
								>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t('ebrowserApp.zoomIn')}
										onClick={() => void adjustZoom(zoom + 0.1)}
										className="h-9 w-9 min-h-9 min-w-9"
									>
										<PlusIcon className="h-4 w-4" aria-hidden />
									</DesktopAppButton>
								</DesktopChromeTooltip>
							</>
						) : null}
						{!native && !empiierosHost ? mediaControls : null}
					</DesktopAppToolbar>
				</form>

				{findOpen ? (
					<EBrowserFindBar
						query={findQuery}
						onQueryChange={setFindQuery}
						onSubmit={runFindStart}
						onNext={() => runFindStep('next')}
						onPrev={() => runFindStep('previous')}
						onClose={closeFind}
						inputRef={findInputRef}
						labels={{
							label: t('ebrowserApp.findLabel'),
							placeholder: t('ebrowserApp.findPlaceholder'),
							next: t('ebrowserApp.findNext'),
							prev: t('ebrowserApp.findPrev'),
							close: t('ebrowserApp.findClose'),
						}}
					/>
				) : null}

				{policyError ? (
					<DesktopProductStatusBanner
						tone="warning"
						description={policyError}
						className="shrink-0 rounded-none border-x-0"
					/>
				) : null}
				{policyIsDefault && !policyError ? (
					<DesktopProductStatusBanner
						tone="warning"
						title={t('ebrowserApp.policyClosedTitle')}
						description={t('ebrowserApp.policyClosedBody')}
						className="shrink-0 rounded-none border-x-0"
					/>
				) : null}
				{banner ? (
					<DesktopProductStatusBanner
						tone="danger"
						description={banner}
						className="shrink-0 rounded-none border-x-0"
						actions={
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setBanner(null)}
							>
								{t('ebrowserApp.dismiss')}
							</DesktopAppButton>
						}
					/>
				) : null}

				<EBrowserDownloadsTray
					downloads={downloads}
					label={t('ebrowserApp.downloadsLabel')}
					openLabel={t('ebrowserApp.openDownloads')}
					host={empiierosHost ? 'empiieros' : 'tauri'}
					onSeatLocal={() => setBanner(t('ebrowserApp.seatDownloadsNotice'))}
				/>

				{native ? (
					<section
						ref={stageHostRef}
						className="relative min-h-0 flex-1 bg-(--desktop-surface-app)"
						aria-label={t('ebrowserApp.stageLabel')}
					>
						{!opened ? (
							<DesktopAppEmptyState
								className="h-full"
								icon={
									<GlobeAltIcon
										className="h-8 w-8"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								}
								title={
									policyIsDefault
										? t('ebrowserApp.emptyAwaitPolicy')
										: t('ebrowserApp.emptyEnterUrl')
								}
								description={
									policyIsDefault
										? t('ebrowserApp.emptyAwaitPolicyBody')
										: t('ebrowserApp.emptyEnterUrlBody', {
												mode: modeLabel(policy?.mode),
											})
								}
							/>
						) : null}
					</section>
				) : empiierosHost ? (
					<section
						ref={stageHostRef}
						className="relative min-h-0 flex-1"
						aria-label={t('ebrowserApp.stageLabel')}
					>
						<DesktopAppEmptyState
							className="h-full min-h-[16rem]"
							icon={
								<GlobeAltIcon
									className="h-8 w-8"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title={
								opened
									? t('ebrowserApp.seatOpenTitle')
									: t('ebrowserApp.seatLauncherTitle')
							}
							description={
								opened
									? t('ebrowserApp.seatOpenBody')
									: t('ebrowserApp.seatLauncherBody')
							}
						/>
					</section>
				) : (
					<DesktopAppEmptyState
						className="min-h-[16rem] flex-1"
						icon={
							<GlobeAltIcon
								className="h-8 w-8"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title={t('ebrowserApp.cloudTitle')}
						description={t('ebrowserApp.cloudBody')}
					/>
				)}
			</DesktopAppSurface>
		</DesktopAppContentWrapper>
	);
}

export default EBrowserApp;
