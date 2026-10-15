/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator **advanced / debug** surface for EWA desktop orchestration: raw observation JSON, shell hints editor,
 * last envelope dump, and streamed journal text — hidden behind a toggle in `EwaDesktopView`.
 *
 * Invariants:
 * - Wire shapes follow `OBSERVATION-CATALOG.md` / `DESKTOP-ORCHESTRATION.md`; labels may use technical vocabulary (`advanced.*` i18n keys).
 * - Does not perform HTTP itself — callbacks invoke parent handlers that call desktop + orchestration APIs.
 *
 * Related:
 * - src/features/ewa/EwaDesktopView.tsx
 * - shared/api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
 */
import type { EwaDesktopOrchTurnResponseEnvelope } from '@/services/ewa/ewaDesktopOrchApi';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	SignalIcon,
	StopCircleIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

const OBS_PRESETS: Record<string, Record<string, unknown>> = {
	window_list_snapshot: {
		observation_kind: 'window_list_snapshot',
		windows: [],
	},
	active_app_changed: {
		observation_kind: 'active_app_changed',
		app_component: 'MarketingCabinet',
		window_id: 'preview-window',
	},
	user_cancelled: {
		observation_kind: 'user_cancelled',
		reason: 'operator_preview',
	},
	intent_execution_failed: {
		observation_kind: 'intent_execution_failed',
		intent_kind: 'noop',
		reason: 'demo',
		detail: {},
	},
};

/** Exported for `EwaDesktopView` default observation seed JSON. */
export const EWA_DESKTOP_OBS_PRESETS = OBS_PRESETS;

export type ObservationBuilderKind = keyof typeof OBS_PRESETS;

