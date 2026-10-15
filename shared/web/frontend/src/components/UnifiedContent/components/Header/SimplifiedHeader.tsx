/**
 * SimplifiedHeader - Упрощенный header для Unified Content Manager
 *
 * Современный компактный дизайн с:
 * - Упрощенной навигацией (только основные табы)
 * - Поиском в header
 * - Быстрыми действиями
 * - Floating action button для загрузки
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import {
	ArrowUpTrayIcon,
	ChartBarSquareIcon,
	CircleStackIcon,
	FolderIcon,
	FunnelIcon,
	HomeIcon,
	MagnifyingGlassIcon,
	StarIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { SearchWithAutocomplete } from '../SearchWithAutocomplete';

interface SimplifiedHeaderProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onNavigate?: (page: string) => void;
	onUploadClick: () => void;
	onFiltersToggle?: () => void;
	filtersOpen?: boolean;
}

export const SimplifiedHeader: React.FC<SimplifiedHeaderProps> = ({
	activeTab,
	onTabChange,
	searchQuery,
	onSearchChange,
	onNavigate,
	onUploadClick,
	onFiltersToggle,
	filtersOpen = false,
}) => {
	// Упрощенные табы - только основные (остальные доступны через меню)
	const mainTabs = [
		{ id: 'browser', label: 'Файлы', icon: CircleStackIcon },
		{ id: 'favorites', label: 'Избранное', icon: StarIcon },
		{ id: 'duplicates', label: 'Дубликаты', icon: MagnifyingGlassIcon },
		{ id: 'file-manager', label: 'Менеджер', icon: FolderIcon },
		{ id: 'upload', label: 'Загрузить', icon: ArrowUpTrayIcon },
		{ id: 'analytics', label: 'Аналитика', icon: ChartBarSquareIcon },
	];

	return (
		<div className="sticky top-0 z-40 bg-linear-to-b from-white/10 via-white/5 to-transparent backdrop-blur-2xl border-b border-white/20 shadow-2xl shadow-purple-500/10">
			<div className="w-full px-6 lg:px-12 xl:px-16">
				{/* Top Row: Title (truncates) + actions aligned end */}
				<div className="flex h-20 min-w-0 items-center gap-4 lg:gap-6">
					<div className="flex min-w-0 shrink items-center gap-4 sm:gap-6">
						<motion.button
							type="button"
							onClick={() => onNavigate?.('dashboard')}
							className="shrink-0 rounded-xl border border-white/10 p-3 transition-[border-color,background-color] duration-300 motion-reduce:transition-none hover:border-purple-500/50 hover:bg-linear-to-br hover:from-purple-500/20 hover:to-pink-500/20"
							whileTap={{ scale: 0.95 }}
							aria-label="Назад"
						>
							<HomeIcon className="h-5 w-5 text-gray-300" />
						</motion.button>

						<div className="flex min-w-0 items-center gap-3">
							<div className="shrink-0 rounded-xl border border-purple-500/30 bg-linear-to-br from-purple-500/20 to-pink-500/20 p-2.5">
								<CircleStackIcon className="h-6 w-6 text-purple-400" />
							</div>
							<div className="min-w-0">
								<h1
									className="truncate text-xl font-bold text-transparent bg-linear-to-r from-white via-purple-100 to-pink-100 bg-clip-text sm:text-2xl"
									title="Менеджер контента"
								>
									Менеджер контента
								</h1>
								<p
									className="mt-0.5 truncate text-xs text-gray-400"
									title="Управление файлами и документами"
								>
									Управление файлами и документами
								</p>
							</div>
						</div>
					</div>

					<div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4 lg:max-w-[min(42rem,52vw)] xl:max-w-[min(48rem,50vw)]">
						<div className="relative min-w-0 flex-1">
							<SearchWithAutocomplete
								value={searchQuery}
								onChange={onSearchChange}
								onSelect={(suggestion) => {
									if (suggestion.type === 'tag') {
										onSearchChange(suggestion.label.replace('#', ''));
									}
								}}
								placeholder="Поиск файлов, тегов..."
							/>
						</div>

						<div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
							{onFiltersToggle && (
								<motion.div whileTap={{ scale: 0.95 }}>
									<ButtonV2
										variant={filtersOpen ? 'secondary' : 'ghost'}
										size="icon"
										onClick={onFiltersToggle}
										iconLeft={<FunnelIcon className="h-4 w-4" />}
										aria-label="Фильтры"
										title="Фильтры"
										className={
											filtersOpen
												? 'border-purple-500/50 bg-linear-to-br from-purple-500/30 to-pink-500/30'
												: ''
										}
									/>
								</motion.div>
							)}

							<motion.div whileTap={{ scale: 0.98 }}>
								<ButtonV2
									variant="gradient"
									size="md"
									onClick={onUploadClick}
									iconLeft={<ArrowUpTrayIcon className="h-4 w-4" />}
									className="shadow-lg shadow-purple-500/30 transition-shadow hover:shadow-purple-500/50"
								>
									Загрузить
								</ButtonV2>
							</motion.div>
						</div>
					</div>
				</div>

				{/* Bottom Row: Tabs */}
				<div className="flex items-center gap-2 border-t border-white/10 pt-1">
					{mainTabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;

						return (
							<motion.button
								type="button"
								key={tab.id}
								onClick={() => onTabChange(tab.id)}
								className={cn(
									'relative flex items-center gap-2.5 rounded-t-lg px-6 py-3 text-sm font-semibold transition-[color,background-color,border-color] duration-300 motion-reduce:transition-none',
									isActive
										? 'border-t-2 border-purple-500 bg-linear-to-b from-purple-500/20 to-pink-500/20 text-white'
										: 'text-gray-400 hover:bg-white/5 hover:text-white'
								)}
								whileTap={{ scale: 0.98 }}
							>
								<Icon
									className={`w-4 h-4 ${isActive ? 'text-purple-400' : ''}`}
								/>
								{tab.label}

								{/* Active Indicator */}
								{isActive && (
									<motion.div
										layoutId="activeTab"
										className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-purple-500 via-pink-500 to-purple-500"
										initial={false}
										transition={{ type: 'spring', stiffness: 500, damping: 30 }}
									/>
								)}
							</motion.button>
						);
					})}
				</div>
			</div>
		</div>
	);
};
