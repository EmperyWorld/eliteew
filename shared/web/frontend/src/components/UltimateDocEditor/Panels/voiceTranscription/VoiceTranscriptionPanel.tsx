/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose VoiceTranscriptionPanel: hook vm + modal shell + record/upload/synth tabs.
 *
 * Invariants:
 * - Early return null when !isOpen; embedded modal z-index from useEmbeddedPortaledModalZIndex.
 *
 * Related:
 * - Panels/VoiceTranscriptionPanel.tsx (facade), useVoiceTranscriptionPanel.ts
 */

import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import * as React from 'react';
import type { VoiceTranscriptionPanelProps } from '../../types/editor.types';
import { useVoiceTranscriptionPanel } from './useVoiceTranscriptionPanel';
import { VoiceTranscriptionModalShell } from './VoiceTranscriptionModalShell';
import { VoiceTranscriptionRecordTab } from './VoiceTranscriptionRecordTab';
import { VoiceTranscriptionSynthTab } from './VoiceTranscriptionSynthTab';
import { VoiceTranscriptionUploadTab } from './VoiceTranscriptionUploadTab';

export const VoiceTranscriptionPanel: React.FC<VoiceTranscriptionPanelProps> = (
	props
) => {
	const { isOpen, onClose } = props;
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const vm = useVoiceTranscriptionPanel(props);

	if (!isOpen) {
		return null;
	}

	return (
		<VoiceTranscriptionModalShell
			isOpen={isOpen}
			onClose={onClose}
			t={vm.t}
			embeddedModalZ={embeddedModalZ}
			mode={vm.mode}
			setMode={vm.setMode}
		>
			{vm.mode === 'record' && <VoiceTranscriptionRecordTab vm={vm} />}
			{vm.mode === 'upload' && <VoiceTranscriptionUploadTab vm={vm} />}
			{vm.mode === 'synthesize' && <VoiceTranscriptionSynthTab vm={vm} />}
		</VoiceTranscriptionModalShell>
	);
};
