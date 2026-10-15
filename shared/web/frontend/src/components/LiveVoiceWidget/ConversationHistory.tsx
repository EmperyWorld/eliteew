/**
 * ConversationHistory - Панель истории разговоров
 *
 * Премиум дизайн: элегантные карточки с историей диалогов
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
	ArrowPathIcon,
	ClockIcon,
	MagnifyingGlassIcon,
	PlayIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { LIVE_VOICE_HISTORY_UPDATED_EVENT } from '@/voice-core';
import { registerTtsPlaying } from '@/voice-core/micActive';
import { resolveAudioUrlForPlayback } from '@/voice-core/utils/resolveAudioUrlForPlayback';
import { apiClient } from '../../services/api';
import { log } from '../../utils/logger';

interface ConversationItem {
	id: string;
	userText: string;
	aiResponse: string;
	timestamp: Date;
	duration: number; // в секундах
}

interface ConversationApiResponse {
	id: string;
	user_text: string;
	ai_response: string;
	created_at: string;
	duration_ms: number;
	audio_url?: string;
}

interface HistoryApiResponse {
	conversations: ConversationApiResponse[];
}

interface ConversationHistoryProps {
	userId?: string;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
	userId,
}) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [conversations, setConversations] = useState<ConversationItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadHistory = useCallback(async (): Promise<void> => {
		if (!userId) {
			return;
		}

		setIsLoading(true);
		try {
			const response = await apiClient.get<HistoryApiResponse>(
				'/api/v1/live-voice/history',
				{
					params: { limit: 20, offset: 0 },
				}
			);
			const historyData = response.data?.conversations || [];
			setConversations(
				historyData.map(
					(conv: ConversationApiResponse): ConversationItem => ({
						id: conv.id,
						userText: conv.user_text,
						aiResponse: conv.ai_response,
						timestamp: new Date(conv.created_at),
						duration: Math.round(conv.duration_ms / 1000),
					})
				)
			);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			log.error('ConversationHistory', 'Failed to load history', err);
		} finally {
			setIsLoading(false);
		}
	}, [userId]);

	React.useEffect(() => {
		void loadHistory();
	}, [loadHistory]);

	React.useEffect(() => {
		const handler = (): void => {
			void loadHistory();
		};
		window.addEventListener(LIVE_VOICE_HISTORY_UPDATED_EVENT, handler);
		return (): void =>
			window.removeEventListener(LIVE_VOICE_HISTORY_UPDATED_EVENT, handler);
	}, [loadHistory]);

	// Поиск по истории
	React.useEffect((): (() => void) | undefined => {
		if (!searchQuery || !userId) {
			// Перезагружаем полную историю
			const loadHistory = async (): Promise<void> => {
				setIsLoading(true);
				try {
					const response = await apiClient.get<HistoryApiResponse>(
						'/api/v1/live-voice/history',
						{
							params: { limit: 20, offset: 0 },
						}
					);
					const historyData = response.data?.conversations || [];
					setConversations(
						historyData.map(
							(conv: ConversationApiResponse): ConversationItem => ({
								id: conv.id,
								userText: conv.user_text,
								aiResponse: conv.ai_response,
								timestamp: new Date(conv.created_at),
								duration: Math.round(conv.duration_ms / 1000),
							})
						)
					);
				} catch (error) {
					const err = error instanceof Error ? error : new Error(String(error));
					log.error('ConversationHistory', 'Failed to load history', err);
				} finally {
					setIsLoading(false);
				}
			};
			void loadHistory();
			return undefined;
		}

		// Выполняем поиск
		const searchHistory = async (): Promise<void> => {
			setIsLoading(true);
			try {
				const response = await apiClient.get<HistoryApiResponse>(
					'/api/v1/live-voice/history/search',
					{
						params: { query: searchQuery, limit: 20 },
					}
				);
				const historyData = response.data?.conversations || [];
				setConversations(
					historyData.map(
						(conv: ConversationApiResponse): ConversationItem => ({
							id: conv.id,
							userText: conv.user_text,
							aiResponse: conv.ai_response,
							timestamp: new Date(conv.created_at),
							duration: Math.round(conv.duration_ms / 1000),
						})
					)
				);
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				log.error('ConversationHistory', 'Failed to search history', err);
			} finally {
				setIsLoading(false);
			}
		};

		const timeoutId = setTimeout((): void => {
			void searchHistory();
		}, 300); // Debounce
		return (): void => {
			clearTimeout(timeoutId);
		};
	}, [searchQuery, userId]);

	// Фильтрация уже выполняется на сервере через API

	const formatTime = (date: Date): string => {
		return new Intl.DateTimeFormat('ru-RU', {
			hour: '2-digit',
			minute: '2-digit',
			day: '2-digit',
			month: '2-digit',
		}).format(date);
	};

	return (
		<div className="space-y-4">
			{/* Поиск */}
			<div className="relative">
				<MagnifyingGlassIcon
					className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
					width={16}
					height={16}
				/>
				<input
					type="text"
					placeholder="Поиск в истории..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="
            w-full pl-10 pr-4 py-2
            bg-white/3 border border-white/8 rounded-lg
            text-white text-sm
            placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400/40
            transition-all duration-200
          "
				/>
			</div>

			{/* Список разговоров */}
			<div className="space-y-2 max-h-[400px] overflow-y-auto">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<ArrowPathIcon
							className="animate-spin text-indigo-400"
							width={20}
							height={20}
						/>
						<span className="ml-2 text-gray-400 text-sm">Загрузка...</span>
					</div>
				) : conversations.length === 0 ? (
					<div className="text-center py-8 text-gray-400 text-sm">
						{searchQuery ? 'Ничего не найдено' : 'История пуста'}
					</div>
				) : (
					conversations.map((conv) => (
						<motion.div
							key={conv.id}
							className="
                p-4
                bg-white/2 border border-white/6 rounded-xl
                transition-all duration-200
                hover:bg-white/4 hover:border-white/12
                cursor-pointer
              "
							whileHover={{ y: -2 }}
							whileTap={{ scale: 0.98 }}
						>
							{/* Заголовок с временем */}
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2 text-xs text-gray-400">
									<ClockIcon width={12} height={12} />
									<span>{formatTime(conv.timestamp)}</span>
									<span>•</span>
									<span>{conv.duration}с</span>
								</div>
								<button
									type="button"
									className="text-gray-400 hover:text-red-400 transition-colors p-1"
									onClick={async (e) => {
										e.stopPropagation();
										try {
											await apiClient.delete(
												`/api/v1/live-voice/history/${conv.id}`
											);
											setConversations((prev) =>
												prev.filter((c) => c.id !== conv.id)
											);
										} catch (error) {
											const err =
												error instanceof Error
													? error
													: new Error(String(error));
											log.error(
												'ConversationHistory',
												'Failed to delete conversation',
												err
											);
										}
									}}
									aria-label="Удалить разговор"
								>
									<TrashIcon width={14} height={14} />
								</button>
							</div>

							{/* Пользовательский текст */}
							<div className="mb-2">
								<div className="text-xs text-gray-500 mb-1">Вы:</div>
								<div className="text-sm text-gray-300">{conv.userText}</div>
							</div>

							{/* Ответ AI */}
							<div>
								<div className="text-xs text-gray-500 mb-1">AI:</div>
								<div className="text-sm text-white">{conv.aiResponse}</div>
							</div>

							{/* Кнопка воспроизведения */}
							<button
								type="button"
								className="
                  mt-3 w-full py-2 px-4
                  bg-indigo-500/20 border border-indigo-500/30 rounded-lg
                  text-indigo-400 text-sm font-medium
                  flex items-center justify-center gap-2
                  hover:bg-indigo-500/30 hover:border-indigo-500/40
                  transition-all duration-200
                "
								onClick={async () => {
									try {
										const response = await apiClient.post<{
											audio_url?: string;
										}>('/api/v1/live-voice/speak-text', {
											text: conv.aiResponse,
											voice: 'auto',
											language: 'auto',
										});
										const audioUrl = response.data?.audio_url;
										if (audioUrl && typeof audioUrl === 'string') {
											const { playUrl, revoke } =
												await resolveAudioUrlForPlayback(audioUrl);
											const unregisterTts = registerTtsPlaying();
											const audio = new Audio(playUrl);
											audio.onended = () => {
												revoke();
												unregisterTts();
											};
											audio.onerror = () => {
												revoke();
												unregisterTts();
											};
											await audio.play();
										}
									} catch (error) {
										const err =
											error instanceof Error ? error : new Error(String(error));
										log.error(
											'ConversationHistory',
											'Failed to play audio',
											err
										);
									}
								}}
							>
								<PlayIcon width={14} height={14} />
								Воспроизвести ответ
							</button>
						</motion.div>
					))
				)}
			</div>
		</div>
	);
};
