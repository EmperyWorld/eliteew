/**
 * Modal: pick image, video, or audio from Content Manager for EWDesk news.
 */
import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { ContentType } from '@/types/fileExchange';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export type EwDeskContentPickerMediaType = 'image' | 'video' | 'audio';

type PickerBaseProps = {
	open: boolean;
	onClose: () => void;
	onSelect: (contentId: string) => void;
};

const MEDIA_TO_CONTENT_TYPE: Record<
	EwDeskContentPickerMediaType,
	(typeof ContentType)[keyof typeof ContentType]
> = {
	image: ContentType.IMAGE,
	video: ContentType.VIDEO,
	audio: ContentType.AUDIO,
};

export function EwDeskContentMediaPicker({
	open,
	onClose,
	onSelect,
	mediaType,
}: PickerBaseProps & {
	mediaType: EwDeskContentPickerMediaType;
}): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDeskAdmin' });
	const contentType = MEDIA_TO_CONTENT_TYPE[mediaType];
	const title =
		mediaType === 'video'
			? t('videoPickerTitle')
			: mediaType === 'audio'
				? t('audioPickerTitle')
				: t('contentPickerTitle');

	return (
		<UnifiedContentPickerModal
			open={open}
			onClose={onClose}
			onConfirm={(items) => {
				const id = items[0]?.id;
				if (id) {
					onSelect(id);
				}
			}}
			mode="single"
			maxFiles={1}
			baseListParams={{
				content_type: contentType,
				owner_only: true,
				limit: 150,
				offset: 0,
				sort_field: 'date',
				sort_order: 'desc',
			}}
			hideTypeFilter
			compact
			frameClassName="max-w-lg"
			title={title}
			portalZIndex={DESKTOP_Z_INDEX.MODAL}
		/>
	);
}

export function EwDeskContentImagePicker(
	props: PickerBaseProps
): React.ReactElement | null {
	return <EwDeskContentMediaPicker {...props} mediaType="image" />;
}

export function EwDeskContentVideoPicker(
	props: PickerBaseProps
): React.ReactElement | null {
	return <EwDeskContentMediaPicker {...props} mediaType="video" />;
}

export function EwDeskContentAudioPicker(
	props: PickerBaseProps
): React.ReactElement | null {
	return <EwDeskContentMediaPicker {...props} mediaType="audio" />;
}
