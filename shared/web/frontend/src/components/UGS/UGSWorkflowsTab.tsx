/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin UGS Workflows tab shell: loading gate, toolbar/list composition, QuickExecute modal.
 *
 * Invariants:
 * - Open execution history polls via React Query (15s active / 30s idle when auto-refresh on) with a panel cap.
 *
 * Related:
 * - components/UGSHub.tsx
 * - workflows/useUgsWorkflowsTabController.ts
 * - workflows/UgsWorkflowsToolbar.tsx
 * - workflows/UgsWorkflowsListSection.tsx
 * - services/api/ugs/ugsWorkflowExecutionPolling.ts
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { createAPIClient } from '../../services/api/client';
import type { NavigationHandler } from '../../types/navigation';
import { useUgsHubShellTheme } from './hub/ugsHubShellThemeContext';
import { ugsHubInlineLoadingPanelClasses } from './hub/ugsHubSharedUi';
import QuickExecuteModal from './workflows/QuickExecuteModal';
import type { UGSWorkflowsTabToast } from './workflows/types';
import { UgsWorkflowsListSection } from './workflows/UgsWorkflowsListSection';
import { UgsWorkflowsToolbar } from './workflows/UgsWorkflowsToolbar';
import { useUgsWorkflowsTabController } from './workflows/useUgsWorkflowsTabController';
import {
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from './workflows/ugsWorkflowsSharedUi';
import { cn } from './workflows/utils';

const UGSWorkflowsTab: FC<{
	onNavigate?: NavigationHandler;
	ugsClient: ReturnType<typeof createAPIClient>;
	toast: UGSWorkflowsTabToast;
}> = ({ onNavigate, ugsClient, toast }) => {
	const { t } = useTranslation('ugsHub');
	const shellTheme = useUgsHubShellTheme();
	const isLightShell = shellTheme === 'light';
	const controller = useUgsWorkflowsTabController({
		onNavigate,
		ugsClient,
		toast,
	});

	if (controller.loading) {
		return (
			<div
				className={cn(
					'flex items-center justify-center py-20',
					isLightShell && 'bg-(--desktop-surface-app)'
				)}
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<div className={ugsHubInlineLoadingPanelClasses(shellTheme)}>
					<ArrowPathIcon
						className={cn('h-8 w-8 animate-spin', ugsHubTextMuted(shellTheme))}
						strokeWidth={1.35}
						aria-hidden
					/>
					<span
						className={cn(
							'text-base font-medium',
							ugsHubTextPrimary(shellTheme)
						)}
					>
						{t('workflows.loading')}
					</span>
				</div>
			</div>
		);
	}

	return (
		<>
			<div
				className={cn(
					'min-w-0 space-y-3',
					isLightShell && 'text-(--desktop-text-primary)'
				)}
			>
				<UgsWorkflowsListSection
					controller={controller}
					toolbar={<UgsWorkflowsToolbar controller={controller} />}
				/>
			</div>

			<QuickExecuteModal
				workflow={controller.quickExecuteWorkflow}
				form={controller.quickExecuteForm}
				error={controller.quickExecuteError}
				submitting={controller.quickExecuteSubmitting}
				onClose={controller.closeQuickExecuteModal}
				onSubmit={() => {
					void controller.submitQuickExecute();
				}}
				onChange={controller.patchQuickExecuteForm}
			/>
		</>
	);
};

export default UGSWorkflowsTab;
