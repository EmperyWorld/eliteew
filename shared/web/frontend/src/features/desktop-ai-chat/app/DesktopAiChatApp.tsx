/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat app compose entry: wires useDesktopAiChatAppCompose into shell view.
 *
 * Invariants:
 * - Named and default export must remain equivalent for desktop lazy mount.
 *
 * Related:
 * - ../DesktopAiChatApp.tsx (stable facade), useDesktopAiChatAppCompose.ts
 */
import * as React from 'react';
import { DesktopAiChatAppView } from './DesktopAiChatAppView';
import type { DesktopAiChatAppProps } from './desktopAiChatAppTypes';
import { useDesktopAiChatAppCompose } from './useDesktopAiChatAppCompose';

export type { DesktopAiChatAppProps } from './desktopAiChatAppTypes';

export const DesktopAiChatApp: React.FC<DesktopAiChatAppProps> = (props) => {
	const vm = useDesktopAiChatAppCompose(props);
	return <DesktopAiChatAppView vm={vm} />;
};

export default DesktopAiChatApp;
