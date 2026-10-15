/**
 * Карточка «О собеседнике»: аватар, профиль, возможности чата, особенности.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';

import type { DesktopAiHero } from './desktopAiHeroes';
import { useDesktopAiDialogFocusTrap } from './useDesktopAiDialogFocusTrap';

import './DesktopAiHeroDossierModal.css';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type DesktopAiHeroDossierModalProps = {
	open: boolean;
	onClose: () => void;
	hero: DesktopAiHero | null;
	/** Заголовок персонажа, если герой не задан (стандартный ассистент) */
	fallbackTitle: string;
	/** Кратко: что доступно в среде (из buildToolsTooltip) */
	toolsEnvironmentLine: string;
	/** Отображаемое имя языковой модели для чата */
	modelLabel: string;
	/** Версия промпта в коде героя (если герой выбран) */
	heroPromptVersion?: number | null;
};

export function DesktopAiHeroDossierModal({
	open,
	onClose,
	hero,
	fallbackTitle,
	toolsEnvironmentLine,
	modelLabel,
	heroPromptVersion,
}: DesktopAiHeroDossierModalProps) {
	const { t } = useTranslation('desktopAiChat');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const dialogRef = React.useRef<HTMLDivElement>(null);
	useDesktopAiDialogFocusTrap(dialogRef, open);

	const prevFocusRef = React.useRef<HTMLElement | null>(null);
	React.useEffect(() => {
		if (!open) {
			return;
		}
		prevFocusRef.current = document.activeElement as HTMLElement | null;
		const raf = requestAnimationFrame(() => {
			const panel = dialogRef.current;
			if (panel) {
				panel.focus();
			}
		});
		return () => cancelAnimationFrame(raf);
	}, [open]);

	React.useEffect(() => {
		if (open) {
			return;
		}
		const el = prevFocusRef.current;
		prevFocusRef.current = null;
		if (el?.focus) {
			requestAnimationFrame(() => el.focus());
		}
	}, [open]);

	React.useEffect(() => {
		if (!open) {
			return;
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	const title = hero?.label ?? fallbackTitle;
	const profileBlurb = hero?.description ?? t('dossierProfileFallback');
	const toolsNarrative = hero?.dossierTools ?? t('dossierToolsFallback');
	const traits =
		hero?.dossierTraits ??
		([
			t('dossierTraitDefault1'),
			t('dossierTraitDefault2'),
			t('dossierTraitDefault3'),
		] as const);

	return (
		<div
			className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto"
				aria-label={t('dossierCloseOverlay')}
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="hero-dossier-title"
				tabIndex={-1}
				style={{ zIndex: embeddedModalZ.content }}
				className={[
					'desktop-ai-hero-dossier-dialog relative pointer-events-auto w-full max-w-md max-h-[min(90vh,640px)] overflow-y-auto outline-none',
					'rounded-xl border-[3px] border-double border-amber-700/45',
					'shadow-[0_28px_100px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]',
					DESKTOP_SURFACE.radiusLg,
				].join(' ')}
			>
				<div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-500/35 to-transparent" />
				<div className="flex items-start justify-between gap-2 border-b border-amber-900/40 px-4 py-3 bg-black/25">
					<div>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.sectionOverlineStrong,
								'normal-case text-amber-200/75'
							)}
						>
							{t('dossierKicker')}
						</p>
						<p
							className={cn(
								'mt-0.5 tracking-widest text-(--desktop-text-dim)',
								DESKTOP_TYPOGRAPHY.micro,
								'font-normal'
							)}
						>
							{t('dossierSubkicker')}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className={`shrink-0 rounded-lg p-2 border border-white/12 text-(--desktop-text-secondary) hover:text-white hover:bg-white/8 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0c0a] ${DESKTOP_INTERACTIVE.btnRounded}`}
						aria-label={t('dossierClose')}
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				</div>

				<div className="px-4 pb-4 pt-4 space-y-4">
					<div className="flex gap-4">
						<div className="shrink-0">
							{hero ? (
								<div className="relative">
									<div className="absolute -inset-1 rounded-full border border-amber-600/30 opacity-80" />
									<img
										src={hero.avatarPublicPath}
										alt=""
										className="relative h-24 w-24 rounded-full object-cover border-2 border-amber-800/50 shadow-md"
									/>
								</div>
							) : (
								<div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-800/40 bg-black/35">
									<SparklesIcon
										className="h-10 w-10 text-[rgb(var(--desktop-accent-rgb)/0.85)]"
										aria-hidden
									/>
								</div>
							)}
						</div>
						<div className="min-w-0 flex-1 pt-1">
							<h2
								id="hero-dossier-title"
								className={cn(
									DESKTOP_TYPOGRAPHY.subtitle,
									'leading-snug text-amber-100/95'
								)}
							>
								{title}
							</h2>
							<p
								className={cn(
									'mt-1 text-(--desktop-text-dim)',
									DESKTOP_TYPOGRAPHY.small
								)}
							>
								{t('dossierModel')}{' '}
								<span className="text-(--desktop-text-secondary)">
									{modelLabel}
								</span>
							</p>
							{hero && heroPromptVersion != null ? (
								<p
									className={cn(
										'mt-0.5 text-(--desktop-text-dim)',
										DESKTOP_TYPOGRAPHY.small
									)}
								>
									{t('dossierPromptVersion')}{' '}
									<span className="text-(--desktop-text-secondary)">
										v{heroPromptVersion}
									</span>
								</p>
							) : null}
						</div>
					</div>

					<section
						aria-labelledby="dossier-profile-heading"
						className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
					>
						<h3
							id="dossier-profile-heading"
							className={cn(
								'mb-1.5 uppercase tracking-wide font-semibold text-amber-200/85',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{t('dossierProfileHeading')}
						</h3>
						<p className="text-xs leading-relaxed text-(--desktop-text-secondary) antialiased">
							{profileBlurb}
						</p>
					</section>

					<section
						aria-labelledby="dossier-tools-heading"
						className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
					>
						<h3
							id="dossier-tools-heading"
							className={cn(
								'mb-1.5 uppercase tracking-wide font-semibold text-amber-200/85',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{t('dossierToolsHeading')}
						</h3>
						<p className="text-xs leading-relaxed text-(--desktop-text-secondary) antialiased">
							{toolsNarrative}
						</p>
						<p
							className={cn(
								'mt-2 border-t border-white/8 pt-2 text-(--desktop-text-dim)',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							<span className="text-(--desktop-text-muted)">
								{t('dossierEnvLine')}{' '}
							</span>
							{toolsEnvironmentLine}
						</p>
					</section>

					<section aria-labelledby="dossier-traits-heading">
						<h3
							id="dossier-traits-heading"
							className={cn(
								'mb-2 uppercase tracking-wide font-semibold text-amber-200/85',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{t('dossierTraitsHeading')}
						</h3>
						<ul className="space-y-1.5">
							{traits.map((traitLine) => (
								<li
									key={traitLine}
									className="flex gap-2 text-xs text-(--desktop-text-secondary) antialiased"
								>
									<span
										className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/70"
										aria-hidden
									/>
									<span className="min-w-0">{traitLine}</span>
								</li>
							))}
						</ul>
					</section>

					<div className="flex flex-wrap items-center justify-end gap-2 pt-1">
						<button
							type="button"
							onClick={onClose}
							className={`rounded-xl px-4 py-2 text-sm border border-amber-800/50 bg-amber-950/35 text-amber-100/95 hover:bg-amber-950/55 ${DESKTOP_INTERACTIVE.btnRounded}`}
						>
							{t('dossierOk')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
