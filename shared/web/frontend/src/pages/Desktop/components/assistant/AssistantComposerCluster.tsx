/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Assistant chat composer: textarea, send/stop, rate-limit banner, keyboard shortcuts panel.
 *
 * Invariants:
 * - Parent owns send/stream state and input value; cluster is presentational + local focus UI.
 *
 * Related:
 * - pages/Desktop/components/assistant/AssistantChatThreadPanel.tsx
 * - pages/Desktop/components/AssistantApp.tsx
 */
import { cn } from '@/utils/cn';
import {
	ChevronDownIcon,
	ClockIcon,
	CommandLineIcon,
	PaperAirplaneIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import type { DesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
} from '../DesktopAppChrome';
import {
	ASSISTANT_CHAT_COUNTER_THRESHOLD,
	ASSISTANT_CHAT_COUNTER_WARN_CHARS,
	ASSISTANT_CHAT_MESSAGE_MAX_CHARS,
	ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY,
	ASSISTANT_SHORTCUTS_PANEL_ITEMS,
} from './assistantChatConstants';
import {
	ASSISTANT_COMPOSER_CHAR_COUNTER_CLASS,
	ASSISTANT_COMPOSER_CHAR_DANGER_CLASS,
	ASSISTANT_COMPOSER_CHAR_WARN_CLASS,
	ASSISTANT_COMPOSER_FIELD_CLASS,
	ASSISTANT_COMPOSER_FOCUSED_CLASS,
	ASSISTANT_COMPOSER_RATE_LIMIT_HINT_CLASS,
	ASSISTANT_COMPOSER_RATE_LIMIT_WRAP_CLASS,
	ASSISTANT_COMPOSER_READY_CLASS,
	ASSISTANT_COMPOSER_SHORTCUTS_LINK_CLASS,
	ASSISTANT_COMPOSER_SHORTCUTS_LINK_READY_CLASS,
	ASSISTANT_RATE_LIMIT_BANNER_CLASS,
	ASSISTANT_RATE_LIMIT_BANNER_FAQ_LINK_CLASS,
	ASSISTANT_SEND_RATE_LIMIT_CLASS,
	ASSISTANT_SEND_READY_HOVER_CLASS,
	ASSISTANT_SHORTCUTS_KBD_OPEN_CLASS,
	ASSISTANT_SHORTCUTS_PANEL_CLASS,
	ASSISTANT_SHORTCUTS_PANEL_FLASH_CLASS,
	ASSISTANT_SHORTCUTS_ROW_ACTIVE_CLASS,
	ASSISTANT_SHORTCUTS_ROW_CLASS,
	ASSISTANT_SHORTCUTS_SUMMARY_OPEN_CLASS,
	ASSISTANT_STOP_BUTTON_ACTIVE_CLASS,
	ASSISTANT_STOP_BUTTON_READY_CLASS,
	ASSISTANT_STREAM_STOPPED_HINT_CLASS,
} from './assistantChatPanelStyles';
import { ASSISTANT_KBD_HINT_CLASS } from './assistantFaqPanelStyles';
import { MOBILE_EMBEDDED_HANDBOOK_COMPOSER_SEND_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';

export type AssistantComposerClusterProps = {
	composerClass: string;
	embeddedMobileLayout: boolean;
	input: string;
	onInputChange: (value: string) => void;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	composerFocused: boolean;
	onComposerFocusedChange: (focused: boolean) => void;
	syncComposerHeight: () => void;
	sending: boolean;
	rateLimitSecondsLeft: number;
	streamStoppedFlash: boolean;
	/** When false, composer send is disabled (K17 offline). */
	networkAvailable?: boolean;
	onSend: (text: string) => void | Promise<void>;
	onStopStream: () => void;
	onOpenShortcutsPanel: () => void;
	onFocusFaqSearch: () => void;
	shortcutsOpen: boolean;
	onShortcutsOpenChange: (open: boolean) => void;
	shortcutsOpenFlash: boolean;
	shortcutsPanelRef: RefObject<HTMLDetailsElement | null>;
	faqSearchFocused: boolean;
	shellTheme: DesktopShellTheme;
	t: TFunction<'desktopUi', 'assistant'>;
};

export function AssistantComposerCluster({
	composerClass,
	embeddedMobileLayout,
	input,
	onInputChange,
	inputRef,
	composerFocused,
	onComposerFocusedChange,
	syncComposerHeight,
	sending,
	rateLimitSecondsLeft,
	streamStoppedFlash,
	networkAvailable = true,
	onSend,
	onStopStream,
	onOpenShortcutsPanel,
	onFocusFaqSearch,
	shortcutsOpen,
	onShortcutsOpenChange,
	shortcutsOpenFlash,
	shortcutsPanelRef,
	faqSearchFocused,
	shellTheme: _shellTheme,
	t,
}: AssistantComposerClusterProps): React.ReactElement {
	return (
		<>
			{rateLimitSecondsLeft > 0 ? (
				<div
					role="status"
					aria-live="polite"
					className={ASSISTANT_RATE_LIMIT_BANNER_CLASS}
				>
					<span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
						<span
							className={cn(
								'motion-safe:animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full',
								'bg-[rgb(var(--desktop-accent-rgb)/0.45)] opacity-75 motion-reduce:animate-none'
							)}
							aria-hidden
						/>
						<ClockIcon
							className="relative h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
							aria-hidden
						/>
					</span>
					<div className="min-w-0 leading-snug">
						{t('rateLimitBanner', { seconds: rateLimitSecondsLeft })}{' '}
						<button
							type="button"
							className={cn(
								'underline underline-offset-2 decoration-amber-200/35',
								'text-amber-50/95 hover:text-amber-50 hover:decoration-amber-100/90',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded-sm',
								ASSISTANT_RATE_LIMIT_BANNER_FAQ_LINK_CLASS
							)}
							onClick={onFocusFaqSearch}
						>
							{t('rateLimitBannerFocusFaq')}
						</button>
					</div>
				</div>
			) : null}
			<div
				className={cn(
					composerClass,
					'items-end gap-3 border-t-[3px]',
					rateLimitSecondsLeft > 0
						? cn(
								'border-t-[rgb(var(--desktop-accent-rgb)/0.38)]',
								ASSISTANT_COMPOSER_RATE_LIMIT_WRAP_CLASS
							)
						: 'border-t-[rgb(var(--desktop-accent-rgb)/0.42)]'
				)}
				data-assistant-guide="composer"
			>
				<div
					className={cn(
						ASSISTANT_COMPOSER_FIELD_CLASS,
						sending && 'opacity-70',
						composerFocused &&
							!sending &&
							rateLimitSecondsLeft === 0 &&
							ASSISTANT_COMPOSER_FOCUSED_CLASS,
						!sending &&
							input.trim() &&
							rateLimitSecondsLeft === 0 &&
							!composerFocused &&
							ASSISTANT_COMPOSER_READY_CLASS,
						rateLimitSecondsLeft > 0 &&
							'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_6%,var(--desktop-surface-soft))]',
						rateLimitSecondsLeft > 0 &&
							'focus-within:border-[rgb(var(--desktop-accent-rgb)/0.42)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)]'
					)}
				>
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => {
							onInputChange(e.target.value);
							syncComposerHeight();
						}}
						onFocus={() => onComposerFocusedChange(true)}
						onBlur={() => onComposerFocusedChange(false)}
						readOnly={sending}
						rows={2}
						placeholder={
							sending
								? t('streaming')
								: rateLimitSecondsLeft > 0
									? t('rateLimitWait', { seconds: rateLimitSecondsLeft })
									: t('placeholder')
						}
						aria-label={t('placeholder')}
						className={cn(
							'w-full min-h-11 resize-none overflow-y-auto border-0 bg-transparent px-0.5 py-1.5',
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
							'outline-none',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						maxLength={ASSISTANT_CHAT_MESSAGE_MAX_CHARS}
						onKeyDown={(e) => {
							if (
								(e.ctrlKey || e.metaKey) &&
								e.key === 'Enter' &&
								input.trim() &&
								!sending &&
								rateLimitSecondsLeft === 0
							) {
								e.preventDefault();
								void onSend(input);
								return;
							}
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								if (input.trim() && !sending) {
									void onSend(input);
								}
							}
						}}
					/>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-dim) px-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5'
						)}
					>
						<span className="inline-flex flex-wrap items-center gap-1.5">
							{streamStoppedFlash ? (
								<span className={ASSISTANT_STREAM_STOPPED_HINT_CLASS}>
									<StopIcon
										className="h-3 w-3 shrink-0 opacity-90"
										aria-hidden
									/>
									{t('streamStopped')}
									<span className="text-(--desktop-text-dim)">
										{' '}
										· {t('streamStoppedHint')}
									</span>
								</span>
							) : rateLimitSecondsLeft > 0 ? (
								<span className={ASSISTANT_COMPOSER_RATE_LIMIT_HINT_CLASS}>
									<ClockIcon
										className="h-3 w-3 shrink-0 opacity-80"
										aria-hidden
									/>
									{t('rateLimitWait', { seconds: rateLimitSecondsLeft })}
								</span>
							) : !embeddedMobileLayout ? (
								<span
									className="inline-flex flex-wrap items-center gap-1.5"
									data-assistant-composer-kbd-hints
								>
									<span className="hidden lg:inline">
										{t('composerKbdHintOneLine')}
									</span>
									<span className="lg:hidden hidden md:inline">
										{t('sendShortcut')}
									</span>
									<kbd
										className={cn(
											ASSISTANT_KBD_HINT_CLASS,
											'md:hidden',
											composerFocused &&
												'border-[rgb(var(--desktop-accent-rgb)/0.45)] text-[rgb(var(--desktop-accent-rgb)/0.9)]'
										)}
									>
										{t('shortcutsKbdCtrlDot')}
									</kbd>
									<span className="text-(--desktop-text-dim)/55" aria-hidden>
										·
									</span>
									<button
										type="button"
										className={cn(
											ASSISTANT_COMPOSER_SHORTCUTS_LINK_CLASS,
											ASSISTANT_COMPOSER_SHORTCUTS_LINK_READY_CLASS
										)}
										onClick={onOpenShortcutsPanel}
									>
										{t('composerShortcutsLink')}
									</button>
								</span>
							) : null}
						</span>
						{input.length >= ASSISTANT_CHAT_COUNTER_THRESHOLD ? (
							<span
								className={cn(
									ASSISTANT_COMPOSER_CHAR_COUNTER_CLASS,
									input.length >= ASSISTANT_CHAT_MESSAGE_MAX_CHARS - 50
										? ASSISTANT_COMPOSER_CHAR_DANGER_CLASS
										: input.length >= ASSISTANT_CHAT_COUNTER_WARN_CHARS
											? ASSISTANT_COMPOSER_CHAR_WARN_CLASS
											: 'border-(--desktop-border-subtle)/50 text-(--desktop-text-dim)'
								)}
							>
								{t('composerCharCount', {
									current: input.length,
									max: ASSISTANT_CHAT_MESSAGE_MAX_CHARS,
								})}
							</span>
						) : null}
					</div>
				</div>
				<DesktopAppButton
					type="button"
					variant={sending ? 'neutral' : 'accent'}
					size="md"
					className={cn(
						'shrink-0 gap-1.5 min-h-9 px-3 shadow-sm max-sm:px-2.5',
						embeddedMobileLayout &&
							MOBILE_EMBEDDED_HANDBOOK_COMPOSER_SEND_CLASS,
						sending &&
							cn(
								ASSISTANT_STOP_BUTTON_ACTIVE_CLASS,
								ASSISTANT_STOP_BUTTON_READY_CLASS
							),
						!sending &&
							rateLimitSecondsLeft > 0 &&
							cn(
								'border-amber-500/35 bg-amber-500/10 text-amber-100/95',
								ASSISTANT_SEND_RATE_LIMIT_CLASS
							),
						!sending &&
							(!input.trim() || rateLimitSecondsLeft > 0) &&
							'opacity-55',
						!sending &&
							input.trim() &&
							rateLimitSecondsLeft === 0 &&
							'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.32)] ring-offset-1 ring-offset-transparent',
						!sending &&
							input.trim() &&
							rateLimitSecondsLeft === 0 &&
							ASSISTANT_SEND_READY_HOVER_CLASS
					)}
					disabled={
						sending
							? false
							: !networkAvailable || !input.trim() || rateLimitSecondsLeft > 0
					}
					title={
						!networkAvailable && !sending
							? t('offlineAiChatDisabled')
							: undefined
					}
					onClick={() => (sending ? onStopStream() : void onSend(input))}
				>
					{sending ? (
						<>
							<StopIcon className="w-4 h-4" aria-hidden />
							{!embeddedMobileLayout ? (
								<span className="hidden sm:inline">{t('stopStream')}</span>
							) : (
								<span className="sr-only">{t('stopStream')}</span>
							)}
						</>
					) : rateLimitSecondsLeft > 0 ? (
						<>
							<ClockIcon className="w-4 h-4 shrink-0" aria-hidden />
							<span className="tabular-nums">
								{t('sendRateLimitBadge', { seconds: rateLimitSecondsLeft })}
							</span>
						</>
					) : (
						<>
							<PaperAirplaneIcon className="w-4 h-4" aria-hidden />
							{!embeddedMobileLayout ? (
								<span className="hidden sm:inline">{t('send')}</span>
							) : (
								<span className="sr-only">{t('send')}</span>
							)}
						</>
					)}
				</DesktopAppButton>
			</div>
			{!embeddedMobileLayout ? (
				<details
					ref={shortcutsPanelRef}
					open={shortcutsOpen}
					onToggle={(e) => {
						const open = e.currentTarget.open;
						onShortcutsOpenChange(open);
						try {
							sessionStorage.setItem(
								ASSISTANT_SHORTCUTS_OPEN_STORAGE_KEY,
								open ? '1' : '0'
							);
						} catch {
							/* sessionStorage unavailable */
						}
					}}
					className={cn(
						ASSISTANT_SHORTCUTS_PANEL_CLASS,
						shortcutsOpenFlash && ASSISTANT_SHORTCUTS_PANEL_FLASH_CLASS
					)}
					data-assistant-guide="shortcuts"
				>
					<summary
						className={cn(
							'cursor-pointer list-none px-3 py-1.5 rounded-lg',
							DESKTOP_TYPOGRAPHY.shellMeta10,
							'font-medium tracking-normal text-(--desktop-text-muted)',
							'hover:text-(--desktop-text-secondary)',
							ASSISTANT_SHORTCUTS_SUMMARY_OPEN_CLASS,
							'[&::-webkit-details-marker]:hidden flex items-center gap-2',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						<CommandLineIcon
							className="h-3.5 w-3.5 shrink-0 opacity-80"
							aria-hidden
						/>
						<ChevronDownIcon
							className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open/shortcuts:rotate-180 motion-reduce:transition-none"
							aria-hidden
						/>
						{t('shortcutsPanelTitle')}
					</summary>
					<ul
						className={cn(
							'mt-1 space-y-1.5 px-3',
							DESKTOP_TYPOGRAPHY.caption,
							'text-(--desktop-text-dim)'
						)}
					>
						{ASSISTANT_SHORTCUTS_PANEL_ITEMS.map((item) => {
							const rowActive =
								(item.id === 'focus' && composerFocused) ||
								(item.id === 'faq' && faqSearchFocused);
							return (
								<li
									key={item.id}
									className={cn(
										ASSISTANT_SHORTCUTS_ROW_CLASS,
										rowActive && ASSISTANT_SHORTCUTS_ROW_ACTIVE_CLASS
									)}
								>
									<kbd
										className={cn(
											ASSISTANT_KBD_HINT_CLASS,
											'shrink-0 min-w-18 justify-center',
											shortcutsOpen && ASSISTANT_SHORTCUTS_KBD_OPEN_CLASS,
											rowActive &&
												'border-[rgb(var(--desktop-accent-rgb)/0.45)] text-[rgb(var(--desktop-accent-rgb)/0.92)]'
										)}
									>
										{t(item.kbdKey)}
									</kbd>
									<span
										className={cn(
											rowActive && 'text-[rgb(var(--desktop-accent-rgb)/0.88)]'
										)}
									>
										{t(item.labelKey)}
									</span>
								</li>
							);
						})}
					</ul>
				</details>
			) : null}
		</>
	);
}
