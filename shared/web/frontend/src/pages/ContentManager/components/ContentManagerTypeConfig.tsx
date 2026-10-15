/**
 * Zinc-first type chips for Content Manager grid/list (labels via i18n contentTypes.*).
 */
import * as React from 'react';
import {
	ArchiveBoxIcon,
	CircleStackIcon,
	CodeBracketIcon,
	DocumentIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	PresentationChartBarIcon,
	TableCellsIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';

export const TYPE_CONFIG: Record<
	string,
	{ icon: React.ReactNode; color: string; bg: string }
> = {
	document: {
		icon: <DocumentTextIcon className="w-6 h-6" />,
		color: 'text-zinc-300',
		bg: 'bg-zinc-500/[0.14]',
	},
	image: {
		icon: <PhotoIcon className="w-6 h-6" />,
		color: 'text-zinc-200',
		bg: 'bg-zinc-600/[0.16]',
	},
	video: {
		icon: <VideoCameraIcon className="w-6 h-6" />,
		color: 'text-zinc-300',
		bg: 'bg-zinc-700/[0.18]',
	},
	audio: {
		icon: <MusicalNoteIcon className="w-6 h-6" />,
		color: 'text-zinc-400',
		bg: 'bg-zinc-500/[0.12]',
	},
	spreadsheet: {
		icon: <TableCellsIcon className="w-6 h-6" />,
		color: 'text-zinc-300',
		bg: 'bg-zinc-600/[0.14]',
	},
	presentation: {
		icon: <PresentationChartBarIcon className="w-6 h-6" />,
		color: 'text-zinc-400',
		bg: 'bg-zinc-500/[0.13]',
	},
	archive: {
		icon: <ArchiveBoxIcon className="w-6 h-6" />,
		color: 'text-zinc-500',
		bg: 'bg-zinc-600/[0.12]',
	},
	code: {
		icon: <CodeBracketIcon className="w-6 h-6" />,
		color: 'text-zinc-300',
		bg: 'bg-zinc-700/[0.15]',
	},
	pdf: {
		icon: <DocumentTextIcon className="w-6 h-6" />,
		color: 'text-zinc-400',
		bg: 'bg-zinc-600/[0.18]',
	},
	text: {
		icon: <CodeBracketIcon className="w-6 h-6" />,
		color: 'text-zinc-400',
		bg: 'bg-zinc-500/[0.12]',
	},
	ai_result: {
		icon: <CircleStackIcon className="w-6 h-6" />,
		color: 'text-zinc-300',
		bg: 'bg-zinc-600/[0.15]',
	},
	other: {
		icon: <DocumentIcon className="w-6 h-6" />,
		color: 'text-zinc-500',
		bg: 'bg-zinc-600/[0.1]',
	},
};
