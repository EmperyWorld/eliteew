/** Пустой WebVTT: a11y — у media должен быть track, даже если субтитров нет. */
export const INLINE_EMPTY_CAPTIONS_VTT = `data:text/vtt;charset=utf-8,${encodeURIComponent('WEBVTT\n\n')}`;

export type DocInlinePreview =
	| {
			type: 'media';
			url: string;
			mime: string;
			title: string;
			approvalId: string;
	  }
	| {
			type: 'text';
			text: string;
			title: string;
			approvalId: string;
	  };

export function requireProjectId(id: string | null): string {
	if (!id) throw new Error('ClientInteractionView: missing project id');
	return id;
}

export function requireChatId(id: string | null): string {
	if (!id) throw new Error('ClientInteractionView: missing chat id');
	return id;
}
