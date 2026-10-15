/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile embedded companion composer edge toolbar: attach, sheets, restore, voice rail (U8.3 slice 14).
 *
 * Invariants:
 * - Only used when `mobileEmbeddedComposerLayout` is active in the panel shell.
 *
 * Related:
 * - src/components/mobileEmbedded/mobileEmbeddedLayoutTokens.ts
 */

import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { MOBILE_EMBEDDED_EWA_COMPOSER_TOOLBAR_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { CompanionComposerAttachButtons } from '@/features/ewa/companionUx/CompanionComposerAttachButtons';
import { CompanionComposerVoiceRail } from '@/features/ewa/companionUx/CompanionComposerVoiceRail';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import type { EwaCompanionVoiceInputState } from '@/features/ewa/useEwaCompanionVoiceInput';
import type { EwaCompanionVoiceOutputState } from '@/features/ewa/useEwaCompanionVoiceOutput';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionMobileComposerToolbarProps = {
	buttonClassName: string;
	pending: boolean;
	draftTrimmed: boolean;
	useWebSearch?: boolean;
	webSearchLabel?: string;
	webSearchTitle?: string;
	hideMemoryStrip: boolean;
	mobileActiveOperationCount: number;
	memoryStripCount: number;
	canRestoreLastMessage: boolean;
	companionVoiceEnabled: boolean;
	voiceSessionActive: boolean;
	voiceInputBusy: boolean;
	voiceInputState: EwaCompanionVoiceInputState;
	voiceOutputState: EwaCompanionVoiceOutputState;
	voiceOutEnabled: boolean;
	onWebSearchChange?: (checked: boolean) => void;
	onAttachImage: () => void;
	onOpenOperations: () => void;
	onOpenMemory: () => void;
	onRestoreLastMessage: () => void;
	onEnterVoiceSession: () => void;
	onVoiceSpeakerClick: () => void;
	onVoiceMicClick: () => void;
	onSend: () => void;
};

export function CompanionMobileComposerToolbar({
	buttonClassName,
	pending,
	draftTrimmed,
	useWebSearch = false,
	webSearchLabel = 'Web',
	webSearchTitle = '',
	hideMemoryStrip,
	mobileActiveOperationCount,
	memoryStripCount,
	canRestoreLastMessage,
	companionVoiceEnabled,
	voiceSessionActive,
	voiceInputBusy,
	voiceInputState,
	voiceOutputState,
	voiceOutEnabled,
	onWebSearchChange,
	onAttachImage,
	onOpenOperations,
	onOpenMemory,
	onRestoreLastMessage,
	onEnterVoiceSession,
	onVoiceSpeakerClick,
	onVoiceMicClick,
	onSend,
}: CompanionMobileComposerToolbarProps) {
	const { t } = useTranslation('marketing');

	return (
		<div
			role="toolbar"
			data-companion-mobile-toolbar="1"
			className={MOBILE_EMBEDDED_EWA_COMPOSER_TOOLBAR_CLASS}
			aria-label={t('ewaCompanion.chatComposerToolsAria')}
		>
			<CompanionComposerAttachButtons
				density="mobile"
				buttonClassName={buttonClassName}
				pending={pending}
				canRestoreLastMessage={canRestoreLastMessage}
				includeRestore={false}
				onAttachImage={onAttachImage}
				onRestoreLastMessage={onRestoreLastMessage}
			/>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className={cn(
					buttonClassName,
					mobileActiveOperationCount > 0 && 'relative'
				)}
				disabled={pending}
				onClick={onOpenOperations}
				aria-label={
					mobileActiveOperationCount > 0
						? t('ewaCompanion.mobileOperationsOpenAria', {
								count: mobileActiveOperationCount,
							})
						: t('ewaCompanion.operationsSheetTitle')
				}
				title={t('ewaCompanion.operationsSheetTitle')}
				data-testid="ewa-companion-mobile-operations-open"
				data-active-operations={
					mobileActiveOperationCount > 0
						? String(mobileActiveOperationCount)
						: undefined
				}
			>
				<SparklesIcon className="size-3.5" aria-hidden />
				{mobileActiveOperationCount > 0 ? (
					<span
						className={cn(
							'pointer-events-none absolute -right-0.5 -top-0.5',
							'flex h-4 min-w-4 items-center justify-center rounded-full',
							'bg-[rgb(var(--desktop-accent-rgb))] px-1 text-[9px] font-bold leading-none text-white',
							'shadow-[0_0_0_1px_rgba(0,0,0,0.35)]'
						)}
						aria-hidden
					>
						{mobileActiveOperationCount > 9 ? '9+' : mobileActiveOperationCount}
					</span>
				) : null}
			</DesktopAppButton>
			<label
				className={cn(
					'flex cursor-pointer items-center gap-1 rounded-full border border-white/10 px-2 py-1',
					'text-[11px]',
					useWebSearch
						? 'border-cyan-300/40 bg-cyan-400/12 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
						: 'text-(--desktop-text-secondary)'
				)}
				title={webSearchTitle}
				data-web-search-active={useWebSearch ? '1' : undefined}
			>
				<input
					type="checkbox"
					checked={useWebSearch}
					disabled={pending}
					onChange={(event) => onWebSearchChange?.(event.target.checked)}
					className="h-3 w-3 rounded border-white/20 bg-black/20 text-cyan-400 focus:ring-cyan-400/30"
				/>
				<span>
					{useWebSearch
						? t('ewaCompanion.webSearchLabelActive')
						: webSearchLabel || t('ewaCompanion.webSearchLabel')}
				</span>
			</label>
			{!hideMemoryStrip ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className={cn(buttonClassName, memoryStripCount > 0 && 'relative')}
					disabled={pending}
					onClick={onOpenMemory}
					aria-label={
						memoryStripCount > 0
							? t('ewaCompanion.mobileMemoryOpenAria', {
									count: memoryStripCount,
								})
							: t('ewaCompanion.memoryStripTitle')
					}
					title={t('ewaCompanion.memoryStripTitle')}
					data-testid="ewa-companion-mobile-memory-open"
				>
					<EwaIcon
						name="icon-ewa-brain"
						size="sm"
						tone="muted"
						className="size-3.5 opacity-90"
					/>
					{memoryStripCount > 0 ? (
						<span
							className={cn(
								'pointer-events-none absolute -right-0.5 -top-0.5',
								'flex h-4 min-w-4 items-center justify-center rounded-full',
								'bg-(--companion-aura) px-1 text-[9px] font-bold leading-none text-white',
								'shadow-[0_0_0_1px_rgba(0,0,0,0.35)]'
							)}
							aria-hidden
						>
							{memoryStripCount > 9 ? '9+' : memoryStripCount}
						</span>
					) : null}
				</DesktopAppButton>
			) : null}
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className={buttonClassName}
				disabled={pending || !canRestoreLastMessage}
				onClick={onRestoreLastMessage}
				aria-label={t('ewaCompanion.chatRestoreLastMessageAria')}
				title={t('ewaCompanion.chatRestoreLastMessage')}
				data-testid="ewa-companion-restore-last-message"
			>
				<ArrowPathIcon className="size-3.5" aria-hidden />
			</DesktopAppButton>
			<CompanionComposerVoiceRail
				density="mobile"
				buttonClassName={buttonClassName}
				companionVoiceEnabled={companionVoiceEnabled}
				pending={pending}
				draftTrimmed={draftTrimmed}
				voiceSessionActive={voiceSessionActive}
				voiceInputBusy={voiceInputBusy}
				voiceInputState={voiceInputState}
				voiceOutputState={voiceOutputState}
				voiceOutEnabled={voiceOutEnabled}
				onEnterVoiceSession={onEnterVoiceSession}
				onVoiceSpeakerClick={onVoiceSpeakerClick}
				onVoiceMicClick={onVoiceMicClick}
				onSend={onSend}
			/>
		</div>
	);
}
