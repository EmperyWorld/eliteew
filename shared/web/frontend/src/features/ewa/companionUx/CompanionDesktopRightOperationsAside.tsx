/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop lg right aside: optional document-editor actions host + operations rail (U8.3 slice 22).
 *
 * Invariants:
 * - Hidden below lg (parent layout); document-editor slot only when ``showDocumentEditorActions``.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionChatOperationsRail.tsx
 * - src/features/ewa/companionOutputSurface/CompanionOutputSurface.tsx
 */

import type { RefCallback } from 'react';

import {
	CompanionChatOperationsRail,
	type CompanionChatOperationsRailProps,
} from '@/features/ewa/companionUx/CompanionChatOperationsRail';
import { cn } from '@/utils/cn';

export type CompanionDesktopRightOperationsAsideProps = {
	operationsRailProps: CompanionChatOperationsRailProps;
	showDocumentEditorActions: boolean;
	attachDocumentSurfaceActionsHost: RefCallback<HTMLDivElement>;
};

export function CompanionDesktopRightOperationsAside({
	operationsRailProps,
	showDocumentEditorActions,
	attachDocumentSurfaceActionsHost,
}: CompanionDesktopRightOperationsAsideProps) {
	return (
		<aside
			data-ewa-guide="operations"
			className={cn(
				'hidden min-h-0 w-[min(22rem,34vw)] min-w-[18rem] shrink-0 flex-col gap-2 overflow-hidden',
				'lg:flex lg:border-l lg:border-(--companion-divider) lg:pl-2'
			)}
		>
			{showDocumentEditorActions ? (
				<div
					className={cn(
						'max-h-[min(42vh,21rem)] shrink-0 overflow-y-auto overscroll-y-contain pr-0.5',
						'[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15'
					)}
				>
					<div
						ref={attachDocumentSurfaceActionsHost}
						className="flex min-h-0 flex-col gap-2"
						data-testid="ewa-companion-doc-editor-actions-rail"
					/>
				</div>
			) : null}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pr-0.5">
				<CompanionChatOperationsRail
					{...operationsRailProps}
					fillViewport
					secondaryRailMode
				/>
			</div>
		</aside>
	);
}
