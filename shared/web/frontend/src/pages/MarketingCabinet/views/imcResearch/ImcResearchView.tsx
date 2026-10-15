/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose root for Marketing Cabinet IMC Research: empty context, list + detail/form
 * layout, and ConfirmDeleteModal wiring.
 *
 * Invariants:
 * - Named export `ImcResearchView` preserved for marketingCabinetPageLazyImports.
 * - Public props match ImcResearchViewProps (no behavior change vs pre-split).
 *
 * Related:
 * - views/ImcResearchView.tsx (facade)
 * - useImcResearchController.ts
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { DesktopAppEmptyState } from '../../../Desktop/components/DesktopAppChrome';
import { ImcResearchDetailPanel } from './ImcResearchDetailPanel';
import { ImcResearchListPanel } from './ImcResearchListPanel';
import { ImcResearchRunForm } from './ImcResearchRunForm';
import type { ImcResearchViewProps } from './imcResearchTypes';
import { useImcResearchController } from './useImcResearchController';

export function ImcResearchView(props: ImcResearchViewProps) {
	const c = useImcResearchController(props);

	if (c.emptyContext) {
		return (
			<div
				className={cn(
					c.mcShellContentPanel,
					'shadow-none',
					'flex min-h-0 flex-1 flex-col overflow-hidden'
				)}
			>
				<DesktopAppEmptyState
					icon={
						<BeakerIcon
							className="h-10 w-10 opacity-50"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					}
					title={c.t('imcView.emptyContextTitle')}
					description={c.t('imcView.emptyContextDescription')}
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				c.mcShellContentPanel,
				'shadow-none',
				'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-4'
			)}
		>
			<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
				<ImcResearchListPanel c={c} />
				<div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
					{c.focusedEntityId ? (
						<ImcResearchDetailPanel c={c} />
					) : (
						<ImcResearchRunForm c={c} />
					)}
				</div>
			</div>

			<ConfirmDeleteModal
				isOpen={c.deleteResearchId !== null}
				onClose={() => c.setDeleteResearchId(null)}
				onConfirm={c.confirmDeleteResearch}
				title={c.t('imcView.deleteModalTitle')}
				warningMessage={c.t('imcView.deleteConfirm')}
				confirmButtonLabel={c.t('imcView.deleteResearch')}
				confirmButtonLoadingLabel={c.t('imcView.deleteDeleting')}
				cancelButtonLabel={c.t('common.cancel')}
			/>
		</div>
	);
}
