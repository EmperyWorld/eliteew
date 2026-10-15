/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Widget layout slot actions for desktop expansion settings.
 *
 * Related:
 * - useDesktopExpansionSettings.ts
 */

import { useCallback } from 'react';
import type { WidgetsPanelPosition } from '../../types/desktop.types';
import type {
	DesktopWidgetLayoutSlot,
	DesktopWidgetsLayout,
	DesktopWidgetsSlotPlacement,
} from '../../types/desktopExpansion.types';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';
import {
	clampWidgetPositionInWorkArea,
	computeInitialFreeSlotPositions,
	estimateWidgetSlotHeight,
	normalizedSlotPlacement,
	reorderWidgetSlotsByIndex,
	WIDGET_SLOT_CARD_WIDTH_LAYOUT,
	WIDGET_WORK_MARGIN_PX,
} from '../../utils/desktopWidgetLayoutUtils';
import type { DesktopExpansionShellCore } from './useDesktopExpansionShellCore';

type WidgetActionsDeps = Pick<
	DesktopExpansionShellCore,
	'widgetsLayout' | 'setWidgetsLayout' | 'patchExpansion'
> & {
	widgetsPanelPosition: WidgetsPanelPosition;
	compactWidgetsGlobal: boolean;
};

export function useDesktopExpansionWidgetActions(deps: WidgetActionsDeps) {
	const {
		widgetsLayout,
		setWidgetsLayout,
		patchExpansion,
		widgetsPanelPosition,
		compactWidgetsGlobal,
	} = deps;

	const toggleWidgetSlot = useCallback(
		async (slotId: string) => {
			const next = {
				...widgetsLayout,
				slots: widgetsLayout.slots.map((slot) =>
					slot.id === slotId ? { ...slot, enabled: !slot.enabled } : slot
				),
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const toggleWidgetSlotMode = useCallback(
		async (slotId: string) => {
			const next: DesktopWidgetsLayout = {
				...widgetsLayout,
				slots: widgetsLayout.slots.map((slot) => {
					if (slot.id !== slotId) return slot;
					const mode: DesktopWidgetLayoutSlot['mode'] =
						slot.mode === 'compact' ? 'expanded' : 'compact';
					return { ...slot, mode };
				}),
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const toggleWidgetsPerWorkspace = useCallback(
		async (enabled: boolean) => {
			const next = { ...widgetsLayout, perWorkspace: enabled };
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const reorderWidgetSlots = useCallback(
		async (fromIndex: number, toIndex: number) => {
			const slots = reorderWidgetSlotsByIndex(
				widgetsLayout.slots,
				fromIndex,
				toIndex
			);
			const next: DesktopWidgetsLayout = { ...widgetsLayout, slots };
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const moveWidgetSlotStep = useCallback(
		async (slotId: string, direction: 'up' | 'down') => {
			const idx = widgetsLayout.slots.findIndex((s) => s.id === slotId);
			if (idx < 0) return;
			const toIndex = direction === 'up' ? idx - 1 : idx + 1;
			if (toIndex < 0 || toIndex >= widgetsLayout.slots.length) return;
			await reorderWidgetSlots(idx, toIndex);
		},
		[reorderWidgetSlots, widgetsLayout.slots]
	);

	const setWidgetSlotWorkspaceProfile = useCallback(
		async (slotId: string, workspaceProfileId: string | undefined) => {
			const next: DesktopWidgetsLayout = {
				...widgetsLayout,
				slots: widgetsLayout.slots.map((slot) =>
					slot.id === slotId
						? {
								...slot,
								workspaceProfileId:
									typeof workspaceProfileId === 'string' &&
									workspaceProfileId.trim()
										? workspaceProfileId.trim()
										: undefined,
							}
						: slot
				),
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const setWidgetsPanelOffset = useCallback(
		async (offset: { x: number; y: number }) => {
			const next: DesktopWidgetsLayout = {
				...widgetsLayout,
				panelOffset: {
					x: Math.round(offset.x),
					y: Math.round(offset.y),
				},
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const setWidgetsSlotPlacement = useCallback(
		async (placement: DesktopWidgetsSlotPlacement) => {
			if (placement === 'free') {
				const work = readDesktopWorkArea();
				const po = widgetsLayout.panelOffset ?? { x: 0, y: 0 };
				const init = computeInitialFreeSlotPositions(
					widgetsLayout.slots,
					widgetsPanelPosition,
					work.width,
					work.height,
					po,
					compactWidgetsGlobal
				);
				const next: DesktopWidgetsLayout = {
					...widgetsLayout,
					slotPlacement: 'free',
					slots: widgetsLayout.slots.map((slot) => {
						if (!slot.enabled) return slot;
						const p = init[slot.id];
						return p ? { ...slot, position: p } : slot;
					}),
				};
				setWidgetsLayout(next);
				await patchExpansion({ widgets_layout: next });
				return;
			}
			const next: DesktopWidgetsLayout = {
				...widgetsLayout,
				slotPlacement: undefined,
				slots: widgetsLayout.slots.map((slot) => {
					const { position: _p, ...rest } = slot;
					return rest;
				}),
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[
			compactWidgetsGlobal,
			patchExpansion,
			setWidgetsLayout,
			widgetsLayout,
			widgetsPanelPosition,
		]
	);

	const setWidgetSlotPosition = useCallback(
		async (slotId: string, position: { x: number; y: number }) => {
			const next: DesktopWidgetsLayout = {
				...widgetsLayout,
				slots: widgetsLayout.slots.map((slot) =>
					slot.id === slotId
						? {
								...slot,
								position: {
									x: Math.round(position.x),
									y: Math.round(position.y),
								},
							}
						: slot
				),
			};
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const nudgeAllWidgetSlotPositions = useCallback(
		async (delta: { x: number; y: number }) => {
			const work = readDesktopWorkArea();
			const dx = Math.round(delta.x);
			const dy = Math.round(delta.y);
			const nextSlots = widgetsLayout.slots.map((slot) => {
				if (!slot.enabled || !slot.position) return slot;
				const cardH = estimateWidgetSlotHeight(
					slot.type,
					compactWidgetsGlobal || slot.mode === 'compact'
				);
				const clamped = clampWidgetPositionInWorkArea(
					{ x: slot.position.x + dx, y: slot.position.y + dy },
					work.width,
					work.height,
					WIDGET_SLOT_CARD_WIDTH_LAYOUT,
					cardH,
					WIDGET_WORK_MARGIN_PX
				);
				return { ...slot, position: clamped };
			});
			const next = { ...widgetsLayout, slots: nextSlots };
			setWidgetsLayout(next);
			await patchExpansion({ widgets_layout: next });
		},
		[compactWidgetsGlobal, patchExpansion, setWidgetsLayout, widgetsLayout]
	);

	const ensureFreeWidgetSlotPositions = useCallback(async () => {
		if (normalizedSlotPlacement(widgetsLayout.slotPlacement) !== 'free') {
			return;
		}
		if (!widgetsLayout.slots.some((s) => s.enabled && s.position == null)) {
			return;
		}
		const work = readDesktopWorkArea();
		const po = widgetsLayout.panelOffset ?? { x: 0, y: 0 };
		const init = computeInitialFreeSlotPositions(
			widgetsLayout.slots,
			widgetsPanelPosition,
			work.width,
			work.height,
			po,
			compactWidgetsGlobal
		);
		const next: DesktopWidgetsLayout = {
			...widgetsLayout,
			slotPlacement: 'free',
			slots: widgetsLayout.slots.map((slot) => {
				if (!slot.enabled || slot.position != null) return slot;
				const p = init[slot.id];
				return p ? { ...slot, position: p } : slot;
			}),
		};
		setWidgetsLayout(next);
		await patchExpansion({ widgets_layout: next });
	}, [
		compactWidgetsGlobal,
		patchExpansion,
		setWidgetsLayout,
		widgetsLayout,
		widgetsPanelPosition,
	]);

	return {
		toggleWidgetSlot,
		toggleWidgetSlotMode,
		toggleWidgetsPerWorkspace,
		reorderWidgetSlots,
		moveWidgetSlotStep,
		setWidgetSlotWorkspaceProfile,
		setWidgetsPanelOffset,
		setWidgetsSlotPlacement,
		setWidgetSlotPosition,
		nudgeAllWidgetSlotPositions,
		ensureFreeWidgetSlotPositions,
	};
}
