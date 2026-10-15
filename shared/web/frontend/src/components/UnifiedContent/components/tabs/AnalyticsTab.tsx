/**
 * Analytics Tab Component
 *
 * Content statistics and analytics dashboard
 */

import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';
import {
	ArrowTrendingUpIcon,
	ArrowUpTrayIcon,
	ChartBarSquareIcon,
	ChartPieIcon,
	CircleStackIcon,
	ServerIcon,
	SignalIcon,
	TagIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import type { ContentStats } from '../../types';
import {
	formatBytes,
	getFileIcon,
	contentTypeLabels,
} from '../../utils/contentUtils';

function AnalyticsPercentBar({
	pct,
	className,
}: {
	pct: number;
	className: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${pct}%`;
	}, [pct]);
	return <div ref={ref} className={className} />;
}

function TagCloudItem({
	tag,
	count,
	onTagClick,
}: {
	tag: string;
	count: number;
	onTagClick?: (tag: string) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.fontSize = `${Math.min(20, 12 + count * 2)}px`;
	}, [count]);
	return (
		<motion.div
			ref={ref}
			className="px-4 py-2 bg-linear-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 transition-colors cursor-pointer"
			transition={{ duration: 0.2 }}
			onClick={() => onTagClick?.(tag)}
		>
			{tag} <span className="text-purple-300">({count})</span>
		</motion.div>
	);
}

interface AnalyticsTabProps {
	stats: ContentStats;
	onTagClick?: (tag: string) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
	stats,
	onTagClick,
}) => {
	return (
		<div className="space-y-6">
			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<motion.div
					className="bg-linear-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6 backdrop-blur-xl shadow-xl shadow-purple-500/20"
					transition={{ duration: 0.2 }}
				>
					<div className="flex items-center justify-between mb-2">
						<ServerIcon className="w-8 h-8 text-purple-400" />
						<ArrowTrendingUpIcon className="w-5 h-5 text-purple-400" />
					</div>
					<div className="text-3xl font-bold text-white mb-1">
						{stats.totalFiles}
					</div>
					<div className="text-sm text-purple-300">Всего файлов</div>
				</motion.div>

				<motion.div
					className="bg-linear-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl p-6 backdrop-blur-xl shadow-xl shadow-pink-500/20"
					transition={{ duration: 0.2 }}
				>
					<div className="flex items-center justify-between mb-2">
						<CircleStackIcon className="w-8 h-8 text-pink-400" />
						<ChartBarSquareIcon className="w-5 h-5 text-pink-400" />
					</div>
					<div className="text-3xl font-bold text-white mb-1">
						{formatBytes(stats.totalSize)}
					</div>
					<div className="text-sm text-pink-300">Использовано места</div>
				</motion.div>

				<motion.div
					className="bg-linear-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6 backdrop-blur-xl shadow-xl shadow-green-500/20"
					transition={{ duration: 0.2 }}
				>
					<div className="flex items-center justify-between mb-2">
						<ArrowUpTrayIcon className="w-8 h-8 text-green-400" />
						<SignalIcon className="w-5 h-5 text-green-400" />
					</div>
					<div className="text-3xl font-bold text-white mb-1">
						{stats.recentActivity}
					</div>
					<div className="text-sm text-green-300">Последние 7 дней</div>
				</motion.div>

				<motion.div
					className="bg-linear-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-6 backdrop-blur-xl shadow-xl shadow-orange-500/20"
					transition={{ duration: 0.2 }}
				>
					<div className="flex items-center justify-between mb-2">
						<TagIcon className="w-8 h-8 text-orange-400" />
						<UsersIcon className="w-5 h-5 text-orange-400" />
					</div>
					<div className="text-3xl font-bold text-white mb-1">
						{stats.topTags.length}
					</div>
					<div className="text-sm text-orange-300">Уникальных тегов</div>
				</motion.div>
			</div>

			{/* Content by Type */}
			<motion.div
				className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl shadow-purple-500/20"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.1 }}
			>
				<div className="flex items-center gap-2 mb-4">
					<ChartPieIcon className="w-5 h-5 text-purple-400" />
					<h3 className="text-lg font-semibold text-white">Контент по типам</h3>
				</div>
				<div className="space-y-3">
					{Object.entries(stats.typeDistribution).map(([type, count]) => {
						const percentage =
							stats.totalFiles > 0 ? (count / stats.totalFiles) * 100 : 0;
						return (
							<div key={type}>
								<div className="flex items-center justify-between mb-1">
									<div className="flex items-center gap-2">
										{getFileIcon(type)}
										<span className="text-white capitalize">
											{contentTypeLabels[type] || type}
										</span>
									</div>
									<span className="text-gray-400">
										{count} файлов ({percentage.toFixed(1)}%)
									</span>
								</div>
								<div className="w-full bg-gray-700 rounded-full h-2">
									<AnalyticsPercentBar
										pct={percentage}
										className="h-2 rounded-full bg-linear-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/40 transition-[width] duration-300 ease-out motion-reduce:transition-none"
									/>
								</div>
							</div>
						);
					})}
				</div>
			</motion.div>

			{/* Top Tags Cloud */}
			<motion.div
				className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl shadow-purple-500/20"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.2 }}
			>
				<h3 className="text-lg font-semibold text-white mb-4">
					Популярные теги
				</h3>
				<div className="flex flex-wrap gap-2">
					{stats.topTags.length === 0 ? (
						<p className="text-gray-400">Тегов пока нет</p>
					) : (
						stats.topTags.map(({ tag, count }) => (
							<TagCloudItem
								key={tag}
								tag={tag}
								count={count}
								onTagClick={onTagClick}
							/>
						))
					)}
				</div>
			</motion.div>

			{/* Storage Quota Visualization */}
			<motion.div
				className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-6 shadow-xl shadow-purple-500/20"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.3 }}
			>
				<h3 className="text-lg font-semibold text-white mb-4">
					Использование хранилища
				</h3>
				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Использовано</span>
						<span className="text-white font-medium">
							{formatBytes(stats.totalSize)} / 10 GB
						</span>
					</div>
					<div className="w-full bg-gray-700 rounded-full h-3">
						<AnalyticsPercentBar
							pct={Math.min(
								(stats.totalSize / (10 * 1024 * 1024 * 1024)) * 100,
								100
							)}
							className="h-3 rounded-full bg-linear-to-r from-green-500 to-blue-500 shadow-lg shadow-blue-500/40 transition-[width] duration-500 ease-out motion-reduce:transition-none"
						/>
					</div>
					<p className="text-xs text-gray-500 mt-2">
						{((stats.totalSize / (10 * 1024 * 1024 * 1024)) * 100).toFixed(2)}%
						от доступной квоты
					</p>
				</div>
			</motion.div>
		</div>
	);
};
