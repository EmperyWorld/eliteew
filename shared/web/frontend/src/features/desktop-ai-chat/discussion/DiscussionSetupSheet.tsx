/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discussion setup dialog — scenario, topic, roster, role title, start CTA.
 *
 * Invariants:
 * - Single primary CTA: start discussion; never auto-starts.
 * - Roster min/max follow the selected preset (Interview may start with one hero).
 * - Mount via ShellPortalMount (no createPortal(document.body)); theme from ShellBodyPortal.
 * - Layout kinship with DesktopEnsembleBlueprintCommandsModal (header / scroll body).
 *
 * Related:
 * - DesktopEnsembleBlueprintCommandsModal.tsx
 * - pages/Desktop/shell/shellPortal.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { cn } from '@/utils/cn';
import {
	ChatBubbleLeftRightIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { desktopAiHeroCohort, getDesktopAiHero } from '../desktopAiHeroes';
import type { DiscussionIntensity, DiscussionPreset } from './types';

const PANEL_SURFACE =
	'rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(6,7,12)_8%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]';

const FIELD_SURFACE =
	'mt-1 w-full rounded-lg border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_96%,rgb(10,11,16)_4%)] px-3 py-2 text-sm text-(--desktop-text-primary) antialiased outline-none focus-visible:border-[rgb(var(--desktop-accent-rgb)/0.55)]';

const DEFAULT_ROLE = 'инкогнито';

export function DiscussionSetupSheet({
	open,
	onClose,
	presets,
	rosterOptions,
	busy,
	displayNameHint,
	initialRoleTitle,
	errorMessage,
	onStart,
}: {
	open: boolean;
	onClose: () => void;
	presets: DiscussionPreset[];
	rosterOptions: string[];
	busy: boolean;
	displayNameHint?: string;
	initialRoleTitle?: string;
	errorMessage?: string | null;
	onStart: (input: {
		preset_id: string;
		topic: string;
		goal: string;
		roster: string[];
		intensity: DiscussionIntensity;
		role_title: string;
	}) => Promise<unknown>;
}) {
	const { t, i18n } = useTranslation('desktopAiChat');
	const isRu = i18n.language?.toLowerCase().startsWith('ru');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const [presetId, setPresetId] = React.useState(
		presets[0]?.id ?? 'brainstorm'
	);
	const [topic, setTopic] = React.useState('');
	const [goal, setGoal] = React.useState('');
	const [roleTitle, setRoleTitle] = React.useState(
		initialRoleTitle?.trim() || DEFAULT_ROLE
	);
	const [intensity, setIntensity] = React.useState<DiscussionIntensity>(
		'professional_confrontational'
	);
	const [roster, setRoster] = React.useState<string[]>(() =>
		rosterOptions.slice(0, Math.min(4, rosterOptions.length))
	);

	const selectedPreset = React.useMemo(
		() => presets.find((item) => item.id === presetId) ?? presets[0],
		[presets, presetId]
	);
	const minRoster = selectedPreset?.min_roster ?? 2;
	const maxRoster = selectedPreset?.max_roster ?? 8;

	React.useEffect(() => {
		if (!open) return;
		setPresetId(presets[0]?.id ?? 'brainstorm');
		setRoster(rosterOptions.slice(0, Math.min(4, rosterOptions.length)));
		setRoleTitle(initialRoleTitle?.trim() || DEFAULT_ROLE);
	}, [open, presets, rosterOptions, initialRoleTitle]);

	if (!open || typeof document === 'undefined') return null;

	const toggleHero = (heroId: string) => {
		setRoster((prev) =>
			prev.includes(heroId)
				? prev.filter((h) => h !== heroId)
				: [...prev, heroId].slice(0, maxRoster)
		);
	};

	return (
		<ShellPortalMount
			layer="embedded_modal_backdrop"
			dismissOnEscape
			onDismiss={onClose}
			appComponent="DesktopAiChatApp"
		>
			<div
				className={cn(
					'fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-5',
					'text-(--desktop-text-primary)',
					DESKTOP_OVERLAY.backdrop
				)}
				style={{ zIndex: embeddedModalZ.backdrop }}
				data-discussion-setup-portal="1"
				role="presentation"
			>
				<button
					type="button"
					aria-label={t('discussionSetupCloseAria')}
					className="absolute inset-0 cursor-default border-0 bg-transparent"
					onClick={onClose}
				/>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="discussion-setup-title"
					className={cn(
						'relative flex max-h-[min(90dvh,720px)] w-full max-w-xl min-w-0 flex-col overflow-hidden outline-none',
						PANEL_SURFACE
					)}
					style={{ zIndex: embeddedModalZ.content }}
				>
					<header className="flex shrink-0 items-start justify-between gap-3 border-b border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] px-4 py-3 sm:px-5">
						<div className="flex min-w-0 items-start gap-2.5">
							<span
								className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,transparent)] text-[rgb(var(--desktop-accent-rgb)/0.95)]"
								aria-hidden
							>
								<ChatBubbleLeftRightIcon className="size-[18px]" />
							</span>
							<div className="min-w-0">
								<p
									className={cn(
										'text-(--desktop-text-dim) antialiased',
										DESKTOP_TYPOGRAPHY.captionInherit
									)}
								>
									{t('discussionModeLabel')}
								</p>
								<h2
									id="discussion-setup-title"
									className="text-sm font-semibold text-(--desktop-text-primary) antialiased"
								>
									{t('discussionSetupTitle')}
								</h2>
								<p
									className={cn(
										'mt-1 leading-snug text-(--desktop-text-dim) antialiased',
										DESKTOP_TYPOGRAPHY.captionInherit
									)}
								>
									{t('discussionSetupSubtitle')}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={onClose}
							className={cn(
								'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-(--desktop-border-subtle) px-2.5 py-2 text-sm font-medium text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
								DESKTOP_INTERACTIVE.btnRounded,
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							aria-label={t('discussionSetupCloseAria')}
							data-testid="discussion-setup-close"
						>
							<span>{t('discussionSetupClose')}</span>
							<XMarkIcon className="size-4" aria-hidden />
						</button>
					</header>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
						<section className="mb-4 grid gap-2 sm:grid-cols-2">
							{presets.map((preset) => {
								const selected = preset.id === presetId;
								const title = isRu ? preset.title_ru : preset.title_en;
								const desc = isRu
									? preset.description_ru
									: preset.description_en;
								return (
									<button
										key={preset.id}
										type="button"
										onClick={() => {
											setPresetId(preset.id);
											setIntensity(preset.default_intensity);
											setRoster((prev) =>
												prev.slice(0, Math.max(1, preset.max_roster))
											);
										}}
										className={cn(
											'rounded-xl border px-3 py-3 text-left transition antialiased',
											selected
												? 'border-[rgb(var(--desktop-accent-rgb))] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.14)_100%,transparent)]'
												: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.35)_100%,transparent)] hover:bg-(--desktop-surface-soft)'
										)}
									>
										<div className="text-sm font-medium text-(--desktop-text-primary)">
											{title}
										</div>
										<div className="mt-1 text-xs leading-snug text-(--desktop-text-secondary)">
											{desc}
										</div>
									</button>
								);
							})}
						</section>

						<label className="mb-3 block">
							<span
								className={cn(
									'text-(--desktop-text-secondary) antialiased',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{t('discussionTopicLabel')}
							</span>
							<textarea
								value={topic}
								onChange={(e) => setTopic(e.target.value)}
								rows={2}
								className={FIELD_SURFACE}
							/>
						</label>

						<label className="mb-3 block">
							<span
								className={cn(
									'text-(--desktop-text-secondary) antialiased',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{t('discussionGoalLabel')}
							</span>
							<textarea
								value={goal}
								onChange={(e) => setGoal(e.target.value)}
								rows={2}
								className={FIELD_SURFACE}
							/>
						</label>

						<label className="mb-3 block">
							<span
								className={cn(
									'text-(--desktop-text-secondary) antialiased',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{t('discussionRoleTitleLabel')}
							</span>
							<input
								type="text"
								value={roleTitle}
								onChange={(e) => setRoleTitle(e.target.value)}
								maxLength={120}
								placeholder={DEFAULT_ROLE}
								className={FIELD_SURFACE}
							/>
							<p
								className={cn(
									'mt-1 text-(--desktop-text-dim) antialiased',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
							>
								{t('discussionRoleTitleHint', {
									name: displayNameHint?.trim() || t('discussionUserTurn'),
									role: roleTitle.trim() || DEFAULT_ROLE,
								})}
							</p>
						</label>

						<div className="mb-4">
							<p
								className={cn(
									'mb-2 text-(--desktop-text-secondary) antialiased',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{t('discussionRosterLabel')}
							</p>
							{(
								[
									{
										key: 'assistants',
										title: t('heroPickerCohortAssistants'),
										ids: rosterOptions.filter(
											(id) =>
												desktopAiHeroCohort(getDesktopAiHero(id)) ===
												'assistants'
										),
									},
									{
										key: 'it_dept',
										title: t('heroPickerCohortItDept'),
										ids: rosterOptions.filter(
											(id) =>
												desktopAiHeroCohort(getDesktopAiHero(id)) === 'it_dept'
										),
									},
								] as const
							).map((section) =>
								section.ids.length === 0 ? null : (
									<div key={section.key} className="mb-2 last:mb-0">
										<p
											className={cn(
												'mb-1.5 text-(--desktop-text-dim) antialiased',
												DESKTOP_TYPOGRAPHY.micro
											)}
										>
											{section.title}
										</p>
										<div className="flex flex-wrap gap-2">
											{section.ids.map((heroId) => {
												const on = roster.includes(heroId);
												const label =
													getDesktopAiHero(heroId)?.shortLabel ?? heroId;
												return (
													<button
														key={heroId}
														type="button"
														onClick={() => toggleHero(heroId)}
														className={cn(
															'rounded-full border px-2.5 py-1 text-xs antialiased',
															on
																? 'border-[rgb(var(--desktop-accent-rgb))] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] text-(--desktop-text-primary)'
																: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)'
														)}
													>
														{label}
													</button>
												);
											})}
										</div>
									</div>
								)
							)}
						</div>

						{errorMessage ? (
							<p
								role="alert"
								className={cn(
									'mb-3 rounded-lg border border-[color-mix(in_srgb,rgb(248,113,113)/0.45)_100%,] bg-[color-mix(in_srgb,rgb(127,29,29)/0.35)_100%,] px-3 py-2 text-(--desktop-text-primary) antialiased',
									DESKTOP_TYPOGRAPHY.caption
								)}
							>
								{errorMessage}
							</p>
						) : null}
					</div>

					<footer className="flex shrink-0 justify-end gap-2 border-t border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] px-4 py-3 sm:px-5">
						<button
							type="button"
							onClick={onClose}
							className={cn(
								'rounded-md border border-(--desktop-border-subtle) px-3 py-2 text-sm text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
								DESKTOP_INTERACTIVE.btnRounded,
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{t('discussionSetupCancel')}
						</button>
						<button
							type="button"
							disabled={
								busy || topic.trim().length < 1 || roster.length < minRoster
							}
							onClick={() =>
								void onStart({
									preset_id: presetId,
									topic: topic.trim(),
									goal: goal.trim(),
									roster,
									intensity,
									role_title: roleTitle.trim() || DEFAULT_ROLE,
								})
							}
							className={cn(
								'rounded-md bg-[rgb(var(--desktop-accent-rgb))] px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
								DESKTOP_INTERACTIVE.btnRounded,
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{t('discussionStart')}
						</button>
					</footer>
				</div>
			</div>
		</ShellPortalMount>
	);
}
