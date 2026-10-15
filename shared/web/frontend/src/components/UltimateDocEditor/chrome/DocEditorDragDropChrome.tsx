/**
 * Оверлей DnDrop и тост «память/размер файлов» для корневой оболочки редактора.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowUpTrayIcon,
	ExclamationCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export interface DocEditorDragDropChromeProps {
	isDragOver: boolean;
	memoryWarning: string | null;
	memoryWarningSurfaceClass: string;
	reduceMotion: boolean | null;
	zDragOverlay: number;
	zMemoryToast: number;
	onDismissMemoryWarning: () => void;
}

export function DocEditorDragDropChrome({
	isDragOver,
	memoryWarning,
	memoryWarningSurfaceClass,
	reduceMotion,
	zDragOverlay,
	zMemoryToast,
	onDismissMemoryWarning,
}: DocEditorDragDropChromeProps): React.JSX.Element {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	return (
		<>
			{isDragOver && (
				<motion.div
					initial={{ opacity: reduceMotion ? 1 : 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: reduceMotion ? 1 : 0 }}
					className={cn(
						'absolute inset-0 flex items-center justify-center',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{
						zIndex: zDragOverlay,
					}}
				>
					<motion.div
						initial={
							reduceMotion
								? { scale: 1, opacity: 1 }
								: { scale: 0.9, opacity: 0 }
						}
						animate={{ scale: 1, opacity: 1 }}
						exit={
							reduceMotion
								? { scale: 1, opacity: 1 }
								: { scale: 0.9, opacity: 0 }
						}
					>
						<DesktopAppPanel className="p-8 text-center shadow-(--desktop-shadow-panel)">
							<motion.div
								animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
								transition={
									reduceMotion
										? undefined
										: {
												duration: 1.5,
												repeat: Number.POSITIVE_INFINITY,
												ease: 'easeInOut',
											}
								}
								className="mb-4"
							>
								<ArrowUpTrayIcon
									width={64}
									height={64}
									className="mx-auto text-blue-400 drop-shadow-lg"
								/>
							</motion.div>
							<h3 className="mb-2 text-xl font-bold text-(--desktop-text-primary)">
								{t('dragDrop.overlayTitle')}
							</h3>
							<p className="text-(--desktop-text-muted)">
								{t('dragDrop.overlayHint')}
							</p>
						</DesktopAppPanel>
					</motion.div>
				</motion.div>
			)}

			<AnimatePresence>
				{memoryWarning && (
					<motion.div
						initial={
							reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }
						}
						animate={{ opacity: 1, x: 0 }}
						exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 100 }}
						className={cn(
							'absolute right-4 top-4 max-w-sm p-4 backdrop-blur-xl',
							memoryWarningSurfaceClass,
							'bg-red-500/10'
						)}
						style={{
							zIndex: zMemoryToast,
						}}
					>
						<div className="flex items-center gap-3">
							<div className="rounded-lg border border-red-500/50 bg-red-500/30 p-2">
								<ExclamationCircleIcon
									width={20}
									height={20}
									className="text-red-300"
								/>
							</div>
							<div className="flex-1">
								<h4 className="mb-1 font-bold text-(--desktop-text-primary)">
									{t('dragDrop.memoryWarningTitle')}
								</h4>
								<p className="text-sm leading-relaxed text-red-100/90">
									{memoryWarning}
								</p>
							</div>
							<DesktopAppButton
								onClick={onDismissMemoryWarning}
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								aria-label={t('dragDrop.dismissWarningAria')}
								title={t('dragDrop.dismissWarningTitle')}
							>
								<XMarkIcon
									width={16}
									height={16}
									className="text-(--desktop-text-muted)"
								/>
							</DesktopAppButton>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
