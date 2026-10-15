/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KIRS curation page compose root: shell layout, guided tour, delete modal.
 *
 * Invariants:
 * - Named export KirsPage and default export both preserved for lazyImports.
 * - KIRS_CURATION_GUIDE_ROOT_ID and guide modal wiring unchanged.
 *
 * Related:
 * - ../KirsPage.tsx (facade)
 * - useKirsPage.ts
 * - documentation/product/KIRS-SITE-CURATION.md
 */

import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DESKTOP_APP_STYLE_CONTRACT } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import * as React from 'react';
import {
	KIRS_CURATION_GUIDE_AUDIO_LS_KEY,
	KIRS_CURATION_GUIDE_ROOT_ID,
	KIRS_CURATION_GUIDE_TOUR_FOLDER,
} from '../kirsCurationGuideConstants';
import { KirsDetailPanel } from './KirsDetailPanel';
import { KirsPageToolbar } from './KirsPageToolbar';
import { KirsProjectsListPanel } from './KirsProjectsListPanel';
import { useKirsPage } from './useKirsPage';

export const KirsPage: React.FC = () => {
	const k = useKirsPage();

	return (
		<div
			id={KIRS_CURATION_GUIDE_ROOT_ID}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.shell,
				'flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4'
			)}
		>
			<KirsPageToolbar k={k} />

			<div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,280px)_1fr]">
				<KirsProjectsListPanel k={k} />
				<KirsDetailPanel k={k} />
			</div>

			<SpotlightGuideModal
				open={k.guideOpen}
				onClose={() => k.setGuideOpen(false)}
				rootId={KIRS_CURATION_GUIDE_ROOT_ID}
				steps={k.guideSteps}
				audioLocalStorageKey={KIRS_CURATION_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={KIRS_CURATION_GUIDE_TOUR_FOLDER}
				labels={k.guideLabels}
				onPrepareStep={k.prepareGuideStep}
				spotlightLayoutKey={`${k.guideOpen}-${k.selectedId ?? 'none'}-${k.panelTab}`}
				dialogTitleId="kirs-curation-guide-title"
			/>
			<ConfirmDeleteModal
				isOpen={k.pendingKirsDelete !== null}
				onClose={() => {
					if (!k.deleteMut.isPending) k.setPendingKirsDelete(null);
				}}
				onConfirm={k.confirmKirsDelete}
				title={
					k.pendingKirsDelete === 'wipe_disk'
						? 'Удаление инстанса с диска'
						: k.pendingKirsDelete === 'keep_runtime_dir'
							? 'Удаление записи инстанса'
							: ''
				}
				warningMessage={
					k.pendingKirsDelete === 'wipe_disk'
						? 'Удалить инстанс с диска? Данные bind-монтов будут удалены. Отмена — оставить файлы.'
						: k.pendingKirsDelete === 'keep_runtime_dir'
							? 'Остановить контейнеры и удалить запись, но сохранить каталог runtime на диске?'
							: ''
				}
				confirmButtonLabel="Удалить"
				confirmButtonLoadingLabel="Удаление…"
				cancelButtonLabel="Отмена"
			/>
		</div>
	);
};

export default KirsPage;
