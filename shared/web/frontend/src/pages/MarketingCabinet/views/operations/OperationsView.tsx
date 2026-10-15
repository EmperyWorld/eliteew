/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose root for Marketing Cabinet Operations: empty-project guard and routing
 * between tasks and alerts sections.
 *
 * Invariants:
 * - Named export `OperationsView` preserved for marketingCabinetPageLazyImports.
 * - Public props match OperationsViewProps (no behavior change vs pre-split).
 *
 * Related:
 * - views/OperationsView.tsx (facade)
 * - useOperationsView.ts
 */

import { useTranslation } from 'react-i18next';
import { EmptyProjectState } from '../../components/EmptyProjectState';
import { OperationsAlertsSection } from './OperationsAlertsSection';
import { OperationsTasksSection } from './OperationsTasksSection';
import type { OperationsViewProps } from './operationsTypes';
import { useOperationsView } from './useOperationsView';

export function OperationsView(props: OperationsViewProps) {
	const { t } = useTranslation('marketing');
	const ops = useOperationsView(props);

	if (!props.selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('common.pickProjectTitle')}
				description={t('operationsView.emptyProjectDescription')}
			/>
		);
	}

	const projectId = props.selectedProjectId;

	if (props.section === 'tasks') {
		return <OperationsTasksSection ops={ops} projectId={projectId} />;
	}

	return <OperationsAlertsSection ops={ops} projectId={projectId} />;
}
