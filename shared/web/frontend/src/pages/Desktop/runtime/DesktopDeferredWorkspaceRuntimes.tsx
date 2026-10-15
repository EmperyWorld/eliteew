/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single lazy entry for post-critical Desktop data runtimes.
 *
 * Invariants:
 * - Expansion runtime mounts before companion/extras so live settings are available.
 *
 * Related:
 * - DesktopWorkspaceContent.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import type { DesktopDeferredCompanionInput } from './desktopDeferredCompanionInput';
import type { DesktopDeferredExpansionSettingsInput } from './desktopDeferredExpansionSettingsInput';
import type { DesktopDeferredShellExtrasInput } from './desktopDeferredShellExtrasInput';
import type { DesktopDeferredVoiceCommandsInput } from './desktopDeferredVoiceCommandsInput';
import { DesktopDeferredCompanionRuntime } from './DesktopDeferredCompanionRuntime';
import { DesktopDeferredExpansionRuntime } from './DesktopDeferredExpansionRuntime';
import { DesktopDeferredShellExtrasRuntime } from './DesktopDeferredShellExtrasRuntime';
import { DesktopDeferredVoiceCommandsRuntime } from './DesktopDeferredVoiceCommandsRuntime';
import type { ReactElement } from 'react';

export type DesktopDeferredWorkspaceRuntimesProps = {
	expansionInput: DesktopDeferredExpansionSettingsInput;
	companionInput: DesktopDeferredCompanionInput;
	voiceCommandsInput: DesktopDeferredVoiceCommandsInput;
	extrasInput: DesktopDeferredShellExtrasInput;
};

export function DesktopDeferredWorkspaceRuntimes({
	expansionInput,
	companionInput,
	voiceCommandsInput,
	extrasInput,
}: DesktopDeferredWorkspaceRuntimesProps): ReactElement {
	return (
		<>
			<DesktopDeferredExpansionRuntime {...expansionInput} />
			<DesktopDeferredCompanionRuntime {...companionInput} />
			<DesktopDeferredVoiceCommandsRuntime {...voiceCommandsInput} />
			<DesktopDeferredShellExtrasRuntime {...extrasInput} />
		</>
	);
}
