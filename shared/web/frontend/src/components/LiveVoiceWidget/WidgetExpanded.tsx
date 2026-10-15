/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Expanded Live Voice panel: premium dock/card chrome — one title, mic hero CTA,
 * progressive tabs for text/settings/history.
 *
 * Invariants:
 * - Power toggle is never gated on socket: `setActive(true)` connects; HTTP fallback remains.
 * - Dock chrome paints opaque (`rgb(.../1)`) — wallpaper must not show through the rail.
 * - Record empty state: no operator instruction card; mic is the sole primary CTA.
 * - DesktopChromeTooltip on icon-only chrome when embedded in desktop shell.
 *
 * Related:
 * - liveVoiceLayoutTokens.ts, LiveVoiceDesktopPipeline.tsx, RecordingButton.tsx
 * - documentation/product/VOICE-CONTROL-STUDIO.md
 */

import * as React from 'react';
import { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChatBubbleLeftRightIcon,
	ClockIcon,
	Cog6ToothIcon,
	MicrophoneIcon,
	PowerIcon,
	Square2StackIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useAuth } from '../../contexts/AuthContext';
import { RecordingButton } from './RecordingButton';
import { VoiceSettings } from './VoiceSettings';
import { ConversationHistory } from './ConversationHistory';
import { PipelineStatus } from './PipelineStatus';
import { TextToVoicePanel } from './TextToVoicePanel';
import type { PipelineStage } from './hooks/useLiveVoice';
import {
	LIVE_VOICE_BODY,
	LIVE_VOICE_FOOTER,
	LIVE_VOICE_HEADER,
	LIVE_VOICE_ICON_BADGE,
	LIVE_VOICE_ICON_BUTTON,
	LIVE_VOICE_PANEL_ROOT_CARD,
	LIVE_VOICE_PANEL_ROOT_DOCK,
	LIVE_VOICE_POWER_TRACK,
	LIVE_VOICE_RECORD_HERO,
	LIVE_VOICE_TAB,
	LIVE_VOICE_TABLIST,
	LIVE_VOICE_TURN_CARD,
} from './liveVoiceLayoutTokens';

interface WidgetExpandedProps {
	isRecording: boolean;
	audioLevel?: number;
	pipelineStage?: PipelineStage;
	pipelineProgress?: number;
	transcription?: string | null;
	aiResponse?: string | null;
	error?: Error | null;
	isActive?: boolean;
	modelsReady?: boolean;
	isConnected?: boolean;
	isPlaying?: boolean;
	onClose: () => void;
	onRecordingClick: () => void;
	onReset?: () => void;
	onToggleActive?: (active: boolean) => void;
	onStopPlayback?: () => void;
	onMouseDown?: (e: React.MouseEvent) => void;
	/**
	 * `card` — floating widget.
	 * `dock` — opaque desktop side rail (no wallpaper bleed).
	 */
	chrome?: 'card' | 'dock';
}

type TabType = 'record' | 'text' | 'settings' | 'history';

