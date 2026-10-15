/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portaled modals for UGS Hub: generation, result preview, tariff reference.
 *
 * Invariants:
 * - Generation submit uses SSE stream via controller `startGeneration`.
 *
 * Related:
 * - components/UGSHub.tsx, hooks/ugsHub/useUgsHubGeneration.ts
 */

import { AnimatePresence } from 'framer-motion';

import type { UgsHubController } from '../../../../hooks/ugsHub/useUgsHubController';
import { UgsHubGenerationModal } from '../generation/UgsHubGenerationModal';
import { UgsHubResultModal } from './UgsHubResultModal';
import { UgsHubTariffModal } from './UgsHubTariffModal';

export interface UgsHubModalsProps {
	generation: UgsHubController['generation'];
	filterState: UgsHubController['filterState'];
	selectedResult: UgsHubController['selectedResult'];
	resultModalOpen: boolean;
	onCloseResult: () => void;
	loadingResult: boolean;
	selectedDisplayName: string;
	showUgsAdminLink: boolean;
	embeddedModalZ: { backdrop: number; content: number };
	tariffModalOpen: boolean;
	tariffGroups: UgsHubController['tariffGroups'];
	onCloseTariff: () => void;
	taskActions: UgsHubController['taskActions'];
}

export function UgsHubModals({
	generation,
	filterState,
	selectedResult,
	resultModalOpen,
	onCloseResult,
	loadingResult,
	selectedDisplayName,
	showUgsAdminLink,
	embeddedModalZ,
	tariffModalOpen,
	tariffGroups,
	onCloseTariff,
	taskActions,
}: UgsHubModalsProps) {
	const {
		showGenerationModal,
		selectedTypeForGeneration,
		customInputData,
		closeGenerationModal,
		startGeneration,
		generating,
	} = generation;

	const providerChannelLabel =
		selectedTypeForGeneration?.provider != null
			? (filterState.providerLabelMap[selectedTypeForGeneration.provider] ??
				selectedTypeForGeneration.provider)
			: null;

	return (
		<>
			<AnimatePresence>
				{showGenerationModal && selectedTypeForGeneration ? (
					<UgsHubGenerationModal
						open={showGenerationModal}
						type={selectedTypeForGeneration}
						providerChannelLabel={providerChannelLabel}
						inputData={customInputData}
						onClose={closeGenerationModal}
						onSubmit={startGeneration}
						generatingKey={generating}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{resultModalOpen && selectedResult ? (
					<UgsHubResultModal
						task={selectedResult}
						displayName={selectedDisplayName}
						loading={loadingResult}
						allowRawJson={showUgsAdminLink}
						backdropZ={embeddedModalZ.backdrop}
						contentZ={embeddedModalZ.content}
						onClose={onCloseResult}
						onDownload={() => void taskActions.downloadResult(selectedResult)}
						onCopy={taskActions.copyToClipboard}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{tariffModalOpen ? (
					<UgsHubTariffModal
						groups={tariffGroups}
						backdropZ={embeddedModalZ.backdrop}
						contentZ={embeddedModalZ.content}
						onClose={onCloseTariff}
					/>
				) : null}
			</AnimatePresence>
		</>
	);
}
