/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Solo-slot billing, hero picker new-chat flow, UGS credits, and consultant release for Desktop AI Chat.
 *
 * Invariants:
 * - Ensemble new chat requires at least one picked hero id before create.
 *
 * Related:
 * - components/DesktopAiChatModals.tsx, hooks/useDesktopAiChatList.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { toast } from 'sonner';
import { APIError } from '@/services/api/client';
import { getContentErrorMessage } from '@/services/contentApi';
import { fetchUgsBillingStats } from '@/services/api/ugs/billing';
import {
	createDesktopAiChat,
	fetchSoloSlotTariffs,
	listDesktopAiChats,
	listDesktopAiMemoryCells,
	purchaseDesktopAiSoloSlot,
	releaseDesktopAiSoloSlot,
	type DesktopAiChatItem,
	type DesktopAiMemoryCell,
	type SoloSlotDurationHours,
	type SoloSlotTariffsResponse,
} from '../api/desktopChatClient';
import {
	DESKTOP_AI_HEROES,
	DESKTOP_CHAT_MODE_ENSEMBLE,
	DESKTOP_ENSEMBLE_MIN_ROSTER,
	type DesktopAiHeroId,
} from '../desktopAiHeroes';
import { formatSoloSlotCountdown } from '../utils/desktopAiChatFormatters';

export type UseDesktopAiChatSoloSlotParams = {
	activeId: string | null;
	setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
	activeChat: DesktopAiChatItem | null;
	activeHeroId: string | null;
	soloCanReleaseConsultant: boolean;
	chats: DesktopAiChatItem[];
	setChats: React.Dispatch<React.SetStateAction<DesktopAiChatItem[]>>;
	setSoloSlotTariffs: React.Dispatch<
		React.SetStateAction<SoloSlotTariffsResponse | null>
	>;
	ensembleSelectedIds: DesktopAiHeroId[];
	setEnsembleSelectedIds: React.Dispatch<
		React.SetStateAction<DesktopAiHeroId[]>
	>;
	defaultEnsembleHeroIds: () => DesktopAiHeroId[];
	t: TFunction<'desktopAiChat'>;
};

