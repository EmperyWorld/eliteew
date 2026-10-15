// DEFAULT VIEWER - Fallback for unsupported types
import * as React from 'react';
import {
	ArrowDownTrayIcon,
	DocumentIcon,
	InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { Content } from '../types';

interface DefaultViewerProps {
	content: Content;
	onDownload: () => void;
}

const DefaultViewer: React.FC<DefaultViewerProps> = ({
	content,
	onDownload,
}) => {
	const formatBytes = (bytes: number): string => {
		if (bytes === 0) {
			return '0 Bytes';
		}
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	};

	const getFileExtension = (): string => {
		const parts = content.name.split('.');
		return parts.length > 1
			? (parts[parts.length - 1]?.toUpperCase() ?? 'FILE')
			: 'FILE';
	};

	return (
		<div className="bg-gray-900 p-8 min-h-[400px] flex items-center justify-center">
			<div className="max-w-md w-full text-center">
				{/* DocumentIcon Icon */}
				<div className="mb-6">
					<div className="w-24 h-24 mx-auto bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center relative">
						<DocumentIcon className="w-12 h-12 text-white" />
						<div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-500 rounded-sm text-xs font-bold text-white">
							{getFileExtension()}
						</div>
					</div>
				</div>

				{/* DocumentIcon InformationCircleIcon */}
				<h3 className="text-xl font-semibold text-white mb-2">
					{content.name}
				</h3>
				<p className="text-gray-400 mb-6">
					{formatBytes(content.file_size ?? 0)}
				</p>

				{/* Preview Not Available */}
				<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
					<div className="flex items-start gap-3">
						<InformationCircleIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
						<div className="text-left">
							<p className="text-yellow-400 font-medium mb-1">
								Preview Not Available
							</p>
							<p className="text-sm text-gray-400">
								This file type ({content.content_type}) doesn't support preview.
								ArrowDownTrayIcon the file to view its contents.
							</p>
						</div>
					</div>
				</div>

				{/* ArrowDownTrayIcon Button */}
				<button
					type="button"
					onClick={onDownload}
					className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
				>
					<ArrowDownTrayIcon className="w-5 h-5" />
					ArrowDownTrayIcon DocumentIcon
				</button>

				{/* Additional InformationCircleIcon */}
				{content.mime_type && (
					<div className="mt-6 pt-4 border-t border-white/10">
						<div className="text-sm text-gray-400">
							MIME Type:{' '}
							<span className="text-white font-mono">{content.mime_type}</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default DefaultViewer;
