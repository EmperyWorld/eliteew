/**
 * FileGrabber — выбор файлов из Unified Content.
 * Модальный режим: `UnifiedContentPickerModal`. Встроенный: только `UnifiedContentPickerPanel`.
 */
import { UnifiedContentPickerModal } from '@/components/UnifiedContent/picker/UnifiedContentPickerModal';
import { UnifiedContentPickerPanel } from '@/components/UnifiedContent/picker/UnifiedContentPickerPanel';
import { useUnifiedContentPickerController } from '@/components/UnifiedContent/picker/useUnifiedContentPickerController';
import { useNotifications } from '@/notifications';
import { createFileId, type FileGrabberProps } from '@/types/fileExchange';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const baseListParamsDefault = {
	limit: 150,
	offset: 0,
	sort_field: 'date' as const,
	sort_order: 'desc' as const,
};

const FileGrabber: React.FC<FileGrabberProps> = ({
	isOpen,
	onClose,
	onSelect,
	multiSelect = true,
	fileTypes = [],
	maxFiles = 10,
	embedded = false,
}) => {
	const { toast } = useNotifications();
	const { t } = useTranslation('unifiedContentPicker');
	const baseListParams = useMemo(() => ({ ...baseListParamsDefault }), []);
	const allowedContentTypes = fileTypes.length > 0 ? fileTypes : undefined;

	const ctrl = useUnifiedContentPickerController({
		enabled: isOpen && embedded,
		baseListParams,
		allowedContentTypes,
		multiSelect,
		maxFiles,
	});

	const onMax = useCallback(() => {
		toast.warning(t('maxSelection', { max: maxFiles }));
	}, [toast, t, maxFiles]);

	const handleConfirmEmbedded = useCallback(() => {
		const ids = ctrl.toFileIds(ctrl.selectedIds);
		if (ids.length === 0) {
			return;
		}
		onSelect(ids);
		toast.success(
			t('selectionSuccess'),
			t('selectionSuccessDetail', { count: ids.length })
		);
		ctrl.clearSelection();
		onClose();
	}, [ctrl, onSelect, onClose, toast, t]);

	const handleCancelEmbedded = useCallback(() => {
		ctrl.clearSelection();
		onClose();
	}, [ctrl, onClose]);

	if (!isOpen) {
		return null;
	}

	if (embedded) {
		const isBusy =
			ctrl.query.isPending ||
			(ctrl.query.isFetching && !ctrl.query.data?.items?.length);

		return (
			<UnifiedContentPickerPanel
				compact
				embedded
				hideTopHeader
				filteredItems={ctrl.filteredItems}
				isLoading={isBusy}
				isFetching={ctrl.query.isFetching}
				isError={ctrl.query.isError}
				errorMessage={
					ctrl.query.error instanceof Error
						? ctrl.query.error.message
						: String(ctrl.query.error ?? '')
				}
				onRetry={() => void ctrl.query.refetch()}
				searchQuery={ctrl.searchQuery}
				onSearchChange={ctrl.setSearchQuery}
				searchPending={ctrl.searchPending}
				showTypeFilter
				filterType={ctrl.filterType}
				onFilterTypeChange={ctrl.setFilterType}
				availableTypes={ctrl.availableTypes}
				multiSelect={multiSelect}
				maxFiles={maxFiles}
				selectedIds={ctrl.selectedIds}
				onToggleId={(id) => ctrl.toggleId(id, onMax)}
				onSelectAllVisible={ctrl.selectAllVisible}
				onDeselectAll={ctrl.deselectAll}
				onConfirm={handleConfirmEmbedded}
				onCancel={handleCancelEmbedded}
				showFooter
			/>
		);
	}

	return (
		<UnifiedContentPickerModal
			open={isOpen}
			onClose={onClose}
			onConfirm={(items) => {
				onSelect(items.map((i) => createFileId(i.id)));
				toast.success(
					t('selectionSuccess'),
					t('selectionSuccessDetail', { count: items.length })
				);
			}}
			mode={multiSelect ? 'multi' : 'single'}
			maxFiles={maxFiles}
			allowedContentTypes={allowedContentTypes}
			baseListParams={baseListParams}
			onMaxSelection={onMax}
		/>
	);
};

export default FileGrabber;