export function useDesktopAiChatSoloSlot({
	activeId,
	setActiveId,
	activeChat,
	activeHeroId,
	soloCanReleaseConsultant,
	setChats,
	setSoloSlotTariffs,
	ensembleSelectedIds,
	setEnsembleSelectedIds,
	defaultEnsembleHeroIds,
	t,
}: UseDesktopAiChatSoloSlotParams) {
	const [heroPickerOpen, setHeroPickerOpen] = React.useState(false);
	const [soloSlotModalOpen, setSoloSlotModalOpen] = React.useState(false);
	const [soloSlotPurchaseBusy, setSoloSlotPurchaseBusy] = React.useState(false);
	const [soloSlotDuration, setSoloSlotDuration] =
		React.useState<SoloSlotDurationHours>(1);
	const [soloSlotHeroPick, setSoloSlotHeroPick] =
		React.useState<DesktopAiHeroId>(DESKTOP_AI_HEROES[0].id);
	const [ugsCreditsBalance, setUgsCreditsBalance] = React.useState<
		number | null
	>(null);
	const [newChatSoloDuration, setNewChatSoloDuration] =
		React.useState<SoloSlotDurationHours>(1);
	const [newChatSoloStep, setNewChatSoloStep] = React.useState<
		'pick' | 'confirm'
	>('pick');
	const [soloSlotStep, setSoloSlotStep] = React.useState<'pick' | 'confirm'>(
		'pick'
	);
	const [newChatCreateBusy, setNewChatCreateBusy] = React.useState(false);
	const [releaseConsultantBusy, setReleaseConsultantBusy] =
		React.useState(false);
	const [releaseConsultantModalOpen, setReleaseConsultantModalOpen] =
		React.useState(false);
	const [soloSlotCountdownLabel, setSoloSlotCountdownLabel] = React.useState<
		string | null
	>(null);
	const soloSlotExpiryRefreshRef = React.useRef(false);
	const [newChatKind, setNewChatKind] = React.useState<'solo' | 'ensemble'>(
		'solo'
	);
	const [pickedHeroId, setPickedHeroId] = React.useState<DesktopAiHeroId>(
		DESKTOP_AI_HEROES[0].id
	);
	const [pickedMemoryCellId, setPickedMemoryCellId] = React.useState<
		string | null
	>(null);
	const [memoryCellsForPicker, setMemoryCellsForPicker] = React.useState<
		DesktopAiMemoryCell[]
	>([]);
	const [soloSlotTariffs, setLocalSoloSlotTariffs] =
		React.useState<SoloSlotTariffsResponse | null>(null);
	const heroDialogRef = React.useRef<HTMLDivElement>(null);

	const refreshUgsCredits = React.useCallback(async () => {
		try {
			const s = await fetchUgsBillingStats();
			setUgsCreditsBalance(
				s != null && typeof s.available_credits === 'number'
					? Math.floor(s.available_credits)
					: null
			);
		} catch {
			setUgsCreditsBalance(null);
		}
	}, []);

	React.useEffect(() => {
		if (!soloSlotModalOpen) {
			return;
		}
		if (activeHeroId) {
			setSoloSlotHeroPick(activeHeroId as DesktopAiHeroId);
		}
	}, [soloSlotModalOpen, activeHeroId]);

	React.useEffect(() => {
		if (!soloSlotModalOpen && !heroPickerOpen) {
			return;
		}
		let cancelled = false;
		void fetchSoloSlotTariffs()
			.then((data) => {
				if (!cancelled) {
					setLocalSoloSlotTariffs(data);
					setSoloSlotTariffs(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLocalSoloSlotTariffs(null);
					setSoloSlotTariffs(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [soloSlotModalOpen, heroPickerOpen, setSoloSlotTariffs]);

	const soloSlotSelectedEnergy = React.useMemo(() => {
		const row = soloSlotTariffs?.by_hero[soloSlotHeroPick];
		if (!row) {
			return null;
		}
		const k = String(soloSlotDuration) as '1' | '2' | '12';
		return row[k] ?? null;
	}, [soloSlotTariffs, soloSlotHeroPick, soloSlotDuration]);

	const newChatSoloSelectedEnergy = React.useMemo(() => {
		const row = soloSlotTariffs?.by_hero[pickedHeroId];
		if (!row) {
			return null;
		}
		const k = String(newChatSoloDuration) as '1' | '2' | '12';
		return row[k] ?? null;
	}, [soloSlotTariffs, pickedHeroId, newChatSoloDuration]);

	React.useEffect(() => {
		if (!soloSlotModalOpen) {
			return;
		}
		setSoloSlotStep('pick');
		void refreshUgsCredits();
	}, [soloSlotModalOpen, refreshUgsCredits]);

	React.useEffect(() => {
		if (!heroPickerOpen) {
			return;
		}
		void refreshUgsCredits();
	}, [heroPickerOpen, refreshUgsCredits]);

	React.useEffect(() => {
		soloSlotExpiryRefreshRef.current = false;
		if (!activeChat?.solo_slot_active || !activeChat.solo_slot_ends_at) {
			setSoloSlotCountdownLabel(null);
			return;
		}
		const endsAt = activeChat.solo_slot_ends_at;
		const tick = () => {
			setSoloSlotCountdownLabel(formatSoloSlotCountdown(endsAt));
			const endMs = Date.parse(endsAt);
			if (
				!Number.isNaN(endMs) &&
				endMs - Date.now() <= 0 &&
				!soloSlotExpiryRefreshRef.current
			) {
				soloSlotExpiryRefreshRef.current = true;
				void listDesktopAiChats()
					.then((items) => setChats(items))
					.catch(() => {
						/* keep local */
					});
			}
		};
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [activeChat?.solo_slot_active, activeChat?.solo_slot_ends_at, setChats]);

	React.useEffect(() => {
		if (!heroPickerOpen) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setHeroPickerOpen(false);
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [heroPickerOpen]);

	const openHeroPicker = React.useCallback(() => {
		setNewChatKind('solo');
		setPickedHeroId(DESKTOP_AI_HEROES[0].id);
		setPickedMemoryCellId(null);
		setNewChatSoloDuration(1);
		setNewChatSoloStep('pick');
		setEnsembleSelectedIds(defaultEnsembleHeroIds());
		setHeroPickerOpen(true);
		void listDesktopAiMemoryCells()
			.then((items) => {
				const ready = items.filter((c) => c.status === 'ready');
				setMemoryCellsForPicker(ready);
				setPickedMemoryCellId((prev) =>
					prev && ready.some((c) => c.id === prev) ? prev : null
				);
			})
			.catch(() => {
				setMemoryCellsForPicker([]);
			});
	}, [defaultEnsembleHeroIds, setEnsembleSelectedIds]);

	const confirmNewChatWithHero = React.useCallback(async () => {
		const attachCellId =
			pickedMemoryCellId &&
			memoryCellsForPicker.some((c) => c.id === pickedMemoryCellId)
				? pickedMemoryCellId
				: null;
		if (newChatKind === 'ensemble') {
			if (ensembleSelectedIds.length < DESKTOP_ENSEMBLE_MIN_ROSTER) {
				toast.error(
					t('ensembleMinRosterToast', { min: DESKTOP_ENSEMBLE_MIN_ROSTER })
				);
				return;
			}
			setHeroPickerOpen(false);
			try {
				const c = await createDesktopAiChat({
					title: t('newChatTitleEnsemble'),
					memory_cell_id: attachCellId,
					settings: {
						desktop_chat_mode: DESKTOP_CHAT_MODE_ENSEMBLE,
						desktop_ensemble_all: false,
						desktop_ensemble_ids: [...ensembleSelectedIds],
					},
				});
				setChats((prev) => [c, ...prev]);
				setActiveId(c.id);
			} catch (e) {
				if (
					e instanceof APIError &&
					(e.statusCode === 403 || e.statusCode === 400) &&
					typeof e.message === 'string' &&
					e.message.includes('marketing_cabinet_required_for_group_chat')
				) {
					toast.error(t('marketingCabinetRequiredForGroupChat'));
				}
				setHeroPickerOpen(true);
			}
			return;
		}
		const hero = DESKTOP_AI_HEROES.find((h) => h.id === pickedHeroId);
		if (!hero) {
			return;
		}
		if (newChatSoloStep === 'pick') {
			if (newChatSoloSelectedEnergy == null) {
				toast.error(t('soloSlotTariffsLoadError'));
				return;
			}
			setNewChatSoloStep('confirm');
			return;
		}
		if (newChatSoloSelectedEnergy == null) {
			toast.error(t('soloSlotTariffsLoadError'));
			return;
		}
		setNewChatCreateBusy(true);
		try {
			const c = await createDesktopAiChat({
				title: hero.defaultChatTitle,
				memory_cell_id: attachCellId,
				settings: { desktop_hero_id: hero.id },
			});
			setChats((prev) => [c, ...prev]);
			setActiveId(c.id);
			const updated = await purchaseDesktopAiSoloSlot(c.id, {
				duration_hours: newChatSoloDuration,
				hero_id: pickedHeroId,
			});
			setChats((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
			setHeroPickerOpen(false);
			setNewChatSoloStep('pick');
			toast.success(t('soloSlotPurchasedToast'));
			void refreshUgsCredits();
		} catch (e) {
			if (e instanceof APIError && e.statusCode === 402) {
				toast.error(t('soloSlotInsufficientCredits'));
			} else {
				toast.error(getContentErrorMessage(e) ?? t('soloSlotPurchaseFailed'));
			}
		} finally {
			setNewChatCreateBusy(false);
		}
	}, [
		newChatKind,
		ensembleSelectedIds,
		t,
		setChats,
		setActiveId,
		pickedHeroId,
		pickedMemoryCellId,
		memoryCellsForPicker,
		newChatSoloStep,
		newChatSoloSelectedEnergy,
		newChatSoloDuration,
		refreshUgsCredits,
	]);

	const purchaseSoloSlot = React.useCallback(async () => {
		if (!activeId) {
			return;
		}
		setSoloSlotPurchaseBusy(true);
		try {
			const updated = await purchaseDesktopAiSoloSlot(activeId, {
				duration_hours: soloSlotDuration,
				hero_id: soloSlotHeroPick,
			});
			setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
			setSoloSlotModalOpen(false);
			setSoloSlotStep('pick');
			toast.success(t('soloSlotPurchasedToast'));
			void refreshUgsCredits();
		} catch (e) {
			if (e instanceof APIError && e.statusCode === 402) {
				toast.error(t('soloSlotInsufficientCredits'));
			} else {
				toast.error(getContentErrorMessage(e) ?? t('soloSlotPurchaseFailed'));
			}
		} finally {
			setSoloSlotPurchaseBusy(false);
		}
	}, [
		activeId,
		soloSlotDuration,
		soloSlotHeroPick,
		t,
		refreshUgsCredits,
		setChats,
	]);

	const performReleaseConsultant = React.useCallback(async () => {
		if (!activeId || !soloCanReleaseConsultant) {
			return;
		}
		setReleaseConsultantBusy(true);
		try {
			const updated = await releaseDesktopAiSoloSlot(activeId);
			setChats((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
			toast.success(t('soloSlotReleasedToast'));
		} catch (e) {
			const msg = getContentErrorMessage(e) ?? t('soloSlotReleaseFailed');
			toast.error(msg);
			throw new Error(msg);
		} finally {
			setReleaseConsultantBusy(false);
		}
	}, [activeId, soloCanReleaseConsultant, t, setChats]);

	return {
		heroPickerOpen,
		setHeroPickerOpen,
		soloSlotModalOpen,
		setSoloSlotModalOpen,
		soloSlotPurchaseBusy,
		soloSlotDuration,
		setSoloSlotDuration,
		soloSlotHeroPick,
		setSoloSlotHeroPick,
		soloSlotStep,
		setSoloSlotStep,
		ugsCreditsBalance,
		newChatSoloDuration,
		setNewChatSoloDuration,
		newChatSoloStep,
		setNewChatSoloStep,
		newChatCreateBusy,
		releaseConsultantBusy,
		releaseConsultantModalOpen,
		setReleaseConsultantModalOpen,
		soloSlotCountdownLabel,
		newChatKind,
		setNewChatKind,
		pickedHeroId,
		setPickedHeroId,
		pickedMemoryCellId,
		setPickedMemoryCellId,
		memoryCellsForPicker,
		soloSlotSelectedEnergy,
		newChatSoloSelectedEnergy,
		soloSlotTariffs,
		heroDialogRef,
		openHeroPicker,
		confirmNewChatWithHero,
		purchaseSoloSlot,
		performReleaseConsultant,
		refreshUgsCredits,
	};
}
