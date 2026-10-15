/**
 * PipelineStatus - Компонент отображения статуса pipeline обработки
 *
 * Оптимизации:
 * - Мемоизация для предотвращения лишних ререндеров
 * - Оптимизированные анимации
 */

import * as React from 'react';
import { memo, useMemo } from 'react';
import {
	CheckCircleIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	MicrophoneIcon,
	PlayIcon,
	SparklesIcon,
	SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import type { PipelineStage } from './hooks/useLiveVoice';

interface PipelineStatusProps {
	currentStage: PipelineStage;
	progress?: number; // 0-100
}

// ✅ OPTIMIZED: Вынесено за пределы компонента для предотвращения пересоздания
const stages: Array<{
	id: PipelineStage;
	label: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
	{ id: 'recording', label: 'Запись', icon: MicrophoneIcon },
	{ id: 'transcribing', label: 'Транскрибация', icon: DocumentTextIcon },
	{ id: 'generating', label: 'Генерация ответа', icon: SparklesIcon },
	{ id: 'synthesizing', label: 'Синтез речи', icon: SpeakerWaveIcon },
	{ id: 'playing', label: 'Воспроизведение', icon: PlayIcon },
	{ id: 'completed', label: 'Завершено', icon: CheckCircleIcon },
];

// ✅ OPTIMIZED: Мемоизированный компонент
export const PipelineStatus: React.FC<PipelineStatusProps> = memo(
	({
		currentStage,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		progress: _progress,
	}) => {
		// ✅ OPTIMIZED: Мемоизация вычислений
		const currentIndex = useMemo(
			() => stages.findIndex((s) => s.id === currentStage),
			[currentStage]
		);
		const isError = currentStage === 'error';

		if (isError) {
			return (
				<div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
					<div className="flex items-center gap-2 text-red-400">
						<ExclamationCircleIcon width={20} height={20} />
						<span className="text-sm font-medium">Ошибка обработки</span>
					</div>
				</div>
			);
		}

		return (
			<div className="space-y-3">
				<div className="flex items-center justify-between text-xs text-gray-400 mb-2">
					<span>Статус обработки</span>
					<span>
						{currentIndex + 1} / {stages.length}
					</span>
				</div>

				<div className="space-y-2">
					{stages.map((stage, index) => {
						const Icon = stage.icon;
						const isActive = index === currentIndex;
						const isCompleted = index < currentIndex;

						return (
							<motion.div
								key={stage.id}
								initial={{ opacity: 0, x: -10 }}
								animate={{
									opacity: isActive ? 1 : isCompleted ? 0.6 : 0.4,
									x: 0,
								}}
								className={`
                flex items-center gap-3 p-2 rounded-lg
                transition-all duration-200
                ${
									isActive
										? 'bg-indigo-500/20 border border-indigo-500/30'
										: isCompleted
											? 'bg-green-500/10 border border-green-500/20'
											: 'bg-white/5 border border-white/8'
								}
              `}
							>
								<div
									className={`
                flex items-center justify-center w-8 h-8 rounded-lg
                ${
									isActive
										? 'bg-indigo-500/30 text-indigo-400'
										: isCompleted
											? 'bg-green-500/20 text-green-400'
											: 'bg-white/5 text-gray-500'
								}
              `}
								>
									<Icon width={16} height={16} />
								</div>

								<div className="flex-1">
									<div
										className={`
                  text-sm font-medium
                  ${isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-500'}
                `}
									>
										{stage.label}
									</div>
								</div>

								{isActive && (
									<motion.div
										className="w-2 h-2 bg-indigo-400 rounded-full"
										animate={{
											scale: [1, 1.2, 1],
											opacity: [1, 0.7, 1],
										}}
										transition={{
											duration: 1.5,
											repeat: Infinity,
											ease: 'easeInOut',
										}}
									/>
								)}

								{isCompleted && (
									<CheckCircleIcon
										width={16}
										height={16}
										className="text-green-400"
									/>
								)}
							</motion.div>
						);
					})}
				</div>
			</div>
		);
	}
);

// ✅ Display name для DevTools
PipelineStatus.displayName = 'PipelineStatus';
