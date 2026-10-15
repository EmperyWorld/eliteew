/**
 * DataExport Component
 * Complete data export functionality with GDPR compliance
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
	DataExportRequest,
	DataExportResponse,
} from '../../types/profile';
import { formatDate, formatFileSize } from '../../types/profile';
import { ConfirmDeleteModal } from '../ui/modals/ConfirmDeleteModal';
import profileService from '../../services/profileService';
import FileGrabber from '../file-exchange/FileGrabber';
import FileVisualizer from '../file-exchange/FileVisualizer';
import {
	ContentType,
	createFileId,
	type FileId,
} from '../../types/fileExchange';
import { apiClient } from '../../services/api';
import { log } from '../../utils/logger';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
	CheckCircleIcon,
	CheckIcon,
	ClockIcon,
	CubeIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	FolderOpenIcon,
	SignalIcon,
	SparklesIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export default function DataExport(): JSX.Element {
	const [exportConfig, setExportConfig] = useState<DataExportRequest>({
		include_profile: true,
		include_chat_history: true,
		include_content: true,
		include_ai_generations: true,
		include_activity_log: true,
		format: 'json',
	});

	const [isRequesting, setIsRequesting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [currentExport, setCurrentExport] = useState<DataExportResponse | null>(
		null
	);
	const [exportHistory, setExportHistory] = useState<DataExportResponse[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [deletingExportId, setDeletingExportId] = useState<string | null>(null);

	// File Exchange integration state
	const [isFileGrabberOpen, setIsFileGrabberOpen] = useState(false);
	const [savedExportFileId, setSavedExportFileId] = useState<FileId | null>(
		null
	);
	const [isSavingToFileExchange, setIsSavingToFileExchange] = useState(false);

	const loadExportHistory = useCallback(async (): Promise<void> => {
		setIsLoadingHistory(true);
		try {
			const history = await profileService.getExportHistory();
			setExportHistory(history);
		} catch (err: unknown) {
			log.error(
				'DataExport',
				'Failed to load export history',
				err instanceof Error ? err : new Error(String(err))
			);
		} finally {
			setIsLoadingHistory(false);
		}
	}, []);

	// Load export history
	useEffect(() => {
		void loadExportHistory();
	}, [loadExportHistory]);

	// Poll current export status
	useEffect(() => {
		if (
			!currentExport ||
			currentExport.status === 'completed' ||
			currentExport.status === 'failed'
		) {
			return;
		}

		const interval = setInterval(async () => {
			try {
				const status = await profileService.getExportStatus(
					currentExport.export_id
				);
				setCurrentExport(status);

				if (status.status === 'completed' || status.status === 'failed') {
					await loadExportHistory();
				}
			} catch (err: unknown) {
				log.error(
					'DataExport',
					'Failed to poll export status',
					err instanceof Error ? err : new Error(String(err))
				);
			}
		}, 3000);

		return (): void => clearInterval(interval);
	}, [currentExport, loadExportHistory]);

	const handleRequestExport = async (): Promise<void> => {
		setIsRequesting(true);
		setError(null);

		try {
			const response = await profileService.requestDataExport(exportConfig);
			setCurrentExport(response);
			await loadExportHistory();
		} catch (err: unknown) {
			log.error(
				'DataExport',
				'Failed to request export',
				err instanceof Error ? err : new Error(String(err))
			);
			const errorMessage =
				err &&
				typeof err === 'object' &&
				'response' in err &&
				err.response &&
				typeof err.response === 'object' &&
				'data' in err.response &&
				err.response.data &&
				typeof err.response.data === 'object' &&
				'message' in err.response.data &&
				typeof err.response.data.message === 'string'
					? err.response.data.message
					: 'Не удалось создать экспорт';
			setError(errorMessage);
		} finally {
			setIsRequesting(false);
		}
	};

	const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

	const handleDownload = async (exportId: string): Promise<void> => {
		try {
			const blob = await profileService.downloadExport(exportId);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `user-data-export-${exportId}.${exportConfig.format}`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('DataExport', 'Failed to download export', error);
			setError('Не удалось скачать файл');
		}
	};

	const handleDeleteExport = async (exportId: string): Promise<void> => {
		setDeletingExportId(exportId);
		setError(null);

		try {
			await profileService.deleteExport(exportId);
			await loadExportHistory();

			if (currentExport?.export_id === exportId) {
				setCurrentExport(null);
			}
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('DataExport', 'Failed to delete export', error);
			setError('Не удалось удалить экспорт');
		} finally {
			setDeletingExportId(null);
		}
	};

	// ArrowDownTrayIcon export to Unified Content (File Exchange)
	const handleSaveToFileExchange = async (exportId: string): Promise<void> => {
		setIsSavingToFileExchange(true);
		setError(null);

		try {
			// ArrowDownTrayIcon export blob
			const blob = await profileService.downloadExport(exportId);

			// Create File object
			const filename = `user-data-export-${exportId}.${exportConfig.format}`;
			const file = new File([blob], filename, { type: blob.type });

			// Upload to Unified Content
			const formData = new FormData();
			formData.append('file', file);
			formData.append('name', filename);
			formData.append('visibility', 'private');
			formData.append(
				'tags',
				JSON.stringify(['export', 'data-export', 'gdpr', exportConfig.format])
			);

			const response = await apiClient.post('/api/v1/content', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});

			if (
				response.status === 201 &&
				response.data &&
				typeof response.data === 'object' &&
				'id' in response.data &&
				typeof response.data.id === 'string'
			) {
				const contentId = response.data.id;
				setSavedExportFileId(createFileId(contentId));
				log.info('DataExport', 'Export saved to File Exchange', { contentId });
			}
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('DataExport', 'Failed to save export to File Exchange', error);
			setError('Не удалось сохранить экспорт в File Exchange');
		} finally {
			setIsSavingToFileExchange(false);
		}
	};

	// Browse exports from Unified Content
	const handleBrowseExports = (): void => {
		setIsFileGrabberOpen(true);
	};

	// ArrowDownTrayIcon selected export from Unified Content
	const handleDownloadFromFileExchange = async (
		fileIds: readonly FileId[]
	): Promise<void> => {
		if (fileIds.length === 0) {
			return;
		}

		try {
			const fileId = fileIds[0] as string;
			const response = await apiClient.get(`/api/v1/content/${fileId}`, {
				responseType: 'json',
			});

			if (
				!response.data ||
				typeof response.data !== 'object' ||
				!('name' in response.data)
			) {
				throw new Error('Invalid response data');
			}
			const fileData = response.data as { name: string };
			await handleDownloadContentFile(fileId, fileData.name);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('DataExport', 'Failed to download from File Exchange', error);
			setError('Не удалось скачать файл из File Exchange');
		}

		setIsFileGrabberOpen(false);
	};

	// ArrowDownTrayIcon file from Unified Content
	const handleDownloadContentFile = async (
		contentId: string,
		filename: string
	): Promise<void> => {
		try {
			const response = await apiClient.get(
				`/api/v1/content/${contentId}/download`,
				{
					responseType: 'blob',
				}
			);

			const url = URL.createObjectURL(new Blob([response.data]));
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err: unknown) {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('DataExport', 'Failed to download file', error);
			setError('Не удалось скачать файл');
		}
	};

	const getStatusColor = (status: string): string => {
		const colors: Record<string, string> = {
			pending: 'yellow',
			processing: 'blue',
			completed: 'green',
			failed: 'red',
		};
		return colors[status] || 'gray';
	};

	const getStatusIcon = (status: string): React.ReactNode => {
		const icons: Record<string, React.ReactNode> = {
			pending: <ClockIcon className="w-5 h-5" />,
			processing: <ArrowPathIcon className="w-5 h-5 animate-spin" />,
			completed: <CheckCircleIcon className="w-5 h-5" />,
			failed: <ExclamationCircleIcon className="w-5 h-5" />,
		};
		return icons[status] || <CubeIcon className="w-5 h-5" />;
	};

	const getStatusLabel = (status: string): string => {
		const labels: Record<string, string> = {
			pending: 'В очереди',
			processing: 'Обработка',
			completed: 'Готов',
			failed: 'Ошибка',
		};
		return labels[status] || status;
	};

	const hasAnyDataSelected = Object.values(exportConfig).some(
		(value, index) => index < 5 && value === true
	);

	return (
		<div className="space-y-6">
			{/* Error banner */}
			<AnimatePresence>
				{error && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center gap-3"
					>
						<ExclamationCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
						<p className="text-red-400 flex-1">{error}</p>
						<button
							type="button"
							onClick={() => setError(null)}
							className="text-red-400 hover:text-red-300 transition-colors"
						>
							<XMarkIcon className="w-5 h-5" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Info */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-6"
			>
				<div className="flex items-start gap-3">
					<CubeIcon className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
					<div>
						<h3 className="text-lg font-bold text-white mb-2">
							Экспорт ваших данных
						</h3>
						<p className="text-blue-400/80 text-sm mb-3">
							В соответствии с GDPR, вы имеете право получить копию всех ваших
							данных. Выберите категории данных и формат экспорта.
						</p>
						<ul className="space-y-1 text-blue-400/80 text-sm">
							<li>• Процесс экспорта может занять несколько минут</li>
							<li>• Файл будет доступен для скачивания в течение 7 дней</li>
							<li>• Вы можете создать новый экспорт в любое время</li>
							<li>
								• Сохраняйте экспорты в File Exchange для долгосрочного хранения
							</li>
						</ul>
					</div>
				</div>
			</motion.div>

			{/* File Exchange Integration */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.025 }}
				className="bg-purple-500/10 border border-purple-500/50 rounded-xl p-6"
			>
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3 flex-1">
						<FolderOpenIcon className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
						<div className="flex-1">
							<h3 className="text-lg font-bold text-white mb-2">
								File Exchange Integration
							</h3>
							<p className="text-purple-400/80 text-sm mb-3">
								Сохраняйте экспорты в Unified Content для постоянного хранения,
								управления версиями и совместного использования.
							</p>

							{savedExportFileId && (
								<div className="mb-3">
									<p className="text-sm text-purple-400 mb-2">
										Последний сохраненный экспорт:
									</p>
									<FileVisualizer
										fileId={savedExportFileId}
										onRemove={() => setSavedExportFileId(null)}
									/>
								</div>
							)}
						</div>
					</div>

					<button
						type="button"
						onClick={handleBrowseExports}
						className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 rounded-lg transition-all flex items-center gap-2"
					>
						<FolderOpenIcon className="w-4 h-4" />
						Обзор экспортов
					</button>
				</div>
			</motion.div>

			{/* Export Configuration */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.05 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<DocumentTextIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">
						Выберите данные для экспорта
					</h2>
				</div>

				<div className="space-y-3 mb-6">
					<ExportOption
						icon={<DocumentTextIcon className="w-5 h-5" />}
						label="Информация профиля"
						description="Имя, email, настройки, аватар"
						checked={exportConfig.include_profile}
						onChange={(checked) =>
							setExportConfig({ ...exportConfig, include_profile: checked })
						}
					/>

					<ExportOption
						icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
						label="История чатов"
						description="Все сообщения и диалоги"
						checked={exportConfig.include_chat_history}
						onChange={(checked) =>
							setExportConfig({
								...exportConfig,
								include_chat_history: checked,
							})
						}
					/>

					<ExportOption
						icon={<DocumentTextIcon className="w-5 h-5" />}
						label="Контент"
						description="Созданные документы и файлы"
						checked={exportConfig.include_content}
						onChange={(checked) =>
							setExportConfig({ ...exportConfig, include_content: checked })
						}
					/>

					<ExportOption
						icon={<SparklesIcon className="w-5 h-5" />}
						label="AI генерации"
						description="История AI запросов и ответов"
						checked={exportConfig.include_ai_generations}
						onChange={(checked) =>
							setExportConfig({
								...exportConfig,
								include_ai_generations: checked,
							})
						}
					/>

					<ExportOption
						icon={<SignalIcon className="w-5 h-5" />}
						label="Лог активности"
						description="История действий в системе"
						checked={exportConfig.include_activity_log}
						onChange={(checked) =>
							setExportConfig({
								...exportConfig,
								include_activity_log: checked,
							})
						}
					/>
				</div>

				{/* Format selection */}
				<fieldset className="mb-6">
					<legend className="block text-sm font-medium text-white/80 mb-3">
						Формат файла
					</legend>
					<div className="grid grid-cols-3 gap-3">
						{(['json', 'csv', 'pdf'] as const).map((format) => (
							<button
								type="button"
								key={format}
								onClick={() => setExportConfig({ ...exportConfig, format })}
								className={`p-4 rounded-lg border transition-all ${
									exportConfig.format === format
										? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
										: 'bg-white/5 border-white/10 text-white/80 hover:border-white/20'
								}`}
							>
								<span className="uppercase font-bold">{format}</span>
							</button>
						))}
					</div>
				</fieldset>

				{/* Request button */}
				<button
					type="button"
					onClick={handleRequestExport}
					disabled={!hasAnyDataSelected || isRequesting}
					className="w-full px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isRequesting ? (
						<>
							<ArrowPathIcon className="w-5 h-5 animate-spin" />
							Создание экспорта...
						</>
					) : (
						<>
							<ArrowDownTrayIcon className="w-5 h-5" />
							Создать экспорт
						</>
					)}
				</button>
			</motion.div>

			{/* Current Export Status */}
			{currentExport && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
				>
					<div className="flex items-center gap-3 mb-4">
						<div className={`text-${getStatusColor(currentExport.status)}-400`}>
							{getStatusIcon(currentExport.status)}
						</div>
						<div className="flex-1">
							<h3 className="text-lg font-bold text-white">Текущий экспорт</h3>
							<p className="text-white/60 text-sm">
								Статус: {getStatusLabel(currentExport.status)}
							</p>
						</div>
					</div>

					{currentExport.status === 'completed' &&
						currentExport.download_url && (
							<div className="space-y-3">
								<button
									type="button"
									onClick={() => handleDownload(currentExport.export_id)}
									className="w-full px-6 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg transition-all flex items-center justify-center gap-2"
								>
									<ArrowDownTrayIcon className="w-5 h-5" />
									Скачать файл
									{currentExport.file_size && (
										<span className="text-sm">
											({formatFileSize(currentExport.file_size)})
										</span>
									)}
								</button>

								<button
									type="button"
									onClick={() =>
										handleSaveToFileExchange(currentExport.export_id)
									}
									disabled={isSavingToFileExchange}
									className="w-full px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSavingToFileExchange ? (
										<>
											<ArrowPathIcon className="w-5 h-5 animate-spin" />
											Сохранение в File Exchange...
										</>
									) : (
										<>
											<ArrowDownTrayIcon className="w-5 h-5" />
											Сохранить в File Exchange
										</>
									)}
								</button>
							</div>
						)}

					{currentExport.status === 'failed' && (
						<div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
							Произошла ошибка при создании экспорта. Попробуйте снова.
						</div>
					)}
				</motion.div>
			)}

			{/* Export History */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
				className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
			>
				<div className="flex items-center gap-3 mb-6">
					<ClockIcon className="w-5 h-5 text-blue-400" />
					<h2 className="text-xl font-bold text-white">История экспортов</h2>
				</div>

				{isLoadingHistory ? (
					<div className="flex items-center justify-center py-12">
						<ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
					</div>
				) : exportHistory.length === 0 ? (
					<div className="text-center py-12">
						<CubeIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
						<p className="text-white/60">История пуста</p>
					</div>
				) : (
					<div className="space-y-3">
						{exportHistory.map((exp) => (
							<div
								key={exp.export_id}
								className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-4"
							>
								<div className={`text-${getStatusColor(exp.status)}-400`}>
									{getStatusIcon(exp.status)}
								</div>

								<div className="flex-1">
									<p className="text-white font-medium mb-1">
										Экспорт от {formatDate(exp.created_at)}
									</p>
									<p className="text-white/60 text-sm">
										Статус: {getStatusLabel(exp.status)}
										{exp.file_size && ` • ${formatFileSize(exp.file_size)}`}
										{exp.expires_at &&
											` • Истекает ${formatDate(exp.expires_at)}`}
									</p>
								</div>

								<div className="flex gap-2">
									{exp.status === 'completed' && exp.download_url && (
										<button
											type="button"
											onClick={() => handleDownload(exp.export_id)}
											className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg transition-all flex items-center gap-2"
										>
											<ArrowDownTrayIcon className="w-4 h-4" />
											Скачать
										</button>
									)}

									<button
										type="button"
										onClick={() => setShowDeleteModal(exp.export_id)}
										disabled={deletingExportId === exp.export_id}
										className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
									>
										{deletingExportId === exp.export_id ? (
											<ArrowPathIcon className="w-4 h-4 animate-spin" />
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</motion.div>

			{/* FileGrabber Modal */}
			<FileGrabber
				isOpen={isFileGrabberOpen}
				onClose={() => setIsFileGrabberOpen(false)}
				onSelect={handleDownloadFromFileExchange}
				multiSelect={false}
				fileTypes={[ContentType.DOCUMENT, ContentType.OTHER]}
				maxFiles={1}
			/>

			{/* Delete Export Confirmation Modal */}
			<ConfirmDeleteModal
				isOpen={showDeleteModal !== null}
				onClose={() => setShowDeleteModal(null)}
				onConfirm={async () => {
					if (showDeleteModal) {
						await handleDeleteExport(showDeleteModal);
						setShowDeleteModal(null);
					}
				}}
				title="Удалить экспорт"
				warningMessage="Вы уверены, что хотите удалить этот экспорт?"
			/>
		</div>
	);
}

// ============================================================================
// ExportOption Component
// ============================================================================

interface ExportOptionProps {
	icon: React.ReactNode;
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

function ExportOption({
	icon,
	label,
	description,
	checked,
	onChange,
}: ExportOptionProps) {
	return (
		<button
			type="button"
			className={`flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-all ${
				checked
					? 'bg-blue-500/10 border-blue-500/50'
					: 'bg-white/5 border-white/10 hover:border-white/20'
			}`}
			onClick={() => onChange(!checked)}
		>
			<div className={`mt-0.5 ${checked ? 'text-blue-400' : 'text-white/60'}`}>
				{icon}
			</div>

			<div className="flex-1">
				<h4 className="text-white font-medium mb-1">{label}</h4>
				<p className="text-white/60 text-sm">{description}</p>
			</div>

			<div className="shrink-0">
				<div
					className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
						checked
							? 'bg-blue-500 border-blue-500'
							: 'bg-transparent border-white/20'
					}`}
				>
					{checked && <CheckIcon className="w-4 h-4 text-white" />}
				</div>
			</div>
		</button>
	);
}
