/**
 * SmartCollections - Умные коллекции (автоматические фильтры)
 *
 * Быстрые фильтры для частых сценариев:
 * - Сегодня
 * - На этой неделе
 * - В этом месяце
 * - Изображения
 * - Документы
 * - Видео
 * - Аудио
 * - Большие файлы
 * - Недавно загруженные
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import {
	ArrowTrendingUpIcon,
	CalendarIcon,
	ClockIcon,
	DocumentTextIcon,
	MusicalNoteIcon,
	PhotoIcon,
	ServerIcon,
	SparklesIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export interface SmartCollection {
	id: string;
	label: string;
	icon: React.ReactNode;
	description: string;
	filter: {
		dateRange?: 'today' | 'week' | 'month';
		contentType?: string;
		sizeRange?: 'large';
		sortBy?: 'date' | 'size';
	};
	color: string;
}

interface SmartCollectionsProps {
	onSelect: (collection: SmartCollection) => void;
	activeCollectionId?: string;
}

const COLLECTIONS: SmartCollection[] = [
	{
		id: 'today',
		label: 'Сегодня',
		icon: <CalendarIcon className="w-5 h-5" />,
		description: 'Файлы, загруженные сегодня',
		filter: { dateRange: 'today' },
		color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/50',
	},
	{
		id: 'this-week',
		label: 'На этой неделе',
		icon: <ClockIcon className="w-5 h-5" />,
		description: 'Файлы за последние 7 дней',
		filter: { dateRange: 'week' },
		color: 'from-purple-500/20 to-pink-500/20 border-purple-500/50',
	},
	{
		id: 'this-month',
		label: 'В этом месяце',
		icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
		description: 'Файлы за текущий месяц',
		filter: { dateRange: 'month' },
		color: 'from-green-500/20 to-emerald-500/20 border-green-500/50',
	},
	{
		id: 'images',
		label: 'Изображения',
		icon: <PhotoIcon className="w-5 h-5" />,
		description: 'Все изображения',
		filter: { contentType: 'image' },
		color: 'from-pink-500/20 to-rose-500/20 border-pink-500/50',
	},
	{
		id: 'documents',
		label: 'Документы',
		icon: <DocumentTextIcon className="w-5 h-5" />,
		description: 'Документы и PDF',
		filter: { contentType: 'document' },
		color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/50',
	},
	{
		id: 'videos',
		label: 'Видео',
		icon: <VideoCameraIcon className="w-5 h-5" />,
		description: 'Видео файлы',
		filter: { contentType: 'video' },
		color: 'from-red-500/20 to-orange-500/20 border-red-500/50',
	},
	{
		id: 'audio',
		label: 'Аудио',
		icon: <MusicalNoteIcon className="w-5 h-5" />,
		description: 'Аудио файлы',
		filter: { contentType: 'audio' },
		color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/50',
	},
	{
		id: 'large-files',
		label: 'Большие файлы',
		icon: <ServerIcon className="w-5 h-5" />,
		description: 'Файлы больше 100 МБ',
		filter: { sizeRange: 'large' },
		color: 'from-gray-500/20 to-slate-500/20 border-gray-500/50',
	},
	{
		id: 'recent',
		label: 'Недавние',
		icon: <SparklesIcon className="w-5 h-5" />,
		description: 'Недавно загруженные',
		filter: { sortBy: 'date' },
		color: 'from-violet-500/20 to-purple-500/20 border-violet-500/50',
	},
];

export const SmartCollections: React.FC<SmartCollectionsProps> = ({
	onSelect,
	activeCollectionId,
}) => {
	const { t } = useTranslation('contentManager');
	return (
		<div className="min-w-0 max-w-full space-y-4">
			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 items-center gap-2">
					<SparklesIcon
						className="h-5 w-5 shrink-0 text-purple-400"
						aria-hidden
					/>
					<h3 className="text-lg font-semibold text-white">
						{t('smartCollections.title')}
					</h3>
				</div>
				<p className="max-w-prose text-xs leading-relaxed text-gray-400 sm:max-w-md">
					{t('smartCollections.intro')}
				</p>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{COLLECTIONS.map((collection) => {
					const isActive = activeCollectionId === collection.id;

					return (
						<motion.button
							type="button"
							key={collection.id}
							onClick={() => onSelect(collection)}
							whileTap={{ scale: 0.98 }}
							className={`
                relative rounded-xl border p-4 text-left transition-[background-color,border-color,box-shadow] duration-200
                bg-linear-to-br ${collection.color}
                ${
									isActive
										? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/30'
										: 'hover:shadow-lg hover:shadow-purple-500/10 hover:ring-1 hover:ring-white/10'
								}
              `}
						>
							{/* Icon */}
							<div
								className={`
                mb-2 p-2 rounded-lg inline-flex
                ${isActive ? 'bg-white/20' : 'bg-white/10'}
              `}
							>
								<div className={isActive ? 'text-white' : 'text-gray-300'}>
									{collection.icon}
								</div>
							</div>

							{/* Label */}
							<div className="text-white font-semibold text-sm mb-1">
								{collection.label}
							</div>

							{/* Description */}
							<div className="text-xs text-gray-400 line-clamp-1">
								{collection.description}
							</div>

							{/* Active Indicator */}
							{isActive && (
								<motion.div
									layoutId="activeCollection"
									className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"
									initial={false}
									transition={{ type: 'spring', stiffness: 500, damping: 30 }}
								/>
							)}
						</motion.button>
					);
				})}
			</div>
		</div>
	);
};

export default SmartCollections;