export const WidgetExpanded: React.FC<WidgetExpandedProps> = memo(
	({
		isRecording,
		audioLevel = 0,
		pipelineStage: pipelineStageProp = 'idle',
		pipelineProgress: _pipelineProgress = 0,
		transcription,
		aiResponse,
		error: errorProp,
		isActive = false,
		modelsReady = false,
		isConnected = false,
		isPlaying = false,
		onClose,
		onRecordingClick,
		onReset,
		onToggleActive,
		onStopPlayback,
		onMouseDown,
		chrome = 'card',
	}) => {
		const isDock = chrome === 'dock';
		const [activeTab, setActiveTab] = useState<TabType>('record');
		const { user } = useAuth();
		const { t } = useTranslation('desktopUi', {
			keyPrefix: 'liveVoiceDesktop',
		});

		const safeError: Error | null =
			errorProp instanceof Error
				? errorProp
				: errorProp
					? new Error(String(errorProp))
					: null;

		const pipelineStage: PipelineStage = (pipelineStageProp ??
			'idle') as PipelineStage;

		const statusLabel = !isConnected
			? t('statusOffline')
			: isActive && modelsReady
				? t('statusReady')
				: t('statusStandby');

		const hasTurn = Boolean(transcription || aiResponse);
		const showPipeline =
			Boolean(isRecording || pipelineStage !== 'idle') &&
			Boolean(pipelineStage);

		const tabs = [
			{ id: 'record' as TabType, label: t('tabRecord'), icon: MicrophoneIcon },
			{
				id: 'text' as TabType,
				label: t('tabText'),
				icon: ChatBubbleLeftRightIcon,
			},
			{
				id: 'settings' as TabType,
				label: t('tabSettings'),
				icon: Cog6ToothIcon,
			},
			{ id: 'history' as TabType, label: t('tabHistory'), icon: ClockIcon },
		];

		return (
			<motion.div
				id="live-voice-widget-panel"
				role="region"
				aria-label={t('panelAria')}
				aria-expanded
				className={
					isDock ? LIVE_VOICE_PANEL_ROOT_DOCK : LIVE_VOICE_PANEL_ROOT_CARD
				}
				layout
				initial={{ opacity: 0, y: isDock ? 0 : 20, scale: isDock ? 1 : 0.95 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: isDock ? 0 : 20, scale: isDock ? 1 : 0.95 }}
				transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
			>
				<div
					className={cn(
						LIVE_VOICE_HEADER,
						isDock ? 'cursor-default' : 'cursor-move'
					)}
					data-drag-header
					{...(!isDock && onMouseDown
						? {
								role: 'button' as const,
								tabIndex: 0,
								'aria-label': t('dragPanel'),
								onMouseDown,
								onKeyDown: (e: React.KeyboardEvent) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
									}
								},
							}
						: {})}
				>
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<div className={LIVE_VOICE_ICON_BADGE} aria-hidden>
							<MicrophoneIcon width={18} height={18} strokeWidth={1.5} />
						</div>
						<div className="min-w-0 flex-1">
							<h2 className="truncate font-sans text-base font-semibold tracking-tight text-(--desktop-text-primary)">
								{t('title')}
							</h2>
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-0.5 truncate',
									!isConnected
										? 'text-(--desktop-text-primary)'
										: 'text-(--desktop-text-muted)'
								)}
							>
								<span
									className={cn(
										'mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle',
										isConnected
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.85)]'
											: 'animate-pulse bg-[color-mix(in_srgb,rgb(239_68_68)_70%,transparent)]'
									)}
									aria-hidden
								/>
								{statusLabel}
							</p>
						</div>
						{onToggleActive ? (
							<DesktopChromeTooltip
								content={
									isActive
										? t('powerOff')
										: isConnected
											? t('powerOn')
											: t('powerOnConnect')
								}
								placement="bottom"
								offsetExtra={4}
							>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onToggleActive(!isActive);
									}}
									onMouseDown={(e) => e.stopPropagation()}
									className={cn(
										LIVE_VOICE_POWER_TRACK,
										isActive
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.65)]'
											: 'bg-(--desktop-surface-soft-active)'
									)}
									aria-pressed={isActive}
									aria-label={isActive ? t('powerOff') : t('powerOn')}
								>
									<span
										className={cn(
											'inline-block h-4 w-4 transform rounded-full bg-(--desktop-text-primary) shadow-sm transition-transform duration-200',
											isActive ? 'translate-x-6' : 'translate-x-1'
										)}
									/>
									<PowerIcon
										width={12}
										height={12}
										className={cn(
											'absolute left-1.5',
											isActive
												? 'text-(--desktop-text-primary)'
												: 'text-(--desktop-text-muted)'
										)}
										strokeWidth={1.35}
									/>
								</button>
							</DesktopChromeTooltip>
						) : null}
					</div>
					<DesktopChromeTooltip
						content={t('closePanel')}
						placement="bottom"
						offsetExtra={4}
					>
						<button
							type="button"
							onClick={onClose}
							onMouseDown={(e) => e.stopPropagation()}
							className={LIVE_VOICE_ICON_BUTTON}
							aria-label={t('closePanel')}
							aria-expanded
						>
							<XMarkIcon
								width={20}
								height={20}
								strokeWidth={1.35}
								className="text-(--desktop-text-muted)"
							/>
						</button>
					</DesktopChromeTooltip>
				</div>

				<div
					role="tablist"
					aria-label={t('tabsAria')}
					className={LIVE_VOICE_TABLIST}
				>
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const tabSelected = activeTab === tab.id;
						return (
							<button
								type="button"
								role="tab"
								aria-selected={tabSelected}
								id={`live-voice-tab-${tab.id}`}
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									LIVE_VOICE_TAB,
									tabSelected
										? 'text-(--desktop-text-primary)'
										: 'text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)'
								)}
							>
								<Icon width={16} height={16} strokeWidth={1.35} />
								<span className="hidden sm:inline">{tab.label}</span>
								{tabSelected ? (
									<motion.div
										className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.75)]"
										layoutId="liveVoiceActiveTab"
										initial={false}
										transition={{
											type: 'spring',
											stiffness: 300,
											damping: 30,
										}}
									/>
								) : null}
							</button>
						);
					})}
				</div>

				<div
					className={cn(LIVE_VOICE_BODY, isDock ? 'px-4 py-4 sm:px-5' : 'p-5')}
				>
					<AnimatePresence mode="wait">
						{activeTab === 'record' && (
							<motion.div
								key="record"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.2 }}
								className="flex min-h-full flex-col gap-4"
							>
								{!hasTurn && !safeError ? (
									<div className={LIVE_VOICE_RECORD_HERO}>
										<RecordingButton
											isRecording={isRecording}
											onClick={onRecordingClick}
											audioLevel={audioLevel}
										/>
										<p
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'max-w-[18rem] leading-relaxed text-(--desktop-text-muted)'
											)}
										>
											{!isActive ? t('enableFirstHint') : t('emptyHint')}
										</p>
									</div>
								) : (
									<>
										<div className="flex justify-center py-2">
											<RecordingButton
												isRecording={isRecording}
												onClick={onRecordingClick}
												audioLevel={audioLevel}
											/>
										</div>
										{transcription ? (
											<div className={LIVE_VOICE_TURN_CARD}>
												<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-1')}>
													{t('youSaid')}
												</p>
												<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
													{transcription}
												</p>
											</div>
										) : null}
										{aiResponse ? (
											<div className={LIVE_VOICE_TURN_CARD}>
												<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-1')}>
													{t('reply')}
												</p>
												<p className="text-sm leading-relaxed text-(--desktop-text-primary)">
													{aiResponse}
												</p>
											</div>
										) : null}
									</>
								)}

								{showPipeline ? (
									<PipelineStatus
										currentStage={pipelineStage}
										progress={_pipelineProgress}
									/>
								) : null}

								{safeError ? (
									<div className="rounded-(--desktop-radius) border border-[color-mix(in_srgb,rgb(239_68_68)_35%,transparent)] bg-[color-mix(in_srgb,rgb(127_29_29)_40%,rgb(var(--desktop-bg-secondary-rgb)/1))] p-3">
										<p className="text-sm text-(--desktop-text-primary)">
											{safeError.message}
										</p>
										{onReset ? (
											<button
												type="button"
												onClick={onReset}
												className="mt-2 text-xs text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)"
											>
												{t('reset')}
											</button>
										) : null}
									</div>
								) : null}

								{isPlaying && onStopPlayback ? (
									<button
										type="button"
										onClick={onStopPlayback}
										className="flex w-full items-center justify-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-[rgb(var(--desktop-bg-secondary-rgb)/1)] px-4 py-2.5 text-sm font-medium text-(--desktop-text-primary) transition-colors duration-200 hover:bg-(--desktop-surface-soft-hover)"
									>
										<Square2StackIcon width={16} height={16} />
										{t('stopPlayback')}
									</button>
								) : null}
							</motion.div>
						)}

						{activeTab === 'text' && (
							<motion.div
								key="text"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.2 }}
							>
								<TextToVoicePanel />
							</motion.div>
						)}

						{activeTab === 'settings' && (
							<motion.div
								key="settings"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.2 }}
							>
								<VoiceSettings />
							</motion.div>
						)}

						{activeTab === 'history' && (
							<motion.div
								key="history"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.2 }}
							>
								<ConversationHistory userId={user?.id} />
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{!isConnected ? (
					<div className={LIVE_VOICE_FOOTER}>
						<p className="text-xs text-(--desktop-text-secondary)">
							{t('statusOffline')}
						</p>
					</div>
				) : null}
			</motion.div>
		);
	}
);
