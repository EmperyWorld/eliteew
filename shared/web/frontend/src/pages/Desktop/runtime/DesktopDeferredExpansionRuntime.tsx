/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deferred Desktop expansion engine: shell_state profiles, widgets layout, collections.
 * Renders nothing; writes into expansion context.
 *
 * Invariants:
 * - Mounted only after `deferredRuntimeReady`.
 * - Must not remount critical shell; context updates are additive.
 *
 * Related:
 * - DesktopDeferredExpansionContext.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { memo, useLayoutEffect } from 'react';
import { useSetDesktopDeferredExpansion } from '../context/DesktopDeferredExpansionContext';
import { useDesktopExpansionSettings } from '../hooks/useDesktopExpansionSettings';
import {
	EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS,
	deferredExpansionPersistRefreshRef,
	desktopDeferredExpansionEqual,
} from './desktopDeferredExpansionSettings';
import type { DesktopDeferredExpansionSettingsInput } from './desktopDeferredExpansionSettingsInput';

function DesktopDeferredExpansionRuntimeInner(
	input: DesktopDeferredExpansionSettingsInput
): null {
	const setExpansion = useSetDesktopDeferredExpansion();
	const expansion = useDesktopExpansionSettings(input);

	useLayoutEffect(() => {
		deferredExpansionPersistRefreshRef.current = expansion.refresh;
		setExpansion((prev) =>
			desktopDeferredExpansionEqual(prev, expansion) ? prev : expansion
		);
	}, [expansion, setExpansion]);

	useLayoutEffect(
		() => () => {
			deferredExpansionPersistRefreshRef.current =
				EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS.refresh;
			setExpansion(EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS);
		},
		[setExpansion]
	);

	return null;
}

export const DesktopDeferredExpansionRuntime = memo(
	DesktopDeferredExpansionRuntimeInner
);