export function EwaDesktopAdvancedDebugPanel({
	t,
	sessionId,
	onSessionIdChange,
	turnIsPending,
	shellBusy,
	hintsBusy,
	sseBusy,
	sseLive,
	sseLog,
	lastResponseJson,
	lastEnvelope,
	observationJson,
	setObservationJson,
	hintsJson,
	setHintsJson,
	hintDocCount,
	setHintDocCount,
	hintDocId,
	setHintDocId,
	hintContentRoot,
	setHintContentRoot,
	observationBuilderKind,
	setObservationBuilderKind,
	builderAppComponent,
	setBuilderAppComponent,
	builderWindowId,
	setBuilderWindowId,
	builderReason,
	setBuilderReason,
	builderIntentKind,
	setBuilderIntentKind,
	onApplyPreset,
	onApplyHintsBuilder,
	onLoadShellHints,
	onSaveShellHints,
	onApplyObservationBuilder,
	onFillWindowsFromShell,
	onFillFocusFromShell,
	onPrefillIntentFailedFromLastTurn,
	onSendTurn,
	onSseSnapshot,
	onSseLiveToggle,
}: {
	t: TFunction<'marketing', undefined>;
	sessionId: string;
	onSessionIdChange: (next: string) => void;
	turnIsPending: boolean;
	shellBusy: boolean;
	hintsBusy: boolean;
	sseBusy: boolean;
	sseLive: boolean;
	sseLog: string;
	lastResponseJson: string | null;
	lastEnvelope: EwaDesktopOrchTurnResponseEnvelope | null;
	observationJson: string;
	setObservationJson: (next: string) => void;
	hintsJson: string;
	setHintsJson: (next: string) => void;
	hintDocCount: string;
	setHintDocCount: (next: string) => void;
	hintDocId: string;
	setHintDocId: (next: string) => void;
	hintContentRoot: string;
	setHintContentRoot: (next: string) => void;
	observationBuilderKind: ObservationBuilderKind;
	setObservationBuilderKind: (next: ObservationBuilderKind) => void;
	builderAppComponent: string;
	setBuilderAppComponent: (next: string) => void;
	builderWindowId: string;
	setBuilderWindowId: (next: string) => void;
	builderReason: string;
	setBuilderReason: (next: string) => void;
	builderIntentKind: string;
	setBuilderIntentKind: (next: string) => void;
	onApplyPreset: (key: ObservationBuilderKind) => void;
	onApplyHintsBuilder: () => void;
	onLoadShellHints: () => void;
	onSaveShellHints: () => void;
	onApplyObservationBuilder: () => void;
	onFillWindowsFromShell: () => void;
	onFillFocusFromShell: () => void;
	onPrefillIntentFailedFromLastTurn: () => void;
	onSendTurn: () => void;
	onSseSnapshot: () => void;
	onSseLiveToggle: () => void;
}) {
	return (
		<div className="mt-4 space-y-4 border-t border-(--desktop-border-subtle) pt-4">
			<p
				className={cn(
					DESKTOP_TYPOGRAPHY.caption,
					'text-(--desktop-text-secondary)'
				)}
			>
				{t('ewaDesktop.advanced.sectionIntro')}
			</p>

			<div className="shrink-0 space-y-2">
				<DesktopAppSectionLabel>
					{t('ewaDesktop.sessionLabel')}
				</DesktopAppSectionLabel>
				<div className="flex flex-wrap items-center gap-2">
					<input
						type="text"
						autoComplete="off"
						spellCheck={false}
						value={sessionId}
						onChange={(e) => onSessionIdChange(e.target.value)}
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.searchField,
							DESKTOP_CHROME_FOCUS_VISIBLE,
							'min-w-[min(100%,18rem)] flex-1 font-mono text-xs opacity-90'
						)}
						aria-label={t('ewaDesktop.sessionInputAria')}
					/>
				</div>
			</div>

			<div className="shrink-0 space-y-2 border-t border-(--desktop-border-subtle) pt-3">
				<DesktopAppSectionLabel>
					{t('ewaDesktop.shellHintsLabel')}
				</DesktopAppSectionLabel>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-(--desktop-text-secondary)'
					)}
				>
					{t('ewaDesktop.shellHintsHint')}
				</p>
				<div className="grid gap-2 md:grid-cols-3">
					<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
						<span>{t('ewaDesktop.hintsDocCountLabel')}</span>
						<input
							type="number"
							min={0}
							value={hintDocCount}
							onChange={(e) => setHintDocCount(e.target.value)}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.searchField,
								DESKTOP_CHROME_FOCUS_VISIBLE,
								'w-full font-mono text-xs'
							)}
						/>
					</label>
					<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
						<span>{t('ewaDesktop.hintsDocIdLabel')}</span>
						<input
							type="text"
							value={hintDocId}
							onChange={(e) => setHintDocId(e.target.value)}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.searchField,
								DESKTOP_CHROME_FOCUS_VISIBLE,
								'w-full font-mono text-xs'
							)}
						/>
					</label>
					<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
						<span>{t('ewaDesktop.hintsContentRootLabel')}</span>
						<input
							type="text"
							value={hintContentRoot}
							onChange={(e) => setHintContentRoot(e.target.value)}
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.searchField,
								DESKTOP_CHROME_FOCUS_VISIBLE,
								'w-full font-mono text-xs'
							)}
						/>
					</label>
				</div>
				<div className="flex flex-wrap gap-1">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="text-xs"
						onClick={onApplyHintsBuilder}
					>
						{t('ewaDesktop.hintsApplyBuilderButton')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="text-xs"
						disabled={hintsBusy || turnIsPending}
						onClick={() => void onLoadShellHints()}
					>
						{hintsBusy ? (
							<ArrowPathIcon
								className="mr-1 inline size-3 animate-spin"
								aria-hidden
							/>
						) : null}
						{t('ewaDesktop.shellHintsLoadButton')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="text-xs"
						disabled={hintsBusy || turnIsPending}
						onClick={() => void onSaveShellHints()}
					>
						{t('ewaDesktop.shellHintsSaveButton')}
					</DesktopAppButton>
				</div>
				<textarea
					value={hintsJson}
					onChange={(e) => setHintsJson(e.target.value)}
					rows={6}
					spellCheck={false}
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.searchField,
						DESKTOP_CHROME_FOCUS_VISIBLE,
						'min-h-24 w-full resize-y font-mono text-xs leading-relaxed'
					)}
					aria-label={t('ewaDesktop.shellHintsTextareaAria')}
				/>
			</div>

			<div className="flex min-h-0 flex-col gap-3 lg:flex-row">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
					<DesktopAppSectionLabel>
						{t('ewaDesktop.observationLabel')}
					</DesktopAppSectionLabel>
					<div
						className={cn(DESKTOP_APP_STYLE_CONTRACT.panel, 'space-y-2 p-3')}
					>
						<div className="grid gap-2 md:grid-cols-2">
							<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
								<span>{t('ewaDesktop.observationKindLabel')}</span>
								<select
									value={observationBuilderKind}
									onChange={(e) =>
										setObservationBuilderKind(
											e.target.value as ObservationBuilderKind
										)
									}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_CHROME_FOCUS_VISIBLE,
										'w-full font-mono text-xs'
									)}
								>
									{(Object.keys(OBS_PRESETS) as ObservationBuilderKind[]).map(
										(key) => (
											<option key={key} value={key}>
												{key}
											</option>
										)
									)}
								</select>
							</label>
							<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
								<span>{t('ewaDesktop.builderAppComponentLabel')}</span>
								<input
									type="text"
									value={builderAppComponent}
									disabled={observationBuilderKind !== 'active_app_changed'}
									onChange={(e) => setBuilderAppComponent(e.target.value)}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_CHROME_FOCUS_VISIBLE,
										'w-full font-mono text-xs disabled:opacity-50'
									)}
								/>
							</label>
							<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
								<span>{t('ewaDesktop.builderWindowIdLabel')}</span>
								<input
									type="text"
									value={builderWindowId}
									disabled={observationBuilderKind !== 'active_app_changed'}
									onChange={(e) => setBuilderWindowId(e.target.value)}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_CHROME_FOCUS_VISIBLE,
										'w-full font-mono text-xs disabled:opacity-50'
									)}
								/>
							</label>
							<label className="space-y-1 text-xs text-(--desktop-text-secondary)">
								<span>{t('ewaDesktop.builderIntentKindLabel')}</span>
								<input
									type="text"
									value={builderIntentKind}
									disabled={
										observationBuilderKind !== 'intent_execution_failed'
									}
									onChange={(e) => setBuilderIntentKind(e.target.value)}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_CHROME_FOCUS_VISIBLE,
										'w-full font-mono text-xs disabled:opacity-50'
									)}
								/>
							</label>
							<label className="space-y-1 text-xs text-(--desktop-text-secondary) md:col-span-2">
								<span>{t('ewaDesktop.builderReasonLabel')}</span>
								<input
									type="text"
									value={builderReason}
									disabled={
										observationBuilderKind !== 'user_cancelled' &&
										observationBuilderKind !== 'intent_execution_failed'
									}
									onChange={(e) => setBuilderReason(e.target.value)}
									className={cn(
										DESKTOP_APP_STYLE_CONTRACT.searchField,
										DESKTOP_CHROME_FOCUS_VISIBLE,
										'w-full font-mono text-xs disabled:opacity-50'
									)}
								/>
							</label>
						</div>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="text-xs"
							onClick={onApplyObservationBuilder}
						>
							{t('ewaDesktop.applyObservationBuilderButton')}
						</DesktopAppButton>
					</div>
					<div className="flex flex-wrap gap-1">
						{(
							[
								['window_list_snapshot', 'ewaDesktop.presetWindowSnapshot'],
								['active_app_changed', 'ewaDesktop.presetActiveApp'],
								['user_cancelled', 'ewaDesktop.presetUserCancelled'],
								['intent_execution_failed', 'ewaDesktop.presetIntentFailed'],
							] as const
						).map(([key, i18nKey]) => (
							<DesktopAppButton
								key={key}
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => onApplyPreset(key)}
							>
								{t(i18nKey)}
							</DesktopAppButton>
						))}
					</div>
					<div className="flex flex-wrap gap-1">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="text-xs"
							disabled={shellBusy || turnIsPending}
							onClick={() => void onFillWindowsFromShell()}
						>
							{shellBusy ? (
								<ArrowPathIcon
									className="mr-1 inline size-3 animate-spin"
									aria-hidden
								/>
							) : null}
							{t('ewaDesktop.fillFromDesktopWindows')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="text-xs"
							disabled={shellBusy || turnIsPending}
							onClick={() => void onFillFocusFromShell()}
						>
							{t('ewaDesktop.fillFromDesktopFocus')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="text-xs"
							disabled={!lastEnvelope}
							onClick={onPrefillIntentFailedFromLastTurn}
							aria-label={t('ewaDesktop.intentFailFromLastTurnAria')}
						>
							{t('ewaDesktop.intentFailFromLastTurnButton')}
						</DesktopAppButton>
					</div>
					<textarea
						value={observationJson}
						onChange={(e) => setObservationJson(e.target.value)}
						rows={14}
						spellCheck={false}
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.searchField,
							DESKTOP_CHROME_FOCUS_VISIBLE,
							'min-h-48 w-full resize-y font-mono text-xs leading-relaxed'
						)}
						aria-label={t('ewaDesktop.observationTextareaAria')}
					/>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						className="shrink-0 self-start gap-2"
						disabled={turnIsPending || !sessionId.trim()}
						onClick={() => void onSendTurn()}
						aria-label={t('ewaDesktop.sendTurnAria')}
					>
						{turnIsPending ? (
							<ArrowPathIcon className="size-4 animate-spin" aria-hidden />
						) : null}
						{t('ewaDesktop.sendTurnButton')}
					</DesktopAppButton>
				</div>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 border-t border-(--desktop-border-subtle) pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
						<DesktopAppSectionLabel>
							{t('ewaDesktop.lastResponseLabel')}
						</DesktopAppSectionLabel>
						{lastResponseJson ? (
							<pre
								className={cn(
									DESKTOP_APP_STYLE_CONTRACT.panel,
									'max-h-[min(40vh,20rem)] min-h-40 shrink-0 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-(--desktop-text-primary)'
								)}
							>
								{lastResponseJson}
							</pre>
						) : (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-secondary)'
								)}
							>
								{t('ewaDesktop.emptyResponseHint')}
							</p>
						)}
					</div>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
						<DesktopAppSectionLabel>
							{t('ewaDesktop.sseLogLabel')}
						</DesktopAppSectionLabel>
						<div className="flex flex-wrap gap-1">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="gap-1 text-xs"
								disabled={sseBusy || sseLive || !sessionId.trim()}
								onClick={() => void onSseSnapshot()}
								aria-label={t('ewaDesktop.sseLoadOnceAria')}
							>
								{sseBusy ? (
									<ArrowPathIcon className="size-4 animate-spin" aria-hidden />
								) : (
									<SignalIcon className="size-4" aria-hidden />
								)}
								{t('ewaDesktop.sseLoadOnceButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="gap-1 text-xs"
								disabled={sseBusy || !sessionId.trim()}
								onClick={() => void onSseLiveToggle()}
								aria-label={
									sseLive
										? t('ewaDesktop.sseLiveStopAria')
										: t('ewaDesktop.sseLiveStartAria')
								}
							>
								{sseLive ? (
									<StopCircleIcon className="size-4" aria-hidden />
								) : (
									<SignalIcon className="size-4" aria-hidden />
								)}
								{sseLive
									? t('ewaDesktop.sseLiveStopButton')
									: t('ewaDesktop.sseLiveStartButton')}
							</DesktopAppButton>
						</div>
						{sseLog ? (
							<pre
								className={cn(
									DESKTOP_APP_STYLE_CONTRACT.panel,
									'min-h-40 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-(--desktop-text-primary)'
								)}
							>
								{sseLog}
							</pre>
						) : (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-secondary)'
								)}
							>
								{t('ewaDesktop.sseEmptyHint')}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
