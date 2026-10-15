/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin GAF Chat desktop app shell: login gate, orchestration hook wiring,
 * and GafChatAppWorkspace model assembly.
 *
 * Invariants:
 * - Default export path remains stable for desktopWindowAppContent lazyImports.
 * - Unauthenticated users see the same login empty state as before atomization.
 *
 * Related:
 * - hooks/useGafChatAppOrchestration.ts
 * - hooks/buildGafChatAppWorkspaceModel.ts
 * - components/GafChatAppWorkspace.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md
 */

import * as React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { DesktopAppEmptyState } from '../DesktopAppChrome';
import { GafChatAppWorkspace } from './components/GafChatAppWorkspace';
import { buildGafChatAppWorkspaceModel } from './hooks/buildGafChatAppWorkspaceModel';
import { useGafChatAppOrchestration } from './hooks/useGafChatAppOrchestration';

export interface GAFChatAppProps {
	/** When opening from Friends or deep links: username to open or create chat with. */
	initialTargetUsername?: string;
	/** When opening from Desktop notifications: existing chat id to focus. */
	initialTargetChatId?: string;
	/** When opening from desktop file context: unified content → composer attachment after a thread is selected. */
	initialComposerAttachment?: {
		contentId: string;
		fileName: string;
		size: number | null;
		mimeType?: string | null;
	};
	/** Desktop: черновик в композере при выбранном чате (контекст проекта и др.). */
	initialComposerSeed?: string;
	/** Professional Worlds cross-app draft link for lifecycle reporting after send. */
	professionalWorldsCrossAppLinkId?: string;
}

const GAFChatApp: React.FC<GAFChatAppProps> = (props) => {
	const { user, t, ...workspaceModelArgs } = useGafChatAppOrchestration(props);

	if (!user) {
		return (
			<div className="h-full min-w-0 bg-transparent">
				<DesktopAppEmptyState
					icon={
						<ChatBubbleLeftRightIcon
							className="h-8 w-8 text-(--desktop-text-dim)"
							aria-hidden
						/>
					}
					title={t('loginTitle')}
					description={t('loginDescription')}
					className="h-full"
				/>
			</div>
		);
	}

	const m = buildGafChatAppWorkspaceModel(workspaceModelArgs);

	return <GafChatAppWorkspace m={m} />;
};

export default GAFChatApp;
