/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero picker and solo-slot purchase modals for Desktop AI Chat.
 *
 * Invariants:
 * - Focus trap for hero picker is owned by parent (useDesktopAiDialogFocusTrap).
 *
 * Related:
 * - DesktopAiChatApp.tsx, hooks/useDesktopAiChatList.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import type {
	DesktopAiMemoryCell,
	SoloSlotTariffsResponse,
	SoloSlotDurationHours,
} from '../api/desktopChatClient';
import {
	DESKTOP_ENSEMBLE_MAX_ROSTER,
	DESKTOP_ENSEMBLE_MIN_ROSTER,
	type DesktopAiHeroId,
	getDesktopAiHero,
} from '../desktopAiHeroes';
import { DesktopAiHeroCohortPickLists } from './DesktopAiHeroCohortPickLists';
import { useDesktopAiDialogFocusTrap } from '../useDesktopAiDialogFocusTrap';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_OVERLAY,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type DesktopAiChatModalsProps = {
	heroPickerOpen: boolean;
	heroDialogRef: React.RefObject<HTMLDivElement | null>;
	embeddedModalZ: { backdrop: number; content: number };
	soloSlotStackedModalZ: { backdrop: number; content: number };
	newChatKind: 'solo' | 'ensemble';
	setNewChatKind: (k: 'solo' | 'ensemble') => void;
	newChatSoloStep: 'pick' | 'confirm';
	setNewChatSoloStep: (s: 'pick' | 'confirm') => void;
	pickedHeroId: DesktopAiHeroId;
	setPickedHeroId: (id: DesktopAiHeroId) => void;
	ensembleSelectedIds: DesktopAiHeroId[];
	setEnsembleSelectedIds: React.Dispatch<
		React.SetStateAction<DesktopAiHeroId[]>
	>;
	toggleEnsembleHeroPick: (id: DesktopAiHeroId) => void;
	defaultEnsembleHeroIds: () => DesktopAiHeroId[];
	newChatSoloDuration: SoloSlotDurationHours;
	setNewChatSoloDuration: (h: SoloSlotDurationHours) => void;
	newChatSoloSelectedEnergy: number | null;
	newChatCreateBusy: boolean;
	soloSlotTariffs: SoloSlotTariffsResponse | null;
	ugsCreditsBalance: number | null;
	memoryCellsForPicker: DesktopAiMemoryCell[];
	pickedMemoryCellId: string | null;
	setPickedMemoryCellId: (id: string | null) => void;
	onCloseHeroPicker: () => void;
	onConfirmNewChat: () => void | Promise<void>;
	soloSlotModalOpen: boolean;
	activeId: string | null;
	soloSlotStep: 'pick' | 'confirm';
	setSoloSlotStep: (s: 'pick' | 'confirm') => void;
	soloSlotDuration: SoloSlotDurationHours;
	setSoloSlotDuration: (h: SoloSlotDurationHours) => void;
	soloSlotHeroPick: DesktopAiHeroId;
	setSoloSlotHeroPick: (id: DesktopAiHeroId) => void;
	soloSlotSelectedEnergy: number | null;
	soloSlotPurchaseBusy: boolean;
	onCloseSoloSlotModal: () => void;
	onPurchaseSoloSlot: () => void | Promise<void>;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatModals(props: DesktopAiChatModalsProps) {
	useDesktopAiDialogFocusTrap(props.heroDialogRef, props.heroPickerOpen);
	const {
		heroPickerOpen,
		heroDialogRef,
		embeddedModalZ,
		soloSlotStackedModalZ,
		newChatKind,
		setNewChatKind,
		newChatSoloStep,
		setNewChatSoloStep,
		pickedHeroId,
		setPickedHeroId,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		toggleEnsembleHeroPick,
		defaultEnsembleHeroIds,
		newChatSoloDuration,
		setNewChatSoloDuration,
		newChatSoloSelectedEnergy,
		newChatCreateBusy,
		soloSlotTariffs,
		ugsCreditsBalance,
		memoryCellsForPicker,
		pickedMemoryCellId,
		setPickedMemoryCellId,
		onCloseHeroPicker,
		onConfirmNewChat,
		soloSlotModalOpen,
		activeId,
		soloSlotStep,
		setSoloSlotStep,
		soloSlotDuration,
		setSoloSlotDuration,
		soloSlotHeroPick,
		setSoloSlotHeroPick,
		soloSlotSelectedEnergy,
		soloSlotPurchaseBusy,
		onCloseSoloSlotModal,
		onPurchaseSoloSlot,
		lucideStroke,
		t,
	} = props;

	return (
		<>
			{heroPickerOpen ? (
				<div
					className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
					style={{ zIndex: embeddedModalZ.backdrop }}
				>
					<button
						type="button"
						className={cn(
							'pointer-events-auto absolute inset-0',
							DESKTOP_OVERLAY.backdrop
						)}
						aria-label={t('heroPickerCloseAria')}
						onClick={() => onCloseHeroPicker()}
					/>
					<div
						ref={heroDialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="hero-picker-title"
						tabIndex={-1}
						style={{ zIndex: embeddedModalZ.content }}
						className={`relative flex min-h-0 w-full max-w-lg max-h-[min(90dvh,calc(100vh-3rem))] flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_92%,#0a0520)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] p-5 pointer-events-auto outline-none text-(--desktop-text-primary) ${DESKTOP_SURFACE.radiusLg}`}
					>
						<h2
							id="hero-picker-title"
							className={cn('mb-1 shrink-0', DESKTOP_TYPOGRAPHY.subtitle)}
						>
							{t('heroPickerNewChat')}
						</h2>
						<p className={cn('mb-3 shrink-0', DESKTOP_TYPOGRAPHY.bodyMuted)}>
							{t('heroPickerIntro')}
						</p>
						<div className="flex shrink-0 gap-2 mb-4">
							<button
								type="button"
								onClick={() => {
									setNewChatKind('solo');
									setNewChatSoloStep('pick');
								}}
								className={[
									'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition',
									newChatKind === 'solo'
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-white'
										: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] text-(--desktop-text-secondary) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
								].join(' ')}
							>
								{t('heroPickerSolo')}
							</button>
							<button
								type="button"
								onClick={() => {
									setNewChatKind('ensemble');
									setEnsembleSelectedIds(defaultEnsembleHeroIds());
								}}
								className={[
									'flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition',
									newChatKind === 'ensemble'
										? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-white'
										: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] text-(--desktop-text-secondary) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)]',
								].join(' ')}
							>
								{t('heroPickerEnsemble')}
							</button>
						</div>
						{newChatKind === 'solo' ? (
							newChatSoloStep === 'confirm' ? (
								<p
									className={cn('mb-4 shrink-0', DESKTOP_TYPOGRAPHY.bodyMuted)}
								>
									{t('heroPickerSoloConfirmLead')}
								</p>
							) : (
								<>
									<p
										className={cn(
											'mb-3 shrink-0',
											DESKTOP_TYPOGRAPHY.bodyMuted
										)}
									>
										{t('heroPickerSoloHint')}
									</p>
									<div className="flex flex-wrap gap-2 mb-2 shrink-0">
										{([1, 2, 12] as const).map((hours) => {
											const energy =
												soloSlotTariffs?.by_hero[pickedHeroId]?.[
													String(hours) as '1' | '2' | '12'
												];
											const label =
												energy != null
													? t('soloSlotDurationHoursEnergy', {
															hours,
															energy,
														})
													: t('soloSlotDurationHoursPending', { hours });
											return (
												<button
													key={hours}
													type="button"
													onClick={() => setNewChatSoloDuration(hours)}
													className={[
														'rounded-lg border px-3 py-2 text-xs font-medium transition',
														newChatSoloDuration === hours
															? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-white'
															: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] text-(--desktop-text-secondary)',
													].join(' ')}
												>
													{label}
												</button>
											);
										})}
									</div>
									<p
										className={cn(
											'mb-3 shrink-0 text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro
										)}
									>
										{t('soloSlot12hDiscountNote')}
									</p>
									{ugsCreditsBalance != null ? (
										<p
											className={cn(
												'mb-3 shrink-0 text-(--desktop-text-muted)',
												DESKTOP_TYPOGRAPHY.micro
											)}
										>
											{t('soloUgsCreditsBalance', {
												balance: ugsCreditsBalance,
											})}
										</p>
									) : null}
								</>
							)
						) : (
							<p className={cn('mb-4 shrink-0', DESKTOP_TYPOGRAPHY.bodyMuted)}>
								{t('heroPickerEnsembleHint', {
									min: DESKTOP_ENSEMBLE_MIN_ROSTER,
									max: DESKTOP_ENSEMBLE_MAX_ROSTER,
								})}
							</p>
						)}
						{memoryCellsForPicker.length > 0 &&
						!(newChatKind === 'solo' && newChatSoloStep === 'confirm') ? (
							<label className="mb-3 block shrink-0 space-y-1">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t('memoryCellPickerLabel')}
								</span>
								<select
									value={pickedMemoryCellId ?? ''}
									onChange={(e) => {
										const v = e.target.value;
										setPickedMemoryCellId(v ? v : null);
									}}
									className="w-full appearance-none rounded-xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] px-3 py-2 text-sm text-(--desktop-text-primary)"
								>
									<option value="">{t('memoryCellPickerNone')}</option>
									{memoryCellsForPicker.map((cell) => (
										<option key={cell.id} value={cell.id}>
											{cell.title}
										</option>
									))}
								</select>
								<span
									className={cn(
										'block text-(--desktop-text-muted)',
										DESKTOP_TYPOGRAPHY.micro
									)}
								>
									{t('memoryCellPickerHint')}
								</span>
							</label>
						) : null}
						<div
							className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 ${newChatKind === 'ensemble' ? '' : 'hidden'}`}
						>
							<p className={DESKTOP_TYPOGRAPHY.caption}>
								{t('heroPickerSelected', {
									n: ensembleSelectedIds.length,
									max: DESKTOP_ENSEMBLE_MAX_ROSTER,
								})}
							</p>
							<DesktopAiHeroCohortPickLists
								t={t}
								mode="ensemble"
								selectedEnsembleIds={ensembleSelectedIds}
								onToggleEnsemble={toggleEnsembleHeroPick}
							/>
						</div>
						<div
							className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 ${
								newChatKind === 'ensemble' ||
								(newChatKind === 'solo' && newChatSoloStep === 'confirm')
									? 'hidden'
									: ''
							}`}
						>
							<DesktopAiHeroCohortPickLists
								t={t}
								mode="solo"
								selectedSoloId={pickedHeroId}
								onPickSolo={setPickedHeroId}
							/>
						</div>
						{newChatKind === 'solo' && newChatSoloStep === 'confirm' ? (
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
								<div className="rounded-xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] p-4 space-y-2">
									<p
										className={cn('leading-snug', DESKTOP_TYPOGRAPHY.bodyMuted)}
									>
										{t('soloSlotNewChatConfirmSummary', {
											hero:
												getDesktopAiHero(pickedHeroId)?.label ?? pickedHeroId,
											hours: newChatSoloDuration,
											energy: newChatSoloSelectedEnergy ?? '—',
										})}
									</p>
									<p
										className={cn(
											'leading-snug text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro
										)}
									>
										{pickedMemoryCellId
											? t('memoryCellPickerConfirmAttached', {
													title:
														memoryCellsForPicker.find(
															(c) => c.id === pickedMemoryCellId
														)?.title ?? pickedMemoryCellId,
												})
											: t('memoryCellPickerConfirmNone')}
									</p>
								</div>
							</div>
						) : null}
						<div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									if (newChatKind === 'solo' && newChatSoloStep === 'confirm') {
										setNewChatSoloStep('pick');
									} else {
										onCloseHeroPicker();
										setNewChatSoloStep('pick');
									}
								}}
								disabled={newChatCreateBusy}
								className={`rounded-xl px-4 py-2 text-sm border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45`}
							>
								{t('cancel')}
							</button>
							{newChatKind === 'solo' && newChatSoloStep === 'confirm' ? (
								<button
									type="button"
									onClick={() => setNewChatSoloStep('pick')}
									disabled={newChatCreateBusy}
									className={`rounded-xl px-4 py-2 text-sm border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45`}
								>
									{t('soloSlotConfirmBack')}
								</button>
							) : null}
							<button
								type="button"
								onClick={() => void onConfirmNewChat()}
								disabled={
									newChatCreateBusy ||
									(newChatKind === 'ensemble' &&
										ensembleSelectedIds.length < DESKTOP_ENSEMBLE_MIN_ROSTER) ||
									(newChatKind === 'solo' &&
										newChatSoloStep === 'pick' &&
										newChatSoloSelectedEnergy == null)
								}
								className={`rounded-xl px-4 py-2 text-sm bg-[rgb(var(--desktop-accent-rgb)/0.9)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] text-white hover:brightness-110 active:brightness-95 ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45 disabled:pointer-events-none inline-flex items-center gap-2`}
							>
								{newChatCreateBusy ? (
									<ArrowPathIcon
										className="h-4 w-4 animate-spin motion-reduce:animate-none"
										strokeWidth={lucideStroke}
									/>
								) : null}
								{newChatKind === 'ensemble'
									? t('createGroup')
									: newChatSoloStep === 'confirm'
										? t('soloSlotNewChatConfirmCta', {
												energy: newChatSoloSelectedEnergy ?? '—',
											})
										: t('heroPickerSoloNext')}
							</button>
						</div>
					</div>
				</div>
			) : null}
			{soloSlotModalOpen && activeId ? (
				<div
					className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
					style={{ zIndex: soloSlotStackedModalZ.backdrop }}
				>
					<button
						type="button"
						className={cn(
							'pointer-events-auto absolute inset-0',
							DESKTOP_OVERLAY.backdrop
						)}
						aria-label={t('soloSlotModalCloseAria')}
						onClick={() => {
							if (!soloSlotPurchaseBusy) {
								onCloseSoloSlotModal();
								setSoloSlotStep('pick');
							}
						}}
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="solo-slot-title"
						style={{ zIndex: soloSlotStackedModalZ.content }}
						className={`relative flex min-h-0 w-full max-w-lg max-h-[min(90dvh,calc(100vh-3rem))] flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)] bg-[color-mix(in_srgb,var(--glass-bg-strong)_92%,#0a0520)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] p-5 pointer-events-auto outline-none text-(--desktop-text-primary) ${DESKTOP_SURFACE.radiusLg}`}
					>
						<h2
							id="solo-slot-title"
							className={cn('mb-2 shrink-0', DESKTOP_TYPOGRAPHY.subtitle)}
						>
							{soloSlotStep === 'pick'
								? t('soloSlotModalTitle')
								: t('soloSlotModalConfirmTitle')}
						</h2>
						{soloSlotStep === 'pick' ? (
							<>
								<p
									className={cn('mb-2 shrink-0', DESKTOP_TYPOGRAPHY.bodyMuted)}
								>
									{t('soloSlotModalIntro')}
								</p>
								<p
									className={cn(
										'mb-3 shrink-0 text-(--desktop-text-muted)',
										DESKTOP_TYPOGRAPHY.micro
									)}
								>
									{t('soloSlot12hDiscountNote')}
								</p>
								<div className="flex flex-wrap gap-2 mb-3 shrink-0">
									{([1, 2, 12] as const).map((hours) => {
										const energy =
											soloSlotTariffs?.by_hero[soloSlotHeroPick]?.[
												String(hours) as '1' | '2' | '12'
											];
										const label =
											energy != null
												? t('soloSlotDurationHoursEnergy', {
														hours,
														energy,
													})
												: t('soloSlotDurationHoursPending', { hours });
										return (
											<button
												key={hours}
												type="button"
												onClick={() => setSoloSlotDuration(hours)}
												className={[
													'rounded-lg border px-3 py-2 text-xs font-medium transition',
													soloSlotDuration === hours
														? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-white'
														: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] text-(--desktop-text-secondary)',
												].join(' ')}
											>
												{label}
											</button>
										);
									})}
								</div>
								<p
									className={cn(
										'mb-2 shrink-0',
										DESKTOP_TYPOGRAPHY.captionInherit
									)}
								>
									{t('soloSlotHeroLabel')}
								</p>
								{ugsCreditsBalance != null ? (
									<p
										className={cn(
											'mb-2 shrink-0 text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro
										)}
									>
										{t('soloUgsCreditsBalance', {
											balance: ugsCreditsBalance,
										})}
									</p>
								) : null}
								<div className="min-h-0 flex-1 max-h-[min(40vh,320px)] space-y-2 overflow-y-auto overscroll-y-contain pr-1 mb-3">
									<DesktopAiHeroCohortPickLists
										t={t}
										mode="solo"
										selectedSoloId={soloSlotHeroPick}
										onPickSolo={setSoloSlotHeroPick}
									/>
								</div>
								<div className="mt-2 flex shrink-0 flex-wrap justify-end gap-2">
									<button
										type="button"
										onClick={() => {
											onCloseSoloSlotModal();
											setSoloSlotStep('pick');
										}}
										disabled={soloSlotPurchaseBusy}
										className={`rounded-xl px-4 py-2 text-sm border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)] ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45`}
									>
										{t('cancel')}
									</button>
									<button
										type="button"
										onClick={() => {
											if (soloSlotSelectedEnergy == null) {
												toast.error(t('soloSlotTariffsLoadError'));
												return;
											}
											setSoloSlotStep('confirm');
										}}
										disabled={
											soloSlotPurchaseBusy || soloSlotSelectedEnergy == null
										}
										className={`rounded-xl px-4 py-2 text-sm bg-[rgb(var(--desktop-accent-rgb)/0.9)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] text-white hover:brightness-110 ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45 inline-flex items-center gap-2`}
									>
										{t('soloSlotNextToConfirm')}
									</button>
								</div>
							</>
						) : (
							<>
								<p
									className={cn(
										'mb-4 leading-snug',
										DESKTOP_TYPOGRAPHY.bodyMuted
									)}
								>
									{t('soloSlotConfirmChargeSummary', {
										energy: soloSlotSelectedEnergy ?? '—',
										hero:
											getDesktopAiHero(soloSlotHeroPick)?.label ??
											soloSlotHeroPick,
										hours: soloSlotDuration,
									})}
								</p>
								<div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
									<button
										type="button"
										onClick={() => setSoloSlotStep('pick')}
										disabled={soloSlotPurchaseBusy}
										className={`rounded-xl px-4 py-2 text-sm border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45`}
									>
										{t('soloSlotConfirmBack')}
									</button>
									<button
										type="button"
										onClick={() => void onPurchaseSoloSlot()}
										disabled={soloSlotPurchaseBusy}
										className={`rounded-xl px-4 py-2 text-sm bg-[rgb(var(--desktop-accent-rgb)/0.9)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] text-white hover:brightness-110 ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-45 inline-flex items-center gap-2`}
									>
										{soloSlotPurchaseBusy ? (
											<ArrowPathIcon
												className="h-4 w-4 animate-spin motion-reduce:animate-none"
												strokeWidth={lucideStroke}
											/>
										) : null}
										{soloSlotPurchaseBusy
											? t('soloSlotPurchasing')
											: soloSlotSelectedEnergy != null
												? t('soloSlotPurchaseWithEnergy', {
														energy: soloSlotSelectedEnergy,
													})
												: t('soloSlotPurchase')}
									</button>
								</div>
							</>
						)}
					</div>
				</div>
			) : null}
		</>
	);
}
