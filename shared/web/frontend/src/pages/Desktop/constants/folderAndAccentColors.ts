/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Folder swatch palette and user accent color catalog for desktop shell.
 *
 * Invariants:
 * - Symbol names and values unchanged from pre-P38 constants barrel; structural split only.
 *
 * Related:
 * - constants/index.ts (re-export barrel)
 * - src/pages/Desktop/utils/desktopAppRegistry.ts
 */
import type { FolderColor } from '../types/desktop.types';

/** Folder swatches: muted gradients so they read as accents, not a second rainbow layer. */
export const FOLDER_COLORS: FolderColor[] = [
	{
		id: 'yellow',
		color: 'text-yellow-400/90',
		gradient: 'from-yellow-500/85 to-amber-600/85',
	},
	{
		id: 'blue',
		color: 'text-blue-400/90',
		gradient: 'from-blue-500/85 to-cyan-600/85',
	},
	{
		id: 'green',
		color: 'text-green-400/90',
		gradient: 'from-green-500/85 to-emerald-600/85',
	},
	{
		id: 'pink',
		color: 'text-pink-400/90',
		gradient: 'from-pink-500/85 to-rose-600/85',
	},
	{
		id: 'purple',
		color: 'text-purple-400/90',
		gradient: 'from-purple-500/85 to-violet-600/85',
	},
	{
		id: 'orange',
		color: 'text-orange-400/90',
		gradient: 'from-orange-500/85 to-red-600/85',
	},
	{
		id: 'cyan',
		color: 'text-cyan-400/90',
		gradient: 'from-cyan-500/85 to-teal-600/85',
	},
];

export const ACCENT_COLORS = [
	{
		id: 'blue',
		name: 'Синий',
		className: 'bg-blue-500',
		hex: '#3b82f6',
		rgb: '59 130 246',
	},
	{
		id: 'purple',
		name: 'Фиолетовый',
		className: 'bg-purple-500',
		hex: '#a855f7',
		rgb: '168 85 247',
	},
	{
		id: 'pink',
		name: 'Розовый',
		className: 'bg-pink-500',
		hex: '#ec4899',
		rgb: '236 72 153',
	},
	{
		id: 'green',
		name: 'Зеленый',
		className: 'bg-green-500',
		hex: '#10b981',
		rgb: '16 185 129',
	},
	{
		id: 'orange',
		name: 'Оранжевый',
		className: 'bg-orange-500',
		hex: '#f97316',
		rgb: '249 115 22',
	},
	{
		id: 'cyan',
		name: 'Голубой',
		className: 'bg-cyan-500',
		hex: '#06b6d4',
		rgb: '6 182 212',
	},
	{
		id: 'gray',
		name: 'Серый',
		className: 'bg-gray-500',
		hex: '#6b7280',
		rgb: '107 114 128',
	},
	{
		id: 'steel',
		name: 'Стальной',
		className: 'bg-slate-500',
		hex: '#64748b',
		rgb: '100 116 139',
	},
	{
		id: 'charcoal',
		name: 'Светло-чёрный',
		className: 'bg-zinc-700',
		hex: '#3f3f46',
		rgb: '63 63 70',
	},
] as const;
