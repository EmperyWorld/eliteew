/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin: feedback ticket queue (unified admin section «Обращения»).
 *
 * Invariants:
 * - Page title lives in admin shell header (`headerMode=full`); body has filters and queue only.
 * - `admin_notes` on tickets is author-visible (team reply) — see feedback-tickets-product rule.
 * - Infinite admin queue uses bounded cache and no focus/mount refetch storms; mutations refetch explicitly.
 *
 * Related:
 * - `pages/Admin/shell/AdminSectionFrame.tsx`
 * - `documentation/product/FEEDBACK-HUB.md`
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
	DesktopAppButton,
	DesktopAppSectionLabel,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY, DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../Desktop/context/DesktopWindowPortalStackContext';
import {
	feedbackListPageTotal,
	flattenAdminFeedbackPages,
	isFeedbackAdminListPage,
} from '../Desktop/utils/feedbackPaged';
import {
	FEEDBACK_STATUSES,
	feedbackKindBadgeClass,
	feedbackStatusBadgeClass,
} from '../Desktop/utils/feedbackLabels';
import {
	adminFeedbackKindLabelI18n,
	adminFeedbackStatusLabelI18n,
} from './adminFeedbackLabelsI18n';
import { SecureAvatar } from '../../components/profile/SecureAvatar';
import {
	ArrowPathIcon,
	BugAntIcon,
	CalendarIcon,
	ChatBubbleLeftRightIcon,
	DocumentDuplicateIcon,
	FunnelIcon,
	LightBulbIcon,
	MagnifyingGlassIcon,
	SparklesIcon,
	UserCircleIcon,
} from '@heroicons/react/24/outline';

import {
	adminCloseFeedbackTicket,
	adminListFeedbackTickets,
	adminPatchFeedbackTicket,
	type FeedbackTicketAdmin,
} from '../Desktop/services/productDesktopApi';
import {
	parseAdminFeedbackUrl,
	replaceAdminFeedbackUrl,
	type AdminFeedbackUrlState,
} from './adminFeedbackUrlFilters';
import { AdminSectionFrame } from './shell/AdminSectionFrame';

const FILTER_STATUSES = ['', ...FEEDBACK_STATUSES] as const;

const ADMIN_FEEDBACK_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const ADMIN_FEEDBACK_STALE_MS = 15_000;
const ADMIN_FEEDBACK_GC_MS = 5 * 60 * 1000;

function shortId(uuid: string, len = 8): string {
	return uuid.length > len ? `${uuid.slice(0, len)}…` : uuid;
}

function readTicketIdFromUrl(): string | null {
	if (typeof window === 'undefined') return null;
	const fromSearch = new URLSearchParams(window.location.search).get('ticket');
	if (fromSearch) return fromSearch;
	const hash = window.location.hash.replace(/^#/, '');
	const q = hash.includes('?') ? hash.split('?')[1] : '';
	if (q) return new URLSearchParams(q).get('ticket');
	return null;
}

async function copyToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	document.body.appendChild(ta);
	ta.select();
	document.execCommand('copy');
	document.body.removeChild(ta);
}

