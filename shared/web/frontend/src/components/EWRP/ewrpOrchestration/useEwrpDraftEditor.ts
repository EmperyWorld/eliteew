/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP slide draft editor lifecycle: edit mode, DnD, save, autosave, nav, AI panel hook.
 *
 * Invariants:
 * - Draft sync from status only on phase change (generating_images/building_pdf → completed).
 * - Local draft key `ewrp-draft-{jobId}` via `ewrpLocalDraftStorage`.
 *
 * Related:
 * - `EwrpSlideEditorPanel.tsx`, `documentation/product/EWRP-EDITOR.md`
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { VirtualVariableListHandle } from '@/components/shared/VirtualList';
import { useResizeObserverRect } from '@/hooks/useResizeObserverRect';
import type { EwrpSlide, EwrpStatusResponse } from '@/services/ewrpApi';
import {
	EWRP_EDITOR_SLIDES_VIRTUAL_THRESHOLD,
	EWRP_MAX_SLIDES_EDITOR,
	EWRP_MIN_SLIDES_EDITOR,
} from '../EwrpGeneratorChunks';
import {
	ewrpBulletLinesFromTextarea,
	ewrpDraftBulletsUnchanged,
	normalizeEwrpSlideBullets,
} from '../ewrpDraftBullets';
import {
	ewrpSlideRebuildInProgress,
	ewrpSlideRegenAllowed,
} from '../ewrpClientJobPolicy';
import { ewrpPresentationsMiniStatusVisible } from '../ewrpPresentationsMiniStatusVisible';
import {
	ewrpMiniStatusScrollToEditorVisible,
	ewrpPresentationsScrollToEditorVisible,
} from '../ewrpPresentationsScrollToEditorVisible';
import { useEwrpPresentationsScrollTargets } from '../useEwrpPresentationsScrollTargets';
import { useEwrpSlideEditorAi } from '../EwrpSlideEditorPanel';
import type { DraftRestorePrompt } from './ewrpOrchestrationTypes';
import {
	clearEwrpLocalDraft,
	parseEwrpDraftRestorePrompt,
	readEwrpLocalDraftRaw,
} from './ewrpLocalDraftStorage';
import { useEwrpDraftEditorSave } from './useEwrpDraftEditorSave';

export type UseEwrpDraftEditorParams = {
	t: (key: string, opts?: Record<string, unknown>) => string;
	jobId: string | null;
	status: EwrpStatusResponse | null;
	setStatus: React.Dispatch<React.SetStateAction<EwrpStatusResponse | null>>;
	isEditing: boolean;
	setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
	saving: boolean;
	setSaving: React.Dispatch<React.SetStateAction<boolean>>;
	draftSlides: EwrpSlide[] | null;
	setDraftSlides: React.Dispatch<React.SetStateAction<EwrpSlide[] | null>>;
	slideListLayout: 'comfortable' | 'compact';
	setSlideListLayout: React.Dispatch<
		React.SetStateAction<'comfortable' | 'compact'>
	>;
	slidePanelOpen: boolean[];
	setSlidePanelOpen: React.Dispatch<React.SetStateAction<boolean[]>>;
	slideEditorSearch: string;
	setSlideEditorSearch: React.Dispatch<React.SetStateAction<string>>;
	cancelEditConfirmOpen: boolean;
	setCancelEditConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
	saveMultiUgsConfirmOpen: boolean;
	setSaveMultiUgsConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
	draftRestorePrompt: DraftRestorePrompt | null;
	setDraftRestorePrompt: React.Dispatch<
		React.SetStateAction<DraftRestorePrompt | null>
	>;
	editorJobDetailsOpen: boolean;
	setEditorJobDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	editorTipsOpen: boolean;
	setEditorTipsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	editorStructureOpen: boolean;
	setEditorStructureOpen: React.Dispatch<React.SetStateAction<boolean>>;
	editorChromeOpen: boolean;
	setEditorChromeOpen: React.Dispatch<React.SetStateAction<boolean>>;
	editorNavActiveIndex: number;
	setEditorNavActiveIndex: React.Dispatch<React.SetStateAction<number>>;
	pdfPresentationOpen: boolean;
	setPdfPresentationOpen: React.Dispatch<React.SetStateAction<boolean>>;
	presentationsEditorFocusAnnouncement: string;
	setPresentationsEditorFocusAnnouncement: React.Dispatch<
		React.SetStateAction<string>
	>;
	slideEditorScrollRef: React.RefObject<HTMLDivElement | null>;
	editorListMeasureRef: React.RefObject<HTMLDivElement | null>;
	editorVirtualListRef: React.RefObject<VirtualVariableListHandle | null>;
	expectPdfRebuildToastRef: React.MutableRefObject<boolean>;
	primaryBtnClass: string;
	secondaryBtnClass: string;
	pollStatus: (id: string) => Promise<void>;
	resumeActivePolling: () => void;
	refreshHistory: () => Promise<void>;
};

