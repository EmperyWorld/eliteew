// AI RESULT VIEWER - Formatted JSON/Markdown AI results
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
	ArrowDownTrayIcon,
	CheckIcon,
	CircleStackIcon,
	CodeBracketIcon,
	DocumentDuplicateIcon,
	EyeIcon,
} from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import type { Content } from '../types';

interface AIResultViewerProps {
	content: Content;
	fileUrl?: string;
	isFullscreen: boolean;
	onDownload?: () => void;
}

const AIResultViewer: React.FC<AIResultViewerProps> = ({
	content,
	fileUrl,
	onDownload,
}) => {
	const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
	const [copied, setCopied] = useState(false);
	const [fileContent, setFileContent] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Extract AI result data from metadata
	const aiResult: Record<string, unknown> =
		content.metadata &&
		typeof content.metadata === 'object' &&
		'ai_result' in content.metadata
			? ((content.metadata as { ai_result?: Record<string, unknown> })
					.ai_result ?? {})
			: content.metadata && typeof content.metadata === 'object'
				? (content.metadata as Record<string, unknown>)
				: {};
	const hasStructuredData =
		typeof aiResult === 'object' &&
		aiResult !== null &&
		Object.keys(aiResult).length > 0;

	useEffect(() => {
		const loadFileContent = async (): Promise<void> => {
			if (!fileUrl) {
				return;
			}

			setLoading(true);
			setError(null);

			try {
				const response = await fetch(fileUrl);
				const buffer = await response.arrayBuffer();

				// Try UTF-8 first
				let text = new TextDecoder('utf-8').decode(buffer);

				// If text contains replacement characters (�), try other encodings
				if (text.includes('�')) {
					// Try Windows-1251 (common for Russian)
					try {
						text = new TextDecoder('windows-1251').decode(buffer);
					} catch {
						// Fallback to UTF-8 if decoding fails
					}
				}

				setFileContent(text);
			} catch (err: unknown) {
				const error = err instanceof Error ? err : new Error(String(err));
				log.error('AIResultViewer', 'Failed to load file content', error);
				setError('Unable to load file content');
			} finally {
				setLoading(false);
			}
		};

		loadFileContent();
	}, [fileUrl]);

	const copyToClipboard = (): void => {
		const textToCopy =
			viewMode === 'raw'
				? JSON.stringify(aiResult, null, 2)
				: JSON.stringify(aiResult);

		navigator.clipboard.writeText(textToCopy).catch((err: unknown) => {
			const error = err instanceof Error ? err : new Error(String(err));
			log.error('AIResultViewer', 'Failed to copy to clipboard', error);
		});
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const renderFormattedResult = (): React.JSX.Element => {
		// If we have file content, display it
		if (fileContent) {
			return (
				<div className="bg-black/40 border border-white/10 rounded-lg p-4">
					<pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 overflow-x-auto">
						{fileContent}
					</pre>
				</div>
			);
		}

		// Fallback to metadata if no file content
		if (!hasStructuredData) {
			return (
				<div className="text-center py-8 text-gray-400">
					No AI result data available
				</div>
			);
		}

		// CheckIcon for common AI result patterns
		if (
			typeof aiResult === 'object' &&
			aiResult !== null &&
			'analysis' in aiResult
		) {
			const analysis = (
				aiResult as {
					analysis?: {
						summary?: unknown;
						insights?: unknown[];
						recommendations?: unknown[];
					};
				}
			).analysis;
			if (analysis && typeof analysis === 'object') {
				return (
					<div className="space-y-4">
						{typeof analysis.summary === 'string' && analysis.summary && (
							<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
								<h4 className="text-blue-400 font-semibold mb-2">Summary</h4>
								<p className="text-white">{analysis.summary}</p>
							</div>
						)}
						{Array.isArray(analysis.insights) &&
							analysis.insights.length > 0 && (
								<div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
									<h4 className="text-purple-400 font-semibold mb-2">
										Key Insights
									</h4>
									<ul className="list-disc list-inside text-white space-y-1">
										{analysis.insights.map((insight: unknown) => (
											<li key={String(insight)}>{String(insight)}</li>
										))}
									</ul>
								</div>
							)}
						{Array.isArray(analysis.recommendations) &&
							analysis.recommendations.length > 0 && (
								<div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
									<h4 className="text-green-400 font-semibold mb-2">
										Recommendations
									</h4>
									<ul className="list-disc list-inside text-white space-y-1">
										{analysis.recommendations.map((rec: unknown) => (
											<li key={String(rec)}>{String(rec)}</li>
										))}
									</ul>
								</div>
							)}
					</div>
				);
			}
		}

		// Generic key-value rendering
		return (
			<div className="space-y-3">
				{typeof aiResult === 'object' &&
					aiResult !== null &&
					Object.entries(aiResult).map(([key, value]) => (
						<div
							key={key}
							className="bg-black/40 border border-white/10 rounded-lg p-4"
						>
							<div className="text-sm text-gray-400 mb-1 font-mono">{key}</div>
							<div className="text-white">
								{typeof value === 'object' ? (
									<pre className="text-sm font-mono overflow-x-auto">
										{JSON.stringify(value, null, 2)}
									</pre>
								) : (
									<span>{String(value)}</span>
								)}
							</div>
						</div>
					))}
			</div>
		);
	};

	if (loading) {
		return (
			<div className="bg-linear-to-br from-blue-900/20 to-purple-900/20 p-6 min-h-[400px] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p className="text-gray-400">Loading file content...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-linear-to-br from-blue-900/20 to-purple-900/20 p-6 min-h-[400px] flex items-center justify-center">
				<div className="text-center">
					<p className="text-red-400 mb-4">{error}</p>
					{onDownload && (
						<button
							type="button"
							onClick={onDownload}
							className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
						>
							<ArrowDownTrayIcon className="w-5 h-5" />
							ArrowDownTrayIcon File
						</button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="bg-linear-to-br from-blue-900/20 to-purple-900/20 p-6 min-h-[400px]">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-blue-500/20 rounded-lg">
							<CircleStackIcon className="w-6 h-6 text-blue-400" />
						</div>
						<div>
							<h3 className="text-lg font-semibold text-white">
								{content.name}
							</h3>
							<p className="text-sm text-gray-400">AI Analysis Result</p>
						</div>
					</div>

					{/* View Mode Toggle */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setViewMode('formatted')}
							className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
								viewMode === 'formatted'
									? 'bg-blue-500/30 text-blue-400'
									: 'bg-black/40 text-gray-400 hover:bg-black/60'
							}`}
						>
							<EyeIcon className="w-4 h-4" />
							<span className="text-sm">Formatted</span>
						</button>
						<button
							type="button"
							onClick={() => setViewMode('raw')}
							className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
								viewMode === 'raw'
									? 'bg-purple-500/30 text-purple-400'
									: 'bg-black/40 text-gray-400 hover:bg-black/60'
							}`}
						>
							<CodeBracketIcon className="w-4 h-4" />
							<span className="text-sm">Raw JSON</span>
						</button>
						<button
							type="button"
							onClick={copyToClipboard}
							className="p-2 bg-black/40 hover:bg-black/60 rounded-lg transition-colors text-white"
							title="DocumentDuplicateIcon to clipboard"
						>
							{copied ? (
								<CheckIcon className="w-4 h-4 text-green-400" />
							) : (
								<DocumentDuplicateIcon className="w-4 h-4" />
							)}
						</button>
					</div>
				</div>

				{/* Content */}
				{viewMode === 'formatted' ? (
					renderFormattedResult()
				) : (
					<div className="bg-black/60 rounded-lg p-4 border border-white/10">
						<pre className="text-sm font-mono text-green-400 overflow-x-auto">
							{JSON.stringify(aiResult, null, 2)}
						</pre>
					</div>
				)}

				{/* Metadata */}
				{content.metadata &&
					typeof content.metadata === 'object' &&
					'model' in content.metadata &&
					((): React.JSX.Element | null => {
						const metadata = content.metadata as {
							model?: unknown;
							tokens?: unknown;
							duration?: unknown;
						};
						const modelStr = String(metadata.model ?? '');
						const tokensValue = metadata.tokens;
						const durationValue = metadata.duration;
						return (
							<div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
								<span>
									Model: <span className="text-white">{modelStr}</span>
								</span>
								{tokensValue !== undefined && tokensValue !== null && (
									<span>
										Tokens:{' '}
										<span className="text-white">{String(tokensValue)}</span>
									</span>
								)}
								{durationValue !== undefined && durationValue !== null && (
									<span>
										Duration:{' '}
										<span className="text-white">{String(durationValue)}s</span>
									</span>
								)}
							</div>
						);
					})()}
			</div>
		</div>
	);
};

export default AIResultViewer;
