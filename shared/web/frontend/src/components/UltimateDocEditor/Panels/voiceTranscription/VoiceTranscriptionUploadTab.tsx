/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Upload tab UI for VoiceTranscriptionPanel (audio file picker and empty state).
 *
 * Invariants:
 * - Hidden file input accepts audio/*; size gate enforced in hook handleFileUpload.
 *
 * Related:
 * - useVoiceTranscriptionPanel.ts, VoiceTranscriptionPanel.tsx
 */

import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import type { VoiceTranscriptionPanelVm } from './useVoiceTranscriptionPanel';

export function VoiceTranscriptionUploadTab({
	vm,
}: {
	vm: VoiceTranscriptionPanelVm;
}) {
	const { t, fileInputRef, handleFileUpload } = vm;

	return (
		<div className="flex h-full min-w-0 flex-col items-center justify-center p-8">
			<DesktopAppPanel className="w-full max-w-xl min-w-0 border-dashed bg-transparent">
				<DesktopAppEmptyState
					icon={
						<ArrowUpTrayIcon
							width={64}
							height={64}
							className="text-(--desktop-text-dim)"
						/>
					}
					title={t('voice.empty.uploadTitle')}
					description={t('voice.empty.uploadDesc')}
					className="py-10"
				>
					<input
						ref={fileInputRef}
						type="file"
						accept="audio/*"
						multiple
						onChange={handleFileUpload}
						aria-label={t('voice.uploadAudioInputAria')}
						className="hidden"
					/>
					<DesktopAppButton
						onClick={() => fileInputRef.current?.click()}
						variant="accent"
						className="px-6 py-3"
					>
						{t('voice.empty.uploadChoose')}
					</DesktopAppButton>
				</DesktopAppEmptyState>
			</DesktopAppPanel>
		</div>
	);
}
