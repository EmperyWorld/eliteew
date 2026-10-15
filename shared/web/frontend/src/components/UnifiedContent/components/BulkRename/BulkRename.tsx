/**
 * BulkRename - Пакетное переименование файлов
 *
 * Функции:
 * - Переименование по шаблону
 * - Поддержка переменных: {name}, {date}, {index}, {ext}
 * - Предпросмотр новых имен
 * - Применение изменений
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useMemo, useState } from 'react';
import {
	CheckIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { apiClient } from '../../../../services/api';
import { log } from '../../../../utils/logger';
import { toErrorText } from '@/utils/toErrorText';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { InputV2 } from '../../../ui/InputV2';
import type { Content } from '../../types';

interface BulkRenameProps {
	contents: Content[];
	selectedIds: Set<string>;
	onClose: () => void;
	onUpdate: () => void;
}

const TEMPLATE_VARIABLES = [
	{ var: '{name}', description: 'Оригинальное имя файла (без расширения)' },
	{ var: '{ext}', description: 'Расширение файла' },
	{ var: '{index}', description: 'Порядковый номер (1, 2, 3...)' },
	{ var: '{date}', description: 'Дата создания (YYYY-MM-DD)' },
	{ var: '{time}', description: 'Время создания (HH-MM-SS)' },
	{ var: '{type}', description: 'Тип контента' },
];

export const BulkRename: React.FC<BulkRenameProps> = ({
	contents,
	selectedIds,
	onClose,
	onUpdate,
}) => {
	const [template, setTemplate] = useState('{name}_{index}');
	const [preview, setPreview] = useState(true);
	const [renaming, setRenaming] = useState(false);

	// Получаем выбранные файлы
	const selectedFiles = useMemo(() => {
		return contents
			.filter((c) => selectedIds.has(c.id))
			.sort(
				(a, b) =>
					new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
	}, [contents, selectedIds]);

	// Генерируем предпросмотр новых имен
	const previewNames = useMemo(() => {
		if (!template.trim()) {
			return [];
		}

		return selectedFiles.map((file, index) => {
			try {
				let newName = template;

				// Получаем имя и расширение
				const lastDot = file.name.lastIndexOf('.');
				const nameWithoutExt =
					lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
				const ext = lastDot > 0 ? file.name.substring(lastDot + 1) : '';

				// Заменяем переменные
				newName = newName.replace(/{name}/g, nameWithoutExt);
				newName = newName.replace(/{ext}/g, ext);
				newName = newName.replace(
					/{index}/g,
					String(index + 1).padStart(3, '0')
				);
				newName = newName.replace(/{type}/g, file.content_type || '');

				// Дата и время
				const createdDate = new Date(file.created_at);
				const dateStr = createdDate.toISOString().split('T')[0] ?? '';
				const timeStr =
					createdDate.toTimeString().split(' ')[0]?.replace(/:/g, '-') ?? '';

				if (dateStr) {
					newName = newName.replace(/{date}/g, dateStr);
				}
				if (timeStr) {
					newName = newName.replace(/{time}/g, timeStr);
				}

				// Добавляем расширение если его нет
				if (ext && !newName.includes('.')) {
					newName = `${newName}.${ext}`;
				}

				return {
					id: file.id,
					oldName: file.name,
					newName,
					isValid: newName.trim().length > 0 && newName !== file.name,
				};
			} catch {
				return {
					id: file.id,
					oldName: file.name,
					newName: file.name,
					isValid: false,
					error: 'Ошибка генерации имени',
				};
			}
		});
	}, [template, selectedFiles]);

	const hasChanges = previewNames.some(
		(p) => p.isValid && p.newName !== p.oldName
	);
	const hasErrors = previewNames.some((p) => !p.isValid);

	const handleRename = async (): Promise<void> => {
		if (!hasChanges || hasErrors) {
			return;
		}

		setRenaming(true);
		try {
			const updates = previewNames
				.filter((p) => p.isValid && p.newName !== p.oldName)
				.map((p) => ({
					id: p.id,
					name: p.newName,
				}));

			// Применяем переименование
			const promises = updates.map((update) =>
				apiClient.patch(`/api/v1/content/${update.id}`, { name: update.name })
			);

			await Promise.all(promises);

			onUpdate();
			onClose();
		} catch (error: unknown) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			log.error('BulkRename', 'Bulk rename failed', errorObj);
			toast.error(toErrorText(error));
		} finally {
			setRenaming(false);
		}
	};

	return (
		<div className="space-y-4">
			{/* Template Input */}
			<div>
				<label
					htmlFor="uc-bulk-rename-template"
					className="block text-sm font-medium text-gray-300 mb-2"
				>
					Шаблон имени
				</label>
				<InputV2
					id="uc-bulk-rename-template"
					value={template}
					onChange={(e) => setTemplate(e.target.value)}
					placeholder="Например: {name}_{index} или document_{date}"
					className="w-full"
				/>
				<p className="text-xs text-gray-400 mt-1">
					Используйте переменные для создания шаблона
				</p>
			</div>

			{/* Template Variables */}
			<div>
				<span className="block text-sm font-medium text-gray-300 mb-2">
					Доступные переменные
				</span>
				<div className="grid grid-cols-2 gap-2 p-3 bg-black/20 rounded-lg max-h-40 overflow-y-auto">
					{TEMPLATE_VARIABLES.map(({ var: varName, description }) => (
						<button
							type="button"
							key={varName}
							onClick={() => {
								const input = document.querySelector(
									'input[placeholder*="Шаблон"]'
								) as HTMLInputElement;
								if (input) {
									const start = input.selectionStart || 0;
									const end = input.selectionEnd || 0;
									const newValue =
										template.substring(0, start) +
										varName +
										template.substring(end);
									setTemplate(newValue);
									setTimeout(() => {
										input.focus();
										input.setSelectionRange(
											start + varName.length,
											start + varName.length
										);
									}, 0);
								} else {
									setTemplate(template + varName);
								}
							}}
							className="text-left p-2 rounded hover:bg-white/5 transition-colors"
						>
							<div className="text-purple-400 font-mono text-sm">{varName}</div>
							<div className="text-xs text-gray-400">{description}</div>
						</button>
					))}
				</div>
			</div>

			{/* Preview Toggle */}
			<div className="flex items-center justify-between">
				<label className="flex items-center gap-2 text-sm text-gray-300">
					<input
						type="checkbox"
						checked={preview}
						onChange={(e) => setPreview(e.target.checked)}
						className="w-4 h-4 text-purple-500 rounded"
					/>
					Показать предпросмотр
				</label>
				<div className="text-xs text-gray-400">
					{selectedFiles.length} файлов
				</div>
			</div>

			{/* Preview */}
			<AnimatePresence>
				{preview && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						className="space-y-2 max-h-64 overflow-y-auto p-3 bg-black/20 rounded-lg"
					>
						{previewNames.map((item) => (
							<div
								key={item.id}
								className={`p-2 rounded ${
									item.isValid
										? item.newName !== item.oldName
											? 'bg-green-500/10 border border-green-500/30'
											: 'bg-gray-500/10 border border-gray-500/30'
										: 'bg-red-500/10 border border-red-500/30'
								}`}
							>
								<div className="flex items-start gap-2">
									<DocumentTextIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-gray-400 line-through">
											{item.oldName}
										</div>
										<div
											className={`text-sm font-medium ${
												item.isValid && item.newName !== item.oldName
													? 'text-green-400'
													: item.isValid
														? 'text-gray-400'
														: 'text-red-400'
											}`}
										>
											{item.newName}
										</div>
										{!item.isValid && item.error && (
											<div className="text-xs text-red-400 mt-1">
												{item.error}
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Status */}
			{hasErrors && (
				<div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
					<ExclamationCircleIcon className="w-4 h-4 text-red-400" />
					<span className="text-sm text-red-400">
						Некоторые имена не могут быть сгенерированы. Проверьте шаблон.
					</span>
				</div>
			)}

			{!hasChanges && template.trim() && (
				<div className="flex items-center gap-2 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
					<ExclamationCircleIcon className="w-4 h-4 text-yellow-400" />
					<span className="text-sm text-yellow-400">
						Нет изменений для применения
					</span>
				</div>
			)}

			{/* Actions */}
			<div className="flex items-center gap-3 pt-4 border-t border-white/10">
				<ButtonV2
					variant="ghost"
					size="md"
					onClick={onClose}
					disabled={renaming}
				>
					Отмена
				</ButtonV2>
				<ButtonV2
					variant="gradient"
					size="md"
					onClick={handleRename}
					disabled={renaming || !hasChanges || hasErrors}
					iconLeft={<CheckIcon className="w-4 h-4" />}
				>
					{renaming
						? 'Переименование...'
						: `Переименовать (${previewNames.filter((p) => p.isValid && p.newName !== p.oldName).length})`}
				</ButtonV2>
			</div>
		</div>
	);
};

export default BulkRename;
