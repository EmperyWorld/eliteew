/**
 * Company Content Widget
 * Plan 3: Content Manager Expansion
 *
 * Widget for displaying recent files and public materials for a company
 */

import * as React from 'react';
import { useState, useEffect, type ReactElement } from 'react';
import {
	ArrowDownTrayIcon,
	BuildingOffice2Icon,
	DocumentIcon,
	DocumentTextIcon,
	EyeIcon,
	PhotoIcon,
	VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { apiClient } from '../../services/api';
import { log } from '../../utils/logger';
import type { Content } from './types';

interface FetchParams {
	company_id: string;
	limit: number;
	visibility?: string;
}

interface CompanyContentWidgetProps {
	companyId: string;
	companyName: string;
	limit?: number;
	showPublicOnly?: boolean;
}

const CompanyContentWidget: React.FC<CompanyContentWidgetProps> = ({
	companyId,
	companyName,
	limit = 5,
	showPublicOnly = false,
}) => {
	const [contents, setContents] = useState<Content[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchContents = async (): Promise<void> => {
			try {
				const params: FetchParams = {
					company_id: companyId,
					limit: limit,
				};
				if (showPublicOnly) {
					params.visibility = 'public';
				}

				const response = await apiClient.get<{ items: Content[] }>(
					'/api/v1/content',
					{ params }
				);
				if (response.data?.items) {
					setContents(response.data.items);
				}
			} catch (error) {
				const errorObj =
					error instanceof Error ? error : new Error(String(error));
				log.error(
					'CompanyContentWidget',
					'Failed to load company content',
					errorObj
				);
			} finally {
				setLoading(false);
			}
		};

		void fetchContents();
	}, [companyId, limit, showPublicOnly]);

	const getFileIcon = (contentType: string): ReactElement => {
		switch (contentType) {
			case 'document':
				return <DocumentTextIcon className="w-4 h-4" />;
			case 'image':
				return <PhotoIcon className="w-4 h-4" />;
			case 'video':
				return <VideoCameraIcon className="w-4 h-4" />;
			default:
				return <DocumentIcon className="w-4 h-4" />;
		}
	};

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) {
			return '0 Bytes';
		}
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	};

	if (loading) {
		return (
			<div className="bg-white/10 backdrop-blur-xl rounded-lg p-4 border border-white/20">
				<div className="animate-pulse space-y-2">
					<div className="h-4 bg-white/20 rounded w-1/2"></div>
					<div className="h-3 bg-white/10 rounded w-full"></div>
					<div className="h-3 bg-white/10 rounded w-3/4"></div>
				</div>
			</div>
		);
	}

	return (
		<motion.div
			className="bg-white/10 backdrop-blur-xl rounded-lg p-4 border border-white/20"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
		>
			<div className="flex items-center gap-2 mb-3">
				<BuildingOffice2Icon className="w-5 h-5 text-purple-400" />
				<h3 className="text-white font-semibold">{companyName}</h3>
				{showPublicOnly && (
					<span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
						Публичные
					</span>
				)}
			</div>

			{contents.length === 0 ? (
				<p className="text-gray-400 text-sm">Нет файлов</p>
			) : (
				<div className="space-y-2">
					{contents.map((content) => (
						<motion.div
							key={content.id}
							className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/5 p-2 transition-[background-color,border-color,box-shadow] hover:border-white/15 hover:bg-white/10 hover:shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
						>
							<div className="text-purple-400">
								{getFileIcon(content.content_type)}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-white text-sm truncate">{content.name}</p>
								<p className="text-gray-400 text-xs">
									{content.file_size != null
										? formatBytes(content.file_size)
										: '—'}
								</p>
							</div>
							<div className="flex gap-1">
								<motion.button
									type="button"
									className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/8 hover:text-white"
									whileTap={{ scale: 0.96 }}
									title="Просмотр"
								>
									<EyeIcon className="w-4 h-4" />
								</motion.button>
								<motion.button
									type="button"
									className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/8 hover:text-white"
									whileTap={{ scale: 0.96 }}
									title="Скачать"
								>
									<ArrowDownTrayIcon className="w-4 h-4" />
								</motion.button>
							</div>
						</motion.div>
					))}
				</div>
			)}
		</motion.div>
	);
};

export default CompanyContentWidget;
