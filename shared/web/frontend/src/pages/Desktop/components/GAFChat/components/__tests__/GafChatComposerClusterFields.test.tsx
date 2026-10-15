/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Autofill/a11y guard: GAF Chat composer textarea has id and name.
 *
 * Related:
 * - pages/Desktop/components/GAFChat/components/GafChatComposerCluster.tsx
 */

import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GafChatThreadPrefs } from '../../gafChatThreadPrefs';
import { GafChatComposerCluster } from '../GafChatComposerCluster';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../gafChatMapUserError', () => ({
	mapGafChatUserError: () => 'send-error',
}));

const defaultPrefs: GafChatThreadPrefs = {
	loadMedia: true,
	showMediaPreview: true,
};

describe('GafChatComposerCluster fields', () => {
	it('exposes id and name on the composer textarea', () => {
		render(
			<GafChatComposerCluster
				composerLocked={false}
				chatBlocked={false}
				partnerIsSystemAccount={false}
				shellComposerFormClass=""
				shellComposerTextareaClass=""
				shellComposerHintRowClass=""
				composerDragOver={false}
				selectedChatId="chat-1"
				localAttachInputRef={createRef<HTMLInputElement>()}
				inputRef={createRef<HTMLTextAreaElement>()}
				inputText=""
				onInputTextChange={vi.fn()}
				onSend={vi.fn()}
				onComposerDragEnter={vi.fn()}
				onComposerDragLeave={vi.fn()}
				onComposerDragOver={vi.fn()}
				onComposerDrop={vi.fn()}
				onComposerPaste={vi.fn()}
				onPickLocalFile={vi.fn()}
				replyingTo={null}
				onClearReply={vi.fn()}
				pendingAttachments={[]}
				onRemovePendingAttachment={vi.fn()}
				threadPrefs={defaultPrefs}
				isVoiceRecording={false}
				isVoiceRecordingSupported={false}
				voiceElapsedSec={0}
				onCancelVoiceRecording={vi.fn()}
				onBeginVoiceRecording={vi.fn()}
				onFinishVoiceRecording={vi.fn()}
				attachmentUploading={false}
				attachmentUploadPercent={null}
				sendPending={false}
				sendError={null}
				sendVariables={null}
				onRetrySend={vi.fn()}
				onDismissSendError={vi.fn()}
				isGafAdmin={false}
				onOpenContentLibraryPicker={vi.fn()}
				onOpenAdminAppLinkPicker={vi.fn()}
			/>
		);

		const textarea = screen.getByLabelText('composerAria');
		expect(textarea).toHaveAttribute('id');
		expect(textarea).toHaveAttribute('name', 'gaf-chat-composer-message');
	});
});