export function FeedbackAdminSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const qc = useQueryClient();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const baseId = React.useId();
	const [status, setStatus] = React.useState<string>('');
	/** Когда фильтр «все статусы»: показывать ли закрытые (по умолчанию на сервере они скрыты). */
	const [includeClosed, setIncludeClosed] = React.useState(false);
	const [kindFilter, setKindFilter] = React.useState<string>('');
	const [searchInput, setSearchInput] = React.useState('');
	const [debouncedQ, setDebouncedQ] = React.useState('');
	const [closeFor, setCloseFor] = React.useState<FeedbackTicketAdmin | null>(
		null
	);
	const closeModalPanelRef = React.useRef<HTMLDivElement | null>(null);
	const closeModalLastFocusRef = React.useRef<HTMLElement | null>(null);
	const [reward, setReward] = React.useState('');
	const [closeNotes, setCloseNotes] = React.useState('');
	const [notesEdits, setNotesEdits] = React.useState<Record<string, string>>(
		{}
	);
	const [didScrollToTicket, setDidScrollToTicket] = React.useState(false);
	const urlHydratedRef = React.useRef(false);

	React.useEffect(() => {
		if (urlHydratedRef.current || typeof window === 'undefined') return;
		const parsed = parseAdminFeedbackUrl(
			new URLSearchParams(window.location.search)
		);
		if (parsed) {
			setStatus(parsed.status);
			setKindFilter(parsed.kind);
			setSearchInput(parsed.q);
			setDebouncedQ(parsed.q);
			setIncludeClosed(parsed.includeClosed);
		}
		urlHydratedRef.current = true;
	}, []);

	React.useEffect(() => {
		const t = window.setTimeout(() => {
			setDebouncedQ(searchInput.trim());
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	const feedbackUrlState = React.useMemo(
		(): AdminFeedbackUrlState => ({
			ticketId: readTicketIdFromUrl(),
			status,
			kind: kindFilter,
			q: debouncedQ,
			includeClosed,
		}),
		[status, kindFilter, debouncedQ, includeClosed]
	);

	React.useEffect(() => {
		if (!urlHydratedRef.current || typeof window === 'undefined') return;
		const t = window.setTimeout(() => {
			replaceAdminFeedbackUrl(feedbackUrlState);
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(t);
	}, [feedbackUrlState]);

	const listQuery = useInfiniteQuery({
		queryKey: [
			'admin',
			'feedback',
			status,
			includeClosed,
			kindFilter,
			debouncedQ,
			'paged',
			'v4',
		],
		queryFn: ({ pageParam }) =>
			adminListFeedbackTickets({
				status: status || undefined,
				include_closed: !status && includeClosed ? true : undefined,
				kind:
					kindFilter === 'wish' || kindFilter === 'bug'
						? kindFilter
						: undefined,
				q: debouncedQ || undefined,
				limit: ADMIN_FEEDBACK_PAGE,
				offset: pageParam,
			}),
		staleTime: ADMIN_FEEDBACK_STALE_MS,
		gcTime: ADMIN_FEEDBACK_GC_MS,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		initialPageParam: 0,
		getNextPageParam: (lastPage, _pages, lastPageParam) => {
			if (!isFeedbackAdminListPage(lastPage)) return undefined;
			const { items } = lastPage;
			if (items.length === 0) return undefined;
			const total = feedbackListPageTotal(lastPage);
			const next = lastPageParam + items.length;
			return next < total ? next : undefined;
		},
	});

	const patchMut = useMutation({
		mutationFn: (p: {
			id: string;
			body: { status?: string; admin_notes?: string | null };
		}) => adminPatchFeedbackTicket(p.id, p.body),
		onSuccess: async (_, vars) => {
			toast.success(t('adminFeedback.updated'));
			if (vars.body.admin_notes !== undefined) {
				setNotesEdits((prev) => {
					const next = { ...prev };
					delete next[vars.id];
					return next;
				});
			}
			await qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
			await qc.refetchQueries({
				queryKey: [
					'admin',
					'feedback',
					status,
					includeClosed,
					kindFilter,
					debouncedQ,
					'paged',
					'v4',
				],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const closeMut = useMutation({
		mutationFn: (p: {
			id: string;
			reward_credits?: number | null;
			admin_notes?: string | null;
		}) => adminCloseFeedbackTicket(p.id, p),
		onSuccess: async () => {
			setCloseFor(null);
			setReward('');
			setCloseNotes('');
			window.setTimeout(() => closeModalLastFocusRef.current?.focus(), 0);
			toast.success(t('adminFeedback.ticketClosed'));
			await qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
			await qc.refetchQueries({
				queryKey: [
					'admin',
					'feedback',
					status,
					includeClosed,
					kindFilter,
					debouncedQ,
					'paged',
					'v4',
				],
			});
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const tickets = React.useMemo(
		() => flattenAdminFeedbackPages(listQuery.data?.pages),
		[listQuery.data?.pages]
	);
	const firstPage = listQuery.data?.pages[0];
	const listTotal = isFeedbackAdminListPage(firstPage)
		? feedbackListPageTotal(firstPage)
		: tickets.length;

	const noteValue = (t: FeedbackTicketAdmin): string =>
		notesEdits[t.id] !== undefined ? notesEdits[t.id] : (t.admin_notes ?? '');

	React.useEffect(() => {
		if (!closeFor) return;
		closeModalLastFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const panel = closeModalPanelRef.current;
		if (!panel) return;
		const focusables = panel.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const list = [...focusables].filter((el) => !el.hasAttribute('disabled'));
		const first = list[0];
		const last = list[list.length - 1];
		window.setTimeout(() => first?.focus(), 0);
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setCloseFor(null);
				setReward('');
				setCloseNotes('');
				window.setTimeout(() => closeModalLastFocusRef.current?.focus(), 0);
				return;
			}
			if (e.key !== 'Tab' || list.length === 0) return;
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last?.focus();
				}
			} else if (document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		};
		panel.addEventListener('keydown', onKeyDown);
		return () => {
			panel.removeEventListener('keydown', onKeyDown);
		};
	}, [closeFor]);

	React.useEffect(() => {
		if (didScrollToTicket || tickets.length === 0) return;
		const tid = readTicketIdFromUrl();
		if (!tid) return;
		const found = tickets.some((x) => x.id === tid);
		if (!found) return;
		window.setTimeout(() => {
			document
				.getElementById(`admin-feedback-ticket-${tid}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			setDidScrollToTicket(true);
		}, 100);
	}, [tickets, didScrollToTicket]);

	const listStatusText = listQuery.isFetching
		? listQuery.isLoading
			? t('adminFeedback.loadingQueue')
			: t('adminFeedback.refreshing')
		: listQuery.isError
			? t('adminFeedback.loadError')
			: t('adminFeedback.queueCount', {
					total: listTotal,
					shown: tickets.length,
				});

	return (
		<AdminSectionFrame variant="full" className="flex flex-col gap-6">
			<div
				className={cn(
					'flex flex-col gap-3 border border-(--desktop-border-subtle)',
					'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,transparent)] px-4 py-3',
					'backdrop-blur-sm rounded-(--desktop-radius-lg) shadow-(--desktop-shadow-soft)'
				)}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-(--desktop-text-secondary)">
						<FunnelIcon
							className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb))]"
							aria-hidden
						/>
						<DesktopAppSectionLabel className="normal-case! tracking-normal!">
							{t('adminFeedback.filterTitle')}
						</DesktopAppSectionLabel>
					</div>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="gap-2"
						disabled={listQuery.isFetching && listQuery.isLoading}
						onClick={() => void listQuery.refetch()}
					>
						<ArrowPathIcon
							className={cn('h-4 w-4', listQuery.isFetching && 'animate-spin')}
							aria-hidden
						/>
						{t('adminFeedback.refresh')}
					</DesktopAppButton>
				</div>
				<p
					className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}
					aria-live="polite"
					aria-atomic="true"
				>
					{listStatusText}
				</p>
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-dim)`}>
					{t('adminFeedback.closedHint')}
				</p>
				<div className="relative w-full min-w-[200px] max-w-xl">
					<MagnifyingGlassIcon
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim)"
						aria-hidden
					/>
					<input
						type="search"
						id={`${baseId}-feedback-search`}
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder={t('adminFeedback.searchPlaceholder')}
						className={cn(
							'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
							'bg-(--desktop-surface-soft) py-2 pl-9 pr-3 text-sm text-(--desktop-text-primary)',
							'placeholder:text-(--desktop-text-dim)',
							'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)] focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950'
						)}
						aria-label={t('adminFeedback.searchAria')}
					/>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<label htmlFor={`${baseId}-status-filter`} className="sr-only">
						{t('adminFeedback.statusFilter')}
					</label>
					<div className="min-w-48 shrink-0">
						<DesktopNativeSelect
							id={`${baseId}-status-filter`}
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							className="text-sm"
						>
							{FILTER_STATUSES.map((s) => (
								<option
									key={s || 'all'}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
									value={s}
								>
									{s === ''
										? t('adminFeedback.allStatuses')
										: adminFeedbackStatusLabelI18n(s, t)}
								</option>
							))}
						</DesktopNativeSelect>
					</div>
					<label
						className={cn(
							'flex cursor-pointer items-center gap-2 rounded-(--desktop-radius) border border-transparent px-1 py-0.5 text-sm text-(--desktop-text-primary)',
							status !== '' && 'pointer-events-none opacity-45'
						)}
					>
						<input
							type="checkbox"
							className="h-4 w-4 rounded border-(--desktop-border-subtle) bg-(--desktop-surface-soft) accent-[rgb(var(--desktop-accent-rgb))]"
							checked={includeClosed}
							disabled={status !== ''}
							onChange={(e) => setIncludeClosed(e.target.checked)}
						/>
						{t('adminFeedback.showClosed')}
					</label>
					<label htmlFor={`${baseId}-kind-filter`} className="sr-only">
						{t('adminFeedback.kindFilter')}
					</label>
					<div className="min-w-40 shrink-0">
						<DesktopNativeSelect
							id={`${baseId}-kind-filter`}
							value={kindFilter}
							onChange={(e) => setKindFilter(e.target.value)}
							className="text-sm"
						>
							<option
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								value=""
							>
								{t('adminFeedback.allKinds')}
							</option>
							<option
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								value="wish"
							>
								{adminFeedbackKindLabelI18n('wish', t)}
							</option>
							<option
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								value="bug"
							>
								{adminFeedbackKindLabelI18n('bug', t)}
							</option>
						</DesktopNativeSelect>
					</div>
					<span
						className={cn(
							'rounded-(--desktop-radius-pill) border border-(--desktop-border-subtle)',
							'bg-(--desktop-surface-soft) px-2.5 py-1 text-xs tabular-nums text-(--desktop-text-muted)'
						)}
					>
						{listQuery.isFetching && !listQuery.isLoading
							? '…'
							: `${tickets.length} / ${listTotal}`}
					</span>
				</div>
			</div>

			{listQuery.isLoading && (
				<div
					className={cn(
						'flex min-h-[120px] items-center justify-center rounded-(--desktop-radius-lg)',
						'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80'
					)}
				>
					<ArrowPathIcon
						className="h-8 w-8 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
						aria-hidden
					/>
				</div>
			)}

			{listQuery.isError && (
				<div
					className={cn(
						'flex flex-col gap-3 border border-[color-mix(in_srgb,rgb(248_113_113)_35%,var(--desktop-border-subtle))]',
						'bg-[color-mix(in_srgb,rgb(127_29_29)_18%,var(--desktop-surface-soft))] px-4 py-3',
						'rounded-(--desktop-radius-lg)'
					)}
				>
					<p className="text-sm text-[color-mix(in_srgb,rgb(254_202_202)_92%,white)]">
						{t('adminFeedback.loadQueueError')}
					</p>
					<div>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="accent"
							className="gap-2"
							onClick={() => void listQuery.refetch()}
						>
							<ArrowPathIcon className="h-4 w-4" aria-hidden />
							{t('adminFeedback.retry')}
						</DesktopAppButton>
					</div>
				</div>
			)}

			{!listQuery.isLoading && !listQuery.isError && tickets.length === 0 && (
				<div
					className={cn(
						'flex flex-col items-center justify-center gap-2 border border-dashed border-(--desktop-border-subtle) py-16 text-center',
						'rounded-(--desktop-radius-lg) bg-(--desktop-surface-soft)/50'
					)}
				>
					<ChatBubbleLeftRightIcon
						className="h-10 w-10 text-(--desktop-text-dim)"
						aria-hidden
					/>
					<p
						className={`${DESKTOP_TYPOGRAPHY.body} text-(--desktop-text-muted)`}
					>
						{t('adminFeedback.emptyFilter')}
					</p>
				</div>
			)}

			<ul className="space-y-4">
				{tickets.map((ticket) => {
					const notesFieldId = `${baseId}-notes-${ticket.id}`;
					const hasMeta =
						ticket.client_meta && Object.keys(ticket.client_meta).length > 0;

					return (
						<li
							key={ticket.id}
							id={`admin-feedback-ticket-${ticket.id}`}
							className={cn(
								'overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
								'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_92%,transparent)] shadow-(--desktop-shadow-soft)',
								'ring-1 ring-[color-mix(in_srgb,rgb(255_255_255)_5%,transparent)]',
								'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
								'hover:border-(--desktop-border-strong)/35 hover:shadow-md hover:shadow-black/10'
							)}
						>
							<div
								className={cn(
									'border-b border-(--desktop-border-subtle) px-4 py-3',
									ticket.kind === 'bug'
										? 'bg-[color-mix(in_srgb,rgb(244_63_94)_10%,var(--desktop-surface-soft))]'
										: 'bg-[color-mix(in_srgb,rgb(34_211_238)_8%,var(--desktop-surface-soft))]'
								)}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="flex min-w-0 flex-1 gap-3">
										{ticket.submitter ? (
											<SecureAvatar
												avatarUrl={ticket.submitter.avatar_url?.trim() || null}
												className="h-10 w-10 shrink-0 rounded-full object-cover"
												alt=""
											/>
										) : (
											<div
												className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
												aria-hidden
											>
												<UserCircleIcon className="h-5 w-5 text-(--desktop-text-dim)" />
											</div>
										)}
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span
													className={cn(
														'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
														feedbackKindBadgeClass(ticket.kind)
													)}
												>
													{ticket.kind === 'bug' ? (
														<BugAntIcon className="h-3 w-3" aria-hidden />
													) : (
														<LightBulbIcon className="h-3 w-3" aria-hidden />
													)}
													{adminFeedbackKindLabelI18n(ticket.kind, t)}
												</span>
												<span
													className={cn(
														'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
														feedbackStatusBadgeClass(ticket.status)
													)}
												>
													{adminFeedbackStatusLabelI18n(ticket.status, t)}
												</span>
												<span
													className={`font-mono ${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-dim)`}
												>
													{shortId(ticket.id, 12)}
												</span>
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													className="h-7 gap-1 px-2 text-[11px]"
													onClick={() => {
														void (async () => {
															try {
																await copyToClipboard(ticket.id);
																toast.success(
																	t('adminFeedback.ticketIdCopied')
																);
															} catch {
																toast.error(t('adminFeedback.copyFailed'));
															}
														})();
													}}
												>
													<DocumentDuplicateIcon
														className="h-3 w-3"
														aria-hidden
													/>
													ID
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													size="sm"
													variant="ghost"
													className="h-7 gap-1 px-2 text-[11px]"
													onClick={() => {
														void (async () => {
															try {
																await copyToClipboard(ticket.user_id);
																toast.success(t('adminFeedback.userIdCopied'));
															} catch {
																toast.error(t('adminFeedback.copyFailed'));
															}
														})();
													}}
												>
													<DocumentDuplicateIcon
														className="h-3 w-3"
														aria-hidden
													/>
													User
												</DesktopAppButton>
											</div>
											{ticket.submitter ? (
												<div className="mt-2 min-w-0 space-y-0.5">
													<p
														className={`truncate font-medium text-(--desktop-text-primary) ${DESKTOP_TYPOGRAPHY.body}`}
													>
														{ticket.submitter.full_name?.trim() ||
															ticket.submitter.username}
													</p>
													<p
														className={`${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-muted)`}
													>
														@{ticket.submitter.username}
														<span className="mx-1.5 text-(--desktop-text-dim)">
															·
														</span>
														<span className="break-all">
															{ticket.submitter.email}
														</span>
													</p>
												</div>
											) : (
												<p
													className={`mt-2 ${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-dim)`}
												>
													{t('adminFeedback.anonymousUser', {
														id: ticket.user_id,
													})}
												</p>
											)}
										</div>
									</div>
									<div
										className={`flex shrink-0 items-center gap-1.5 ${DESKTOP_TYPOGRAPHY.meta}`}
									>
										<CalendarIcon className="h-3.5 w-3.5" aria-hidden />
										<time dateTime={ticket.created_at}>
											{new Date(ticket.created_at).toLocaleString()}
										</time>
									</div>
								</div>
							</div>

							<div className="space-y-4 px-4 py-4">
								<p
									className={`${DESKTOP_TYPOGRAPHY.body} whitespace-pre-wrap leading-relaxed text-(--desktop-text-primary)`}
								>
									{ticket.body}
								</p>

								{hasMeta && (
									<details className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80">
										<summary
											className={`cursor-pointer select-none px-3 py-2 ${DESKTOP_TYPOGRAPHY.small} text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)`}
										>
											{t('adminFeedback.clientMeta')}
										</summary>
										<pre
											className={`max-h-32 overflow-auto border-t border-(--desktop-border-subtle) px-3 py-2 font-mono text-[10px] leading-snug text-(--desktop-text-muted)`}
										>
											{JSON.stringify(ticket.client_meta, null, 2)}
										</pre>
									</details>
								)}

								<div className="flex flex-wrap items-center gap-2">
									<label
										htmlFor={`${baseId}-st-${ticket.id}`}
										className="sr-only"
									>
										{t('adminFeedback.changeStatus')}
									</label>
									<div className="min-w-42 shrink-0">
										<DesktopNativeSelect
											id={`${baseId}-st-${ticket.id}`}
											value={ticket.status}
											onChange={(e) =>
												patchMut.mutate({
													id: ticket.id,
													body: { status: e.target.value },
												})
											}
											disabled={patchMut.isPending}
											className="text-xs"
										>
											{FEEDBACK_STATUSES.map((s) => (
												<option
													key={s}
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													value={s}
												>
													{adminFeedbackStatusLabelI18n(s, t)}
												</option>
											))}
										</DesktopNativeSelect>
									</div>
									{ticket.status !== 'closed' && (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="neutral"
											className="gap-1.5 border-emerald-500/30 bg-[color-mix(in_srgb,rgb(16_185_129)_14%,var(--desktop-surface-soft))] text-emerald-100 hover:bg-[color-mix(in_srgb,rgb(16_185_129)_22%,var(--desktop-surface-soft-hover))]"
											onClick={() => {
												setCloseFor(ticket);
												setCloseNotes(ticket.admin_notes ?? '');
												setReward('');
											}}
										>
											<SparklesIcon className="h-3.5 w-3.5" aria-hidden />
											{t('adminFeedback.closeWithReward')}
										</DesktopAppButton>
									)}
								</div>

								<div
									className={cn(
										'space-y-2 border-t border-(--desktop-border-subtle) pt-4',
										DESKTOP_TYPOGRAPHY.small
									)}
								>
									<label
										htmlFor={notesFieldId}
										className={`block ${DESKTOP_TYPOGRAPHY.caption}`}
									>
										{t('adminFeedback.userNotesLabel')}
									</label>
									<textarea
										id={notesFieldId}
										rows={3}
										value={noteValue(ticket)}
										onChange={(e) =>
											setNotesEdits((prev) => ({
												...prev,
												[ticket.id]: e.target.value,
											}))
										}
										className={cn(
											'w-full resize-y rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
											'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
											'placeholder:text-(--desktop-text-dim)',
											'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)] focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950'
										)}
										placeholder={t('adminFeedback.replyPlaceholder')}
									/>
									<DesktopAppButton
										type="button"
										size="sm"
										variant="neutral"
										disabled={patchMut.isPending}
										onClick={() =>
											patchMut.mutate({
												id: ticket.id,
												body: {
													admin_notes: noteValue(ticket).trim() || null,
												},
											})
										}
									>
										{t('adminFeedback.saveNotes')}
									</DesktopAppButton>
								</div>
							</div>
						</li>
					);
				})}
			</ul>

			{listQuery.hasNextPage && (
				<div className="flex justify-center pt-2">
					<DesktopAppButton
						type="button"
						size="md"
						variant="neutral"
						disabled={listQuery.isFetchingNextPage}
						onClick={() => void listQuery.fetchNextPage()}
						className="min-w-[220px]"
					>
						{listQuery.isFetchingNextPage ? (
							<>
								<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
								{t('adminFeedback.loadingMore')}
							</>
						) : (
							t('adminFeedback.loadMore', {
								shown: tickets.length,
								total: listTotal,
							})
						)}
					</DesktopAppButton>
				</div>
			)}

			{closeFor && (
				<div
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedModalZ.backdrop }}
					role="dialog"
					aria-modal
					aria-labelledby={`${baseId}-close-title`}
				>
					<div
						ref={closeModalPanelRef}
						tabIndex={-1}
						style={{ zIndex: embeddedModalZ.content }}
						className={cn(
							'max-h-[90vh] w-full max-w-md overflow-y-auto border border-(--desktop-border-strong)',
							'bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_96%,black)] p-5',
							'shadow-(--desktop-shadow-lg) rounded-(--desktop-radius-xl) outline-none'
						)}
					>
						<div
							id={`${baseId}-close-title`}
							className={cn(DESKTOP_TYPOGRAPHY.subtitle, 'mb-1')}
						>
							{t('adminFeedback.closeModalTitle')}
						</div>
						<p className={`mb-4 ${DESKTOP_TYPOGRAPHY.meta}`}>
							{t('adminFeedback.closeModalDesc')}
						</p>
						<p
							className={`mb-4 line-clamp-4 whitespace-pre-wrap ${DESKTOP_TYPOGRAPHY.body} text-(--desktop-text-primary)`}
						>
							{closeFor.body}
						</p>
						<div className="space-y-4">
							<div>
								<label
									htmlFor={`${baseId}-reward`}
									className={`block ${DESKTOP_TYPOGRAPHY.caption}`}
								>
									{t('adminFeedback.rewardLabel')}
								</label>
								<input
									id={`${baseId}-reward`}
									type="number"
									min={0}
									step={1}
									value={reward}
									onChange={(e) => setReward(e.target.value)}
									className={cn(
										'mt-1.5 w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
										'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
										'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)] focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950'
									)}
								/>
							</div>
							<div>
								<label
									htmlFor={`${baseId}-close-notes`}
									className={`block ${DESKTOP_TYPOGRAPHY.caption}`}
								>
									{t('adminFeedback.closeNotesLabel')}
								</label>
								<textarea
									id={`${baseId}-close-notes`}
									rows={3}
									value={closeNotes}
									onChange={(e) => setCloseNotes(e.target.value)}
									className={cn(
										'mt-1.5 w-full resize-y rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
										'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
										'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)] focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950'
									)}
								/>
							</div>
						</div>
						<div className="mt-6 flex flex-wrap justify-end gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={() => {
									setCloseFor(null);
									setReward('');
									setCloseNotes('');
									closeModalLastFocusRef.current?.focus();
								}}
							>
								{t('adminFeedback.cancel')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="accent"
								disabled={closeMut.isPending}
								onClick={() => {
									const n =
										reward.trim() === '' ? 0 : Number.parseInt(reward, 10);
									const notesTrim = closeNotes.trim();
									closeMut.mutate({
										id: closeFor.id,
										reward_credits: Number.isFinite(n) && n > 0 ? n : undefined,
										admin_notes: notesTrim ? notesTrim : undefined,
									});
								}}
							>
								{closeMut.isPending
									? t('adminFeedback.closeSaving')
									: t('adminFeedback.closeSubmit')}
							</DesktopAppButton>
						</div>
					</div>
				</div>
			)}
		</AdminSectionFrame>
	);
}
