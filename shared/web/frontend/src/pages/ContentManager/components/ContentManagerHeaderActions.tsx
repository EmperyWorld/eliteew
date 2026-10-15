/**
 * Header toolbar: refresh list, upload, download owned archive (+ hidden file input).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopWindowStyle } from '../../../types/profile';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../Desktop/components/DesktopAppChrome';
import { getDesktopShellToolbarClusterClassName } from '../../Desktop/utils/desktopVisualSystem';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	CubeIcon,
} from '@heroicons/react/24/outline';

export interface ContentManagerHeaderActionsProps {
	embedded: boolean;
	/** Вертикальный блок на всю ширину (левая колонка desktop). */
	railLayout?: boolean;
	shellFrame: DesktopWindowStyle;
	fetchContent: () => void | Promise<void>;
	loading: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	onFileUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	uploading: boolean;
	uploadProgress: number;
	/** При загрузке нескольких файлов — текущий индекс и всего (для подписи кнопки). */
	uploadBatch: { current: number; total: number } | null;
	onDownloadOwnedArchive: () => void;
	downloadingOwnedArchive: boolean;
	statsLoading: boolean;
	ownedFilesCount: number;
}

export const ContentManagerHeaderActions: React.FC<
	ContentManagerHeaderActionsProps
> = ({
	embedded,
	railLayout = false,
	shellFrame,
	fetchContent,
	loading,
	fileInputRef,
	onFileUploadChange,
	uploading,
	uploadProgress,
	uploadBatch,
	onDownloadOwnedArchive,
	downloadingOwnedArchive,
	statsLoading,
	ownedFilesCount,
}) => {
	const { t } = useTranslation('contentManager');
	const uploadTitle = uploading
		? uploadBatch && uploadBatch.total > 1
			? t('files.toolbar.uploadingBatch', {
					current: uploadBatch.current,
					total: uploadBatch.total,
					percent: uploadProgress,
				})
			: `${uploadProgress}%`
		: t('files.toolbar.upload');
	const uploadAria = uploading ? uploadTitle : t('files.toolbar.uploadAria');

	const showRailStack = railLayout;
	const compactChrome = embedded && !showRailStack;

	return (
		<>
			<div className={cn(embedded ? 'min-w-0 shrink-0' : undefined)}>
				<div
					data-cm-guide="header-actions"
					className={cn(
						'min-w-0 gap-1.5 p-1',
						showRailStack
							? cn(
									'flex w-full flex-col rounded-(--desktop-radius)',
									DESKTOP_APP_STYLE_CONTRACT.softCard
								)
							: embedded
								? getDesktopShellToolbarClusterClassName(shellFrame)
								: DESKTOP_APP_STYLE_CONTRACT.softCard,
						!showRailStack &&
							(embedded
								? 'flex max-w-full flex-wrap items-center rounded-(--desktop-radius)'
								: 'flex flex-wrap items-center rounded-(--desktop-radius)')
					)}
				>
					<DesktopAppButton
						onClick={() => void fetchContent()}
						disabled={loading}
						variant="neutral"
						size={showRailStack ? 'sm' : 'icon'}
						className={cn(
							'shrink-0',
							showRailStack
								? 'h-9 w-full justify-start gap-2 px-3'
								: compactChrome
									? 'h-8 w-8 min-h-8 min-w-8'
									: 'h-10 w-10'
						)}
						title={t('files.toolbar.refresh')}
						aria-label={t('files.toolbar.refresh')}
					>
						<ArrowPathIcon
							className={`w-4 h-4 shrink-0 text-(--desktop-text-secondary) ${loading ? 'animate-spin' : ''}`}
						/>
						{showRailStack ? (
							<span className="min-w-0 truncate">
								{t('files.toolbar.refresh')}
							</span>
						) : null}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						variant="accent"
						size={showRailStack ? 'sm' : embedded ? 'icon' : undefined}
						title={uploadTitle}
						aria-label={uploadAria}
						className={cn(
							'shrink-0 font-medium shadow-(--desktop-shadow-soft)',
							showRailStack
								? 'h-9 w-full justify-start gap-2 px-3'
								: embedded
									? 'h-8 w-8 min-h-8 min-w-8'
									: 'px-4 py-2.5 text-sm'
						)}
					>
						{uploading ? (
							<>
								<ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" />
								{!embedded || showRailStack ? (
									<span className="min-w-0 truncate">
										{uploadBatch && uploadBatch.total > 1
											? t('files.toolbar.uploadingBatch', {
													current: uploadBatch.current,
													total: uploadBatch.total,
													percent: uploadProgress,
												})
											: `${uploadProgress}%`}
									</span>
								) : null}
							</>
						) : (
							<>
								<ArrowUpTrayIcon className="h-4 w-4 shrink-0" />
								{!embedded || showRailStack ? (
									<span className="min-w-0 truncate">
										{t('files.toolbar.upload')}
									</span>
								) : null}
							</>
						)}
					</DesktopAppButton>
					<DesktopAppButton
						onClick={onDownloadOwnedArchive}
						disabled={
							downloadingOwnedArchive || statsLoading || ownedFilesCount === 0
						}
						variant="neutral"
						size={showRailStack ? 'sm' : embedded ? 'icon' : undefined}
						title={t('files.toolbar.downloadOwnedArchiveAria')}
						aria-label={t('files.toolbar.downloadOwnedArchiveAria')}
						className={cn(
							'shrink-0 font-medium',
							showRailStack
								? 'h-9 w-full justify-start gap-2 px-3'
								: embedded
									? 'h-8 w-8 min-h-8 min-w-8'
									: 'px-4 py-2.5 text-sm'
						)}
					>
						{downloadingOwnedArchive ? (
							<>
								<ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" />
								{!embedded || showRailStack ? (
									<span className="min-w-0 truncate">
										{t('files.toolbar.downloadingOwnedArchive')}
									</span>
								) : null}
							</>
						) : (
							<>
								<CubeIcon className="h-4 w-4 shrink-0" />
								{!embedded || showRailStack ? (
									<span className="min-w-0 truncate">
										{t('files.toolbar.downloadOwnedArchive')}
									</span>
								) : null}
							</>
						)}
					</DesktopAppButton>
				</div>
			</div>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				onChange={onFileUploadChange}
				className="hidden"
				aria-label={t('files.toolbar.uploadAria')}
			/>
		</>
	);
};
