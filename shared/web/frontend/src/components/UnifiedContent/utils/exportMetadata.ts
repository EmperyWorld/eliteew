/**
 * Export Metadata Utilities
 *
 * Функции для экспорта метаданных файлов в CSV и JSON форматы
 */

import type { Content } from '../types';
import { formatBytes } from './contentUtils';

export type ExportFormat = 'csv' | 'json';

interface ExportOptions {
	format: ExportFormat;
	includeHeaders?: boolean;
	fields?: string[]; // Поля для экспорта
}

const DEFAULT_FIELDS = [
	'name',
	'content_type',
	'file_size',
	'mime_type',
	'created_at',
	'updated_at',
	'visibility',
	'tags',
	'description',
	'company_id',
	'project_id',
];

/**
 * Экспорт метаданных в CSV формат
 */
export function exportToCSV(
	contents: Content[],
	options: ExportOptions = { format: 'csv' }
): string {
	const fields = options.fields || DEFAULT_FIELDS;
	const includeHeaders = options.includeHeaders !== false;

	// CSV заголовки
	const headers = fields.map((field) => {
		const labels: Record<string, string> = {
			name: 'Имя файла',
			content_type: 'Тип контента',
			file_size: 'Размер (байты)',
			file_size_formatted: 'Размер',
			mime_type: 'MIME тип',
			created_at: 'Дата создания',
			updated_at: 'Дата обновления',
			visibility: 'Видимость',
			tags: 'Теги',
			description: 'Описание',
			company_id: 'ID компании',
			project_id: 'ID проекта',
			user_id: 'ID пользователя',
			id: 'ID',
		};
		return labels[field] || field;
	});

	// Helper функция для безопасного получения значения поля
	const getFieldValue = (content: Content, field: string): unknown => {
		switch (field) {
			case 'id':
				return content.id;
			case 'name':
				return content.name;
			case 'content_type':
				return content.content_type;
			case 'file_size':
				return content.file_size;
			case 'file_size_formatted':
				return formatBytes(content.file_size);
			case 'mime_type':
				return content.mime_type;
			case 'created_at':
				return content.created_at;
			case 'updated_at':
				return content.updated_at;
			case 'visibility':
				return content.visibility;
			case 'tags':
				return Array.isArray(content.tags) ? content.tags.join('; ') : '';
			case 'description':
				return content.description ?? '';
			case 'company_id':
				return content.company_id ?? '';
			case 'project_id':
				return content.project_id ?? '';
			case 'user_id':
				return content.user_id;
			default:
				return '';
		}
	};

	// CSV строки
	const rows: string[][] = contents.map((content) => {
		return fields.map((field) => {
			// Получаем значение через helper функцию
			const rawValue = getFieldValue(content, field);

			// Специальная обработка для дат
			let value: string;
			if (field === 'created_at' || field === 'updated_at') {
				value = rawValue
					? new Date(rawValue as string).toLocaleString('ru-RU')
					: '';
			} else if (rawValue === null || rawValue === undefined) {
				value = '';
			} else {
				value = String(rawValue);
			}

			// Экранирование для CSV
			if (value.includes(',') || value.includes('"') || value.includes('\n')) {
				value = `"${value.replace(/"/g, '""')}"`;
			}

			return value;
		});
	});

	// Объединение
	const csvLines: string[] = [];

	if (includeHeaders) {
		csvLines.push(headers.join(','));
	}

	rows.forEach((row) => {
		csvLines.push(row.join(','));
	});

	return csvLines.join('\n');
}

/**
 * Экспорт метаданных в JSON формат
 */
export function exportToJSON(
	contents: Content[],
	options: ExportOptions = { format: 'json' }
): string {
	const fields = options.fields || DEFAULT_FIELDS;

	// Helper функция для безопасного получения значения поля (JSON версия)
	const getFieldValueJSON = (content: Content, field: string): unknown => {
		switch (field) {
			case 'id':
				return content.id;
			case 'name':
				return content.name;
			case 'content_type':
				return content.content_type;
			case 'file_size':
				return content.file_size;
			case 'file_size_formatted':
				return formatBytes(content.file_size);
			case 'mime_type':
				return content.mime_type;
			case 'created_at':
				return content.created_at
					? new Date(content.created_at).toISOString()
					: null;
			case 'updated_at':
				return content.updated_at
					? new Date(content.updated_at).toISOString()
					: null;
			case 'visibility':
				return content.visibility;
			case 'tags':
				return Array.isArray(content.tags) ? content.tags : [];
			case 'description':
				return content.description ?? null;
			case 'company_id':
				return content.company_id ?? null;
			case 'project_id':
				return content.project_id ?? null;
			case 'user_id':
				return content.user_id;
			default:
				return null;
		}
	};

	const data: Record<string, unknown>[] = contents.map((content) => {
		const item: Record<string, unknown> = {};

		fields.forEach((field) => {
			item[field] = getFieldValueJSON(content, field);
		});

		return item;
	});

	return JSON.stringify(data, null, 2);
}

/**
 * Скачать экспортированные данные
 */
export function downloadExport(
	data: string,
	filename: string,
	mimeType = 'text/plain'
): void {
	const blob = new Blob([data], { type: mimeType });
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.setAttribute('download', filename);
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}

/**
 * Экспорт метаданных с автоматическим выбором формата
 */
export function exportMetadata(
	contents: Content[],
	format: ExportFormat,
	options?: Partial<ExportOptions>
): void {
	const timestamp = new Date().toISOString().split('T')[0];
	let data: string;
	let filename: string;
	let mimeType: string;

	if (format === 'csv') {
		data = exportToCSV(contents, { format, ...options });
		filename = `content_metadata_${timestamp}.csv`;
		mimeType = 'text/csv;charset=utf-8;';
	} else {
		data = exportToJSON(contents, { format, ...options });
		filename = `content_metadata_${timestamp}.json`;
		mimeType = 'application/json';
	}

	downloadExport(data, filename, mimeType);
}