export function useEwrpDraftEditor(params: UseEwrpDraftEditorParams) {
	const {
		t,
		jobId,
		status,
		setStatus,
		isEditing,
		setIsEditing,
		setSaving,
		draftSlides,
		setDraftSlides,
		slideListLayout,
		setSlideListLayout,
		slidePanelOpen,
		setSlidePanelOpen,
		slideEditorSearch,
		setSlideEditorSearch,
		setCancelEditConfirmOpen,
		setSaveMultiUgsConfirmOpen,
		draftRestorePrompt,
		setDraftRestorePrompt,
		setEditorJobDetailsOpen,
		setEditorTipsOpen,
		setEditorStructureOpen,
		setEditorChromeOpen,
		editorNavActiveIndex,
		setEditorNavActiveIndex,
		setPdfPresentationOpen,
		setPresentationsEditorFocusAnnouncement,
		editorListMeasureRef,
		editorVirtualListRef,
		expectPdfRebuildToastRef,
		primaryBtnClass,
		secondaryBtnClass,
		pollStatus,
		resumeActivePolling,
		refreshHistory,
	} = params;

	const ewrpPrevStatusForDraftRef = useRef<string | undefined>(undefined);
	const draftBaselineJsonRef = useRef<string>('');
	const slideListLayoutRef = useRef(slideListLayout);
	slideListLayoutRef.current = slideListLayout;
	const draftSlidesCountRef = useRef(draftSlides?.length ?? 0);
	draftSlidesCountRef.current = draftSlides?.length ?? 0;

	const patchDraftSlide = useCallback(
		(index: number, patch: Partial<EwrpSlide>) => {
			setDraftSlides((prev) => {
				if (!prev) return prev;
				const next = [...prev];
				next[index] = { ...next[index], ...patch };
				return next;
			});
		},
		[setDraftSlides]
	);

	const slideAi = useEwrpSlideEditorAi({
		jobId,
		status,
		setStatus,
		onPatchDraftSlide: patchDraftSlide,
		resumeActivePolling,
		secondaryBtnClass,
		primaryBtnClass,
	});

	const canEditSlides = useMemo(() => {
		if (!jobId || !status) return false;
		const slides = status.slides;
		if (!Array.isArray(slides) || slides.length === 0) return false;
		return ewrpSlideRegenAllowed(status.status);
	}, [jobId, status]);

	const slideRebuildInProgress = useMemo(
		() => ewrpSlideRebuildInProgress(status?.status),
		[status?.status]
	);

	const showSlideEditorPanel = useMemo(
		() =>
			Boolean(
				isEditing && draftSlides && (canEditSlides || slideRebuildInProgress)
			),
		[isEditing, draftSlides, canEditSlides, slideRebuildInProgress]
	);

	const editorFocusMode = showSlideEditorPanel;
	const editorListRect = useResizeObserverRect(
		editorListMeasureRef,
		editorFocusMode ? draftSlides?.length : 0
	);
	const editorVirtualListHeight = useMemo(() => {
		const measured = Math.floor(editorListRect.height);
		const viewportFallback =
			typeof window !== 'undefined'
				? Math.min(Math.max(Math.floor(window.innerHeight * 0.62), 360), 780)
				: 600;
		return measured >= 240 ? measured : viewportFallback;
	}, [editorListRect.height]);

	const {
		statusPanelAnchorRef,
		slideEditorAnchorRef,
		statusPanelVisible,
		slideEditorPanelVisible,
	} = useEwrpPresentationsScrollTargets({
		statusObserverEnabled: Boolean(jobId && status),
		editorObserverEnabled: showSlideEditorPanel,
	});

	const showPresentationsMiniStatus = useMemo(
		() =>
			ewrpPresentationsMiniStatusVisible({
				hasJobId: Boolean(jobId),
				hasStatus: Boolean(status),
				statusPanelVisible,
				showSlideEditorPanel,
			}),
		[jobId, status, statusPanelVisible, showSlideEditorPanel]
	);

	const slideFilterQuery = slideEditorSearch.trim().toLowerCase();
	const visibleSlideIndices = useMemo(() => {
		if (!draftSlides?.length) return [];
		if (!slideFilterQuery) return draftSlides.map((_, i) => i);
		return draftSlides
			.map((s, i) => {
				const slideTitle = (s.title ?? '').toLowerCase();
				const bullets = (s.bullets ?? []).join('\n').toLowerCase();
				const numLabel = String(i + 1);
				const q = slideFilterQuery;
				if (/^\d+$/.test(q) && numLabel === q) return i;
				if (
					slideTitle.includes(q) ||
					bullets.includes(q) ||
					numLabel.includes(q)
				) {
					return i;
				}
				return -1;
			})
			.filter((i): i is number => i >= 0);
	}, [draftSlides, slideFilterQuery]);

	const editorQuickNavIndices = useMemo(() => {
		if (!draftSlides) return [];
		if (slideFilterQuery) return visibleSlideIndices;
		return draftSlides.map((_, index) => index);
	}, [draftSlides, slideFilterQuery, visibleSlideIndices]);

	useEffect(() => {
		if (editorQuickNavIndices.length === 0) return;
		setEditorNavActiveIndex((prev) =>
			editorQuickNavIndices.includes(prev)
				? prev
				: (editorQuickNavIndices[0] ?? 0)
		);
	}, [editorQuickNavIndices, setEditorNavActiveIndex]);

	const estimateDraftSlideVirtualSize = useCallback(
		(index: number) => ((slidePanelOpen[index] ?? true) ? 300 : 120),
		[slidePanelOpen]
	);

	const virtualizeEditorSlides = useMemo(
		() =>
			Boolean(
				!slideFilterQuery &&
					draftSlides &&
					draftSlides.length > 1 &&
					draftSlides.length >= EWRP_EDITOR_SLIDES_VIRTUAL_THRESHOLD
			),
		[draftSlides, slideFilterQuery]
	);

	const draftIsDirty = useMemo(() => {
		if (!isEditing || !draftSlides) return false;
		try {
			return JSON.stringify(draftSlides) !== draftBaselineJsonRef.current;
		} catch {
			return true;
		}
	}, [isEditing, draftSlides]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset stale pipeline status when switching jobs
	useEffect(() => {
		ewrpPrevStatusForDraftRef.current = undefined;
	}, [jobId]);

	useEffect(() => {
		const cur = status?.status;
		const prev = ewrpPrevStatusForDraftRef.current;
		if (prev === cur) return;
		ewrpPrevStatusForDraftRef.current = cur;
		if (!isEditing || !status?.slides) return;
		if (
			(prev === 'generating_images' || prev === 'building_pdf') &&
			cur === 'completed'
		) {
			const next = (
				JSON.parse(JSON.stringify(status.slides)) as EwrpSlide[]
			).map((slide) => ({
				...slide,
				bullets: normalizeEwrpSlideBullets(slide),
			}));
			draftBaselineJsonRef.current = JSON.stringify(next);
			setDraftSlides(next);
		}
	}, [status?.status, status?.slides, isEditing, setDraftSlides]);

	const performCancelEdit = useCallback(() => {
		clearEwrpLocalDraft(jobId);
		setIsEditing(false);
		setDraftSlides(null);
		setSlidePanelOpen([]);
		setSlideEditorSearch('');
		setDraftRestorePrompt(null);
		setCancelEditConfirmOpen(false);
		setSaveMultiUgsConfirmOpen(false);
		setEditorJobDetailsOpen(false);
		setEditorTipsOpen(false);
		setEditorStructureOpen(false);
		setEditorChromeOpen(false);
		setEditorNavActiveIndex(0);
	}, [
		jobId,
		setIsEditing,
		setDraftSlides,
		setSlidePanelOpen,
		setSlideEditorSearch,
		setDraftRestorePrompt,
		setCancelEditConfirmOpen,
		setSaveMultiUgsConfirmOpen,
		setEditorJobDetailsOpen,
		setEditorTipsOpen,
		setEditorStructureOpen,
		setEditorChromeOpen,
		setEditorNavActiveIndex,
	]);

	const handleStartEdit = useCallback(() => {
		if (!status?.slides || !canEditSlides) return;
		const next = (JSON.parse(JSON.stringify(status.slides)) as EwrpSlide[]).map(
			(slide) => ({
				...slide,
				bullets: normalizeEwrpSlideBullets(slide),
			})
		);
		draftBaselineJsonRef.current = JSON.stringify(next);
		setIsEditing(true);
		setSlideListLayout('comfortable');
		setDraftSlides(next);
		setDraftRestorePrompt(null);
		setSlideEditorSearch('');
		setEditorJobDetailsOpen(false);
		setEditorTipsOpen(false);
		setEditorStructureOpen(false);
		setEditorChromeOpen(false);
		setEditorNavActiveIndex(0);
		if (jobId) {
			const raw = readEwrpLocalDraftRaw(jobId);
			if (raw) {
				const prompt = parseEwrpDraftRestorePrompt(
					raw,
					draftBaselineJsonRef.current
				);
				if (prompt) setDraftRestorePrompt(prompt);
			}
		}
	}, [
		status?.slides,
		canEditSlides,
		jobId,
		setIsEditing,
		setSlideListLayout,
		setDraftSlides,
		setDraftRestorePrompt,
		setSlideEditorSearch,
		setEditorJobDetailsOpen,
		setEditorTipsOpen,
		setEditorStructureOpen,
		setEditorChromeOpen,
		setEditorNavActiveIndex,
	]);

	const handleCancelEdit = useCallback(() => {
		if (draftIsDirty) {
			setCancelEditConfirmOpen(true);
			return;
		}
		performCancelEdit();
	}, [draftIsDirty, performCancelEdit, setCancelEditConfirmOpen]);

	const focusSlideEditorSearch = useCallback(() => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				document.getElementById('ewrp-slide-editor-search')?.focus();
			});
		});
	}, []);

	const focusPresentationsSlideEditor = useCallback(() => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				slideEditorAnchorRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
				});
				setPresentationsEditorFocusAnnouncement(
					t('a11y.presentationsEditorFocused')
				);
				window.setTimeout(() => {
					setPresentationsEditorFocusAnnouncement('');
				}, 2000);
				focusSlideEditorSearch();
			});
		});
	}, [
		t,
		focusSlideEditorSearch,
		slideEditorAnchorRef,
		setPresentationsEditorFocusAnnouncement,
	]);

	const showPresentationsScrollToEditor = useMemo(
		() =>
			ewrpPresentationsScrollToEditorVisible({
				showSlideEditorPanel,
				statusPanelVisible,
				slideEditorPanelVisible,
			}),
		[showSlideEditorPanel, statusPanelVisible, slideEditorPanelVisible]
	);

	const showMiniStatusScrollToEditor = useMemo(
		() =>
			ewrpMiniStatusScrollToEditorVisible({
				showPresentationsMiniStatus,
				slideEditorPanelVisible,
			}),
		[showPresentationsMiniStatus, slideEditorPanelVisible]
	);

	const applyDraftRestore = useCallback(() => {
		if (!draftRestorePrompt) return;
		const next = (
			JSON.parse(JSON.stringify(draftRestorePrompt.slides)) as EwrpSlide[]
		).map((slide) => ({
			...slide,
			bullets: normalizeEwrpSlideBullets(slide),
		}));
		draftBaselineJsonRef.current = JSON.stringify(next);
		setDraftSlides(next);
		setDraftRestorePrompt(null);
		focusSlideEditorSearch();
	}, [
		draftRestorePrompt,
		focusSlideEditorSearch,
		setDraftSlides,
		setDraftRestorePrompt,
	]);

	const dismissDraftRestoreKeepEditing = useCallback(() => {
		setDraftRestorePrompt(null);
		if (isEditing && draftSlides) {
			focusSlideEditorSearch();
		}
	}, [draftSlides, focusSlideEditorSearch, isEditing, setDraftRestorePrompt]);

	const handleChangeTitle = useCallback(
		(index: number, value: string) => {
			setDraftSlides((prev) => {
				if (!prev) return prev;
				if (prev[index]?.title === value) return prev;
				const next = [...prev];
				next[index] = { ...next[index], title: value };
				return next;
			});
		},
		[setDraftSlides]
	);

	const handleChangeBullets = useCallback(
		(index: number, value: string) => {
			const lines = ewrpBulletLinesFromTextarea(value);
			setDraftSlides((prev) => {
				if (!prev) return prev;
				if (ewrpDraftBulletsUnchanged(prev[index], value)) return prev;
				const next = [...prev];
				next[index] = { ...next[index], bullets: lines };
				return next;
			});
		},
		[setDraftSlides]
	);

	const handleChangeLayout = useCallback(
		(index: number, value: string) => {
			if (index === 0) return;
			setDraftSlides((prev) => {
				if (!prev) return prev;
				const next = [...prev];
				next[index] = { ...next[index], layout: value };
				return next;
			});
		},
		[setDraftSlides]
	);

	const handleDraftMoveUp = useCallback(
		(index: number) => {
			setDraftSlides((prev) => {
				if (!prev || index <= 0) return prev;
				const next = [...prev];
				[next[index - 1], next[index]] = [next[index], next[index - 1]];
				return next;
			});
			setSlidePanelOpen((prev) => {
				if (index <= 0 || prev.length <= index) return prev;
				const next = [...prev];
				[next[index - 1], next[index]] = [next[index], next[index - 1]];
				return next;
			});
		},
		[setDraftSlides, setSlidePanelOpen]
	);

	const handleDraftMoveDown = useCallback(
		(index: number) => {
			setDraftSlides((prev) => {
				if (!prev || index >= prev.length - 1) return prev;
				const next = [...prev];
				[next[index], next[index + 1]] = [next[index + 1], next[index]];
				return next;
			});
			setSlidePanelOpen((prev) => {
				if (prev.length <= index + 1) return prev;
				const next = [...prev];
				[next[index], next[index + 1]] = [next[index + 1], next[index]];
				return next;
			});
		},
		[setDraftSlides, setSlidePanelOpen]
	);

	const handleDraftRemove = useCallback(
		(index: number) => {
			setDraftSlides((prev) => {
				if (!prev || prev.length <= EWRP_MIN_SLIDES_EDITOR) return prev;
				return prev.filter((_, i) => i !== index);
			});
			setSlidePanelOpen((prev) => prev.filter((_, i) => i !== index));
		},
		[setDraftSlides, setSlidePanelOpen]
	);

	const handleDraftAddSlide = useCallback(() => {
		setDraftSlides((prev) => {
			if (!prev) return prev;
			if (prev.length >= EWRP_MAX_SLIDES_EDITOR) return prev;
			const n = prev.length + 1;
			return [
				...prev,
				{
					title: t('draft.newSlide', { n }),
					bullets: [],
					image_filename: null,
				},
			];
		});
	}, [setDraftSlides, t]);

	const draftDndSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDraftDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || active.id === over.id) return;
			const parse = (id: string | number) => {
				const m = /^ewrp-slide-pos-(\d+)$/.exec(String(id));
				return m ? Number.parseInt(m[1], 10) : -1;
			};
			const oldIndex = parse(active.id);
			const newIndex = parse(over.id);
			if (oldIndex < 0 || newIndex < 0) return;
			setDraftSlides((prev) => {
				if (!prev) return prev;
				return arrayMove(prev, oldIndex, newIndex);
			});
			setSlidePanelOpen((prev) => {
				if (prev.length <= Math.max(oldIndex, newIndex)) return prev;
				return arrayMove([...prev], oldIndex, newIndex);
			});
		},
		[setDraftSlides, setSlidePanelOpen]
	);

	const handleSlidePanelOpenChange = useCallback(
		(index: number, open: boolean) => {
			setSlidePanelOpen((prev) => {
				if (index >= prev.length) return prev;
				if (prev[index] === open) return prev;
				const next = [...prev];
				next[index] = open;
				return next;
			});
		},
		[setSlidePanelOpen]
	);

	const handleExpandAllSlides = useCallback(() => {
		const n = draftSlidesCountRef.current;
		if (n === 0) return;
		setSlidePanelOpen(Array(n).fill(true));
		setSlideListLayout('comfortable');
	}, [setSlidePanelOpen, setSlideListLayout]);

	const handleCollapseAllSlides = useCallback(() => {
		const n = draftSlidesCountRef.current;
		if (n === 0) return;
		setSlidePanelOpen(Array(n).fill(false));
		setSlideListLayout('compact');
	}, [setSlidePanelOpen, setSlideListLayout]);

	const scrollToDraftSlide = useCallback(
		(index: number) => {
			setEditorNavActiveIndex(index);
			handleSlidePanelOpenChange(index, true);
			if (virtualizeEditorSlides && !slideFilterQuery) {
				editorVirtualListRef.current?.scrollToIndex(index, {
					align: 'start',
					behavior: 'smooth',
				});
				return;
			}
			window.requestAnimationFrame(() => {
				document
					.getElementById(`ewrp-draft-slide-${index}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});
		},
		[
			handleSlidePanelOpenChange,
			virtualizeEditorSlides,
			slideFilterQuery,
			setEditorNavActiveIndex,
			editorVirtualListRef,
		]
	);

	const goToAdjacentDraftSlide = useCallback(
		(direction: -1 | 1) => {
			const pos = editorQuickNavIndices.indexOf(editorNavActiveIndex);
			if (pos < 0) return;
			const nextPos = pos + direction;
			if (nextPos < 0 || nextPos >= editorQuickNavIndices.length) return;
			const nextIndex = editorQuickNavIndices[nextPos];
			if (nextIndex !== undefined) scrollToDraftSlide(nextIndex);
		},
		[editorQuickNavIndices, editorNavActiveIndex, scrollToDraftSlide]
	);

	useEffect(() => {
		const n = draftSlides?.length ?? 0;
		setSlidePanelOpen((prev) => {
			if (n === 0) return [];
			if (prev.length === n) return prev;
			if (prev.length === 0) {
				return Array(n).fill(slideListLayoutRef.current === 'comfortable');
			}
			if (n > prev.length) {
				const fill = slideListLayoutRef.current === 'comfortable';
				return [...prev, ...Array(n - prev.length).fill(fill)];
			}
			return prev.slice(0, n);
		});
	}, [draftSlides?.length, setSlidePanelOpen]);

	useEffect(() => {
		const n = draftSlidesCountRef.current;
		if (n === 0) return;
		setSlidePanelOpen(Array(n).fill(slideListLayout === 'comfortable'));
	}, [slideListLayout, setSlidePanelOpen]);

	const { runSaveSlides, handleSaveSlides } = useEwrpDraftEditorSave({
		t,
		jobId,
		status,
		setStatus,
		draftSlides,
		setDraftSlides,
		isEditing,
		setIsEditing,
		setSaving,
		setSaveMultiUgsConfirmOpen,
		setSlideEditorSearch,
		setPdfPresentationOpen,
		slideRebuildInProgress,
		showSlideEditorPanel,
		expectPdfRebuildToastRef,
		pollStatus,
		refreshHistory,
		goToAdjacentDraftSlide,
	});

	const draftSortIds = useMemo(
		() => (draftSlides ?? []).map((_, i) => `ewrp-slide-pos-${i}`),
		[draftSlides]
	);

	return {
		slideAi,
		canEditSlides,
		slideRebuildInProgress,
		showSlideEditorPanel,
		editorFocusMode,
		editorVirtualListHeight,
		showPresentationsMiniStatus,
		slideFilterQuery,
		visibleSlideIndices,
		editorQuickNavIndices,
		estimateDraftSlideVirtualSize,
		virtualizeEditorSlides,
		draftIsDirty,
		performCancelEdit,
		handleStartEdit,
		handleCancelEdit,
		focusPresentationsSlideEditor,
		showPresentationsScrollToEditor,
		showMiniStatusScrollToEditor,
		applyDraftRestore,
		dismissDraftRestoreKeepEditing,
		handleChangeTitle,
		handleChangeBullets,
		handleChangeLayout,
		handleDraftMoveUp,
		handleDraftMoveDown,
		handleDraftRemove,
		handleDraftAddSlide,
		draftDndSensors,
		handleDraftDragEnd,
		handleSlidePanelOpenChange,
		handleExpandAllSlides,
		handleCollapseAllSlides,
		scrollToDraftSlide,
		runSaveSlides,
		handleSaveSlides,
		draftSortIds,
		statusPanelAnchorRef,
		slideEditorAnchorRef,
		statusPanelVisible,
		slideEditorPanelVisible,
	};
}
