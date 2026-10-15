/**
 * ExportMetadata - Компонент для экспорта метаданных
 *
 * Функции:
 * - Экспорт в CSV
 * - Экспорт в JSON
 * - Выбор полей для экспорта
 * - Экспорт выбранных или всех файлов
 */

import * as React from 'react';
import { useState } from 'react';
import {
	ArrowDownTrayIcon,
	Cog6ToothIcon,
	DocumentTextIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { useNotifications } from '@/notifications';
import { cn } from '@/utils/cn';
import { exportMetadata, type ExportFormat } from '../../utils/exportMetadata';
import type { Content } from '../../types';
import { log } from '../../../../utils/logger';

interface ExportMetadataProps {
	contents: Content[];
	selectedIds?: Set<string>;
	onClose?: () => void;
}

const AVAILABLE_FIELDS = [
	{ id: 'id', label: 'ID', default: false },
	{ id: 'name', label: 'Имя файла', default: true },
	{ id: 'content_type', label: 'Тип контента', default: true },
	{ id: 'file_size', label: 'Размер (байты)', default: true },
	{
		id: 'file_size_formatted',
		label: 'Размер (форматированный)',
		default: false,
	},
	{ id: 'mime_type', label: 'MIME тип', default: true },
	{ id: 'created_at', label: 'Дата создания', default: true },
	{ id: 'updated_at', label: 'Дата обновления', default: true },
	{ id: 'visibility', label: 'Видимость', default: true },
	{ id: 'tags', label: 'Теги', default: true },
	{ id: 'description', label: 'Описание', default: false },
	{ id: 'company_id', label: 'ID компании', default: false },
	{ id: 'project_id', label: 'ID проекта', default: false },
	{ id: 'user_id', label: 'ID пользователя', default: false },
];

export const ExportMetadata: React.FC<ExportMetadataProps> = ({
	contents,
	selectedIds,
	onClose,
}) => {
	const { toast } = useNotifications();
	const [format, setFormat] = useState<ExportFormat>('csv');
	const [selectedFields, setSelectedFields] = useState<string[]>(
		AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.id)
	);
	const [showSettings, setShowSettings] = useState(false);
	const [exporting, setExporting] = useState(false);

	// Определяем какие файлы экспортировать
	const filesToExport =
		selectedIds && selectedIds.size > 0
			? contents.filter((c) => selectedIds.has(c.id))
			: contents;

	const handleExport = (): void => {
		if (filesToExport.length === 0) {
			toast.warning('Нет файлов для экспорта', 'Выберите файлы для экспорта');
			return;
		}

		setExporting(true);
		try {
			exportMetadata(filesToExport, format, {
				fields: selectedFields,
				includeHeaders: true,
			});

			if (onClose) {
				setTimeout(() => {
					onClose();
				}, 500);
			}
		} catch (error: unknown) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			log.error('ExportMetadata', 'Export failed', errorObj);
			const errorMessage =
				error instanceof Error ? error.message : 'Неизвестная ошибка экспорта';
			toast.error('Ошибка экспорта', errorMessage);
		} finally {
			setExporting(false);
		}
	};

	const toggleField = (fieldId: string): void => {
		setSelectedFields((prev) => {
			if (prev.includes(fieldId)) {
				return prev.filter((f) => f !== fieldId);
			} else {
				return [...prev, fieldId];
			}
		});
	};

	const selectAllFields = (): void => {
		setSelectedFields(AVAILABLE_FIELDS.map((f) => f.id));
	};

	const selectDefaultFields = (): void => {
		setSelectedFields(
			AVAILABLE_FIELDS.filter((f) => f.default).map((f) => f.id)
		);
	};

	return (
		<div className="space-y-4">
			{/* Format Selection */}
			<div>
				<span className="block text-sm font-medium text-gray-300 mb-2">
					Формат экспорта
				</span>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => setFormat('csv')}
						className={cn(
							'flex-1 rounded-lg border p-3 transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none',
							format === 'csv'
								? 'border-purple-500/50 bg-purple-500/30 text-white'
								: 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
						)}
					>
						<DocumentTextIcon className="w-5 h-5 mx-auto mb-1" />
						<div className="text-sm font-medium">CSV</div>
					</button>
					<button
						type="button"
						onClick={() => setFormat('json')}
						className={cn(
							'flex-1 rounded-lg border p-3 transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none',
							format === 'json'
								? 'border-purple-500/50 bg-purple-500/30 text-white'
								: 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
						)}
					>
						<DocumentTextIcon className="w-5 h-5 mx-auto mb-1" />
						<div className="text-sm font-medium">JSON</div>
					</button>
				</div>
			</div>

			{/* Files Count */}
			<div className="p-3 bg-white/5 rounded-lg border border-white/10">
				<div className="text-sm text-gray-400">
					Будет экспортировано:{' '}
					<span className="text-white font-medium">{filesToExport.length}</span>{' '}
					файлов
				</div>
				{selectedIds && selectedIds.size > 0 && (
					<div className="text-xs text-gray-500 mt-1">(только выбранные)</div>
				)}
			</div>

			{/* Cog6ToothIcon Toggle */}
			<button
				type="button"
				onClick={() => setShowSettings(!showSettings)}
				className="w-full p-2 flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
			>
				<div className="flex items-center gap-2">
					<Cog6ToothIcon className="w-4 h-4" />
					<span>Настройки полей</span>
				</div>
				<motion.div
					animate={{ rotate: showSettings ? 180 : 0 }}
					transition={{ duration: 0.2 }}
				>
					<XMarkIcon className="w-4 h-4" />
				</motion.div>
			</button>

			{/* Fields Selection */}
			<AnimatePresence>
				{showSettings && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="space-y-3 overflow-hidden"
					>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-300">
								Выберите поля для экспорта
							</span>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={selectAllFields}
									className="text-xs text-purple-400 hover:text-purple-300"
								>
									Все
								</button>
								<button
									type="button"
									onClick={selectDefaultFields}
									className="text-xs text-purple-400 hover:text-purple-300"
								>
									По умолчанию
								</button>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-black/20 rounded-lg">
							{AVAILABLE_FIELDS.map((field) => (
								<label
									key={field.id}
									className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer"
								>
									<input
										type="checkbox"
										checked={selectedFields.includes(field.id)}
										onChange={() => toggleField(field.id)}
										className="w-4 h-4 text-purple-500 rounded"
									/>
									<span className="text-sm text-gray-300">{field.label}</span>
								</label>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Export Button */}
			<ButtonV2
				variant="gradient"
				size="md"
				onClick={handleExport}
				disabled={
					exporting || filesToExport.length === 0 || selectedFields.length === 0
				}
				iconLeft={<ArrowDownTrayIcon className="w-4 h-4" />}
				className="w-full"
			>
				{exporting ? 'Экспорт...' : `Экспортировать ${format.toUpperCase()}`}
			</ButtonV2>
		</div>
	);
};

export default ExportMetadata;
