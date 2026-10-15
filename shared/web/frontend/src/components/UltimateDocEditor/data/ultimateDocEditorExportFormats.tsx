/**
 * Опции меню экспорта документа (иконки; подписи — i18n `ultimateDocEditor.header.export.formats.*`).
 */

import * as React from 'react';
import {
	ArrowDownTrayIcon,
	Bars3BottomLeftIcon,
	ChartBarSquareIcon,
	CodeBracketIcon,
	DocumentTextIcon,
	GlobeAltIcon,
} from '@heroicons/react/24/outline';

export type UltimateDocEditorExportFormat =
	| 'pdf'
	| 'docx'
	| 'html'
	| 'txt'
	| 'md'
	| 'xlsx';

export const EXPORT_FORMAT_ENTRIES: Array<{
	format: UltimateDocEditorExportFormat;
	icon: React.ReactNode;
}> = [
	{
		format: 'pdf',
		icon: <DocumentTextIcon width={24} height={24} className="text-rose-300" />,
	},
	{
		format: 'docx',
		icon: (
			<ArrowDownTrayIcon width={24} height={24} className="text-blue-300" />
		),
	},
	{
		format: 'xlsx',
		icon: (
			<ChartBarSquareIcon width={24} height={24} className="text-green-300" />
		),
	},
	{
		format: 'html',
		icon: <GlobeAltIcon width={24} height={24} className="text-cyan-300" />,
	},
	{
		format: 'txt',
		icon: (
			<Bars3BottomLeftIcon width={24} height={24} className="text-slate-200" />
		),
	},
	{
		format: 'md',
		icon: (
			<CodeBracketIcon width={24} height={24} className="text-emerald-300" />
		),
	},
];
