import { AnimatePresence, motion } from 'framer-motion';
import type { FC } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { DesktopAppButton } from '../../../pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import {
	PhotoIcon,
	SparklesIcon,
	TableCellsIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

export interface UltimateDocEditorQuickStartGuideOverlayProps {
	open: boolean;
	reduceMotion: boolean | null;
	cardClassName: string;
	contentSurfacePresetClass: string;
	zIndex: number;
	onDismissThanks: () => void;
	onRequestInterfaceTour: () => void;
}

const boldClass = 'text-(--desktop-text-primary)';

export const UltimateDocEditorQuickStartGuideOverlay: FC<
	UltimateDocEditorQuickStartGuideOverlayProps
> = ({
	open,
	reduceMotion,
	cardClassName,
	contentSurfacePresetClass,
	zIndex,
	onDismissThanks,
	onRequestInterfaceTour,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={
						reduceMotion
							? { opacity: 1, y: 0, scale: 1 }
							: { opacity: 0, y: -20, scale: 0.95 }
					}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={
						reduceMotion
							? { opacity: 1, y: 0, scale: 1 }
							: { opacity: 0, y: -20, scale: 0.95 }
					}
					className={cardClassName}
					style={{
						zIndex,
					}}
				>
					<div className={cn('p-6', contentSurfacePresetClass)}>
						<div className="text-center">
							<motion.div
								className="mb-4 inline-block rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) p-3 text-white"
								whileHover={
									reduceMotion ? undefined : { scale: 1.1, rotate: 5 }
								}
							>
								<SparklesIcon width={24} height={24} />
							</motion.div>
							<h3 className="mb-2 text-xl font-extrabold text-(--desktop-text-primary)">
								{t('quickStart.title')}
							</h3>
							<p className="mb-4 text-sm font-medium leading-relaxed text-(--desktop-text-secondary)">
								{t('quickStart.subtitle')}
							</p>
							<div className="mb-4 space-y-2 text-left text-sm text-(--desktop-text-muted)">
								<div className="flex items-center gap-2">
									<SparklesIcon
										width={16}
										height={16}
										className="text-[rgb(var(--desktop-accent-rgb))]"
									/>
									<span>
										<Trans
											ns={ULTIMATE_DOC_EDITOR_NS}
											i18nKey="quickStart.bulletAi"
											components={{
												bold: <strong className={boldClass} />,
											}}
										/>
									</span>
								</div>
								<div className="flex items-center gap-2">
									<PhotoIcon width={16} height={16} className="text-pink-400" />
									<span>
										<Trans
											ns={ULTIMATE_DOC_EDITOR_NS}
											i18nKey="quickStart.bulletImage"
											components={{
												bold: <strong className={boldClass} />,
											}}
										/>
									</span>
								</div>
								<div className="flex items-center gap-2">
									<UsersIcon
										width={16}
										height={16}
										className="text-green-400"
									/>
									<span>
										<Trans
											ns={ULTIMATE_DOC_EDITOR_NS}
											i18nKey="quickStart.bulletCollab"
											components={{
												bold: <strong className={boldClass} />,
											}}
										/>
									</span>
								</div>
								<div className="flex items-center gap-2">
									<TableCellsIcon
										width={16}
										height={16}
										className="text-blue-400"
									/>
									<span>
										<Trans
											ns={ULTIMATE_DOC_EDITOR_NS}
											i18nKey="quickStart.bulletAdvanced"
											components={{
												bold: <strong className={boldClass} />,
											}}
										/>
									</span>
								</div>
							</div>
							<div className="mb-4 text-xs font-medium text-(--desktop-text-dim)">
								{t('quickStart.hint')}
							</div>
							<div className="flex flex-wrap gap-2">
								<DesktopAppButton
									onClick={() => {
										onDismissThanks();
										onRequestInterfaceTour();
									}}
									variant="neutral"
									className="px-4 py-2 text-sm font-bold"
								>
									{t('quickStart.tour')}
								</DesktopAppButton>
								<DesktopAppButton
									onClick={onDismissThanks}
									variant="accent"
									className="px-4 py-2 text-sm font-bold"
								>
									{t('quickStart.dismiss')}
								</DesktopAppButton>
							</div>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};
