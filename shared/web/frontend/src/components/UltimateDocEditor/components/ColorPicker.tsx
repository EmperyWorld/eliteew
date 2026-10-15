/**
 * Color picker for text color and highlight (keyboard: arrows, Home, End, Enter; Esc closes).
 */

import * as React from 'react';
import {
	useState,
	useRef,
	useEffect,
	useLayoutEffect,
	useCallback,
	useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppMenuSurface,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '../../../pages/Desktop/shell/shellPortal';
import { useDocEditorToolbarPortalPopoverZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	CheckIcon,
	SparklesIcon,
	SwatchIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

interface ColorPickerProps {
	type: 'text' | 'highlight';
	currentColor?: string;
	onColorChange: (color: string) => void;
	onClose: () => void;
	position?: { x: number; y: number };
}

const PRESET_COLORS = [
	'#000000',
	'#FFFFFF',
	'#FF0000',
	'#00FF00',
	'#0000FF',
	'#FFFF00',
	'#FF00FF',
	'#00FFFF',
	'#FFA500',
	'#800080',
	'#FFC0CB',
	'#A52A2A',
	'#808080',
	'#000080',
	'#008000',
	'#FFFF00',
	'#FFE5B4',
	'#FFB6C1',
	'#90EE90',
	'#87CEEB',
	'#DDA0DD',
	'#F0E68C',
	'#FFA07A',
	'#98D8C8',
	'#F5DEB3',
];

const CUSTOM_COLORS_KEY = 'editor-custom-colors';
const SWATCH_COLS = 8;

export const ColorPicker: React.FC<ColorPickerProps> = ({
	type,
	currentColor = type === 'text' ? '#000000' : '#FFFF00',
	onColorChange,
	onClose,
	position,
}) => {
	const { t } = useTranslation('ultimateDocEditor');
	const toolbarPortalPopoverZ = useDocEditorToolbarPortalPopoverZIndex();
	const [customColor, setCustomColor] = useState(currentColor);
	const [resolvedPosition, setResolvedPosition] = useState(position);
	const [customColors, setCustomColors] = useState<string[]>(() => {
		const saved = localStorage.getItem(CUSTOM_COLORS_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as unknown;
				if (
					Array.isArray(parsed) &&
					parsed.every((item) => typeof item === 'string')
				) {
					return parsed as string[];
				}
			} catch {
				/* ignore */
			}
		}
		return [];
	});
	const pickerRef = useRef<HTMLDivElement>(null);
	const allColors = useMemo(
		() => [...PRESET_COLORS, ...customColors],
		[customColors]
	);
	const focusedSwatchRef = useRef(0);

	useEffect(() => {
		setResolvedPosition(position);
	}, [position]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent): void => {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return (): void => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [onClose]);

	useLayoutEffect(() => {
		if (!position || !pickerRef.current) {
			return;
		}

		const updatePosition = (): void => {
			if (!pickerRef.current) {
				return;
			}

			const rect = pickerRef.current.getBoundingClientRect();
			const padding = 12;
			const gap = 8;
			const width = rect.width || 320;
			const height = rect.height || 320;

			let nextLeft = position.x;
			if (nextLeft + width > window.innerWidth - padding) {
				const flippedLeft = position.x - width - gap;
				nextLeft =
					flippedLeft >= padding
						? flippedLeft
						: window.innerWidth - width - padding;
			}

			let nextTop = position.y;
			if (nextTop + height > window.innerHeight - padding) {
				const flippedTop = position.y - height - gap;
				nextTop =
					flippedTop >= padding
						? flippedTop
						: window.innerHeight - height - padding;
			}

			nextLeft = Math.min(
				Math.max(nextLeft, padding),
				Math.max(padding, window.innerWidth - width - padding)
			);
			nextTop = Math.min(
				Math.max(nextTop, padding),
				Math.max(padding, window.innerHeight - height - padding)
			);

			setResolvedPosition({ x: nextLeft, y: nextTop });
		};

		const frame = window.requestAnimationFrame(updatePosition);
		window.addEventListener('resize', updatePosition);
		return (): void => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updatePosition);
		};
	}, [position]);

	useEffect(() => {
		const cap = allColors.length ? allColors.length - 1 : 0;
		focusedSwatchRef.current = Math.min(focusedSwatchRef.current, cap);
	}, [allColors.length]);

	const handleColorSelect = useCallback(
		(color: string): void => {
			onColorChange(color);
			if (!customColors.includes(color) && !PRESET_COLORS.includes(color)) {
				const newCustomColors = [color, ...customColors].slice(0, 10);
				setCustomColors(newCustomColors);
				localStorage.setItem(
					CUSTOM_COLORS_KEY,
					JSON.stringify(newCustomColors)
				);
			}
			onClose();
		},
		[customColors, onClose, onColorChange]
	);

	const handleCustomColorSubmit = (): void => {
		if (customColor && /^#[0-9A-F]{6}$/i.test(customColor)) {
			handleColorSelect(customColor);
		}
	};

	useLayoutEffect(() => {
		focusedSwatchRef.current = 0;
		document.getElementById('ude-color-swatch-0')?.focus();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}

			if (!pickerRef.current?.contains(event.target as Node)) {
				return;
			}

			const target = event.target as HTMLElement | null;
			const tag = target?.tagName ?? '';
			const inputType = target?.getAttribute('type');
			if (
				tag === 'TEXTAREA' ||
				(tag === 'INPUT' &&
					inputType !== 'button' &&
					inputType !== 'color' &&
					inputType !== 'submit')
			) {
				return;
			}

			const n = allColors.length;
			if (n === 0) {
				return;
			}

			const cur = focusedSwatchRef.current;
			let next = cur;
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				next = Math.min(cur + 1, n - 1);
			} else if (event.key === 'ArrowLeft') {
				event.preventDefault();
				next = Math.max(cur - 1, 0);
			} else if (event.key === 'ArrowDown') {
				event.preventDefault();
				next = Math.min(cur + SWATCH_COLS, n - 1);
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				next = Math.max(cur - SWATCH_COLS, 0);
			} else if (event.key === 'Home') {
				event.preventDefault();
				next = 0;
			} else if (event.key === 'End') {
				event.preventDefault();
				next = n - 1;
			} else if (event.key === 'Enter' || event.key === ' ') {
				if (tag === 'BUTTON' && target?.dataset.swatch !== 'true') {
					return;
				}
				event.preventDefault();
				const c = allColors[cur];
				if (c) {
					handleColorSelect(c);
				}
				return;
			} else {
				return;
			}

			focusedSwatchRef.current = next;
			queueMicrotask(() => {
				document.getElementById(`ude-color-swatch-${next}`)?.focus();
			});
		};

		document.addEventListener('keydown', onKeyDown, true);
		return (): void => document.removeEventListener('keydown', onKeyDown, true);
	}, [allColors, handleColorSelect, onClose]);

	if (typeof document === 'undefined') {
		return null;
	}

	return (
		<ShellPortalMount>
			<AnimatePresence>
				<motion.div
					ref={pickerRef}
					initial={{ opacity: 0, scale: 0.95, y: -10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: -10 }}
					transition={{ duration: 0.15 }}
					className="fixed outline-none"
					style={
						resolvedPosition
							? {
									left: `${resolvedPosition.x}px`,
									top: `${resolvedPosition.y}px`,
									zIndex: toolbarPortalPopoverZ,
								}
							: { zIndex: toolbarPortalPopoverZ }
					}
					tabIndex={-1}
				>
					<DesktopAppMenuSurface className="min-w-[320px] border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-4 text-(--desktop-text-primary)">
						<div className="mb-4 flex items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white">
									{type === 'text' ? (
										<SwatchIcon width={18} height={18} />
									) : (
										<SparklesIcon width={18} height={18} />
									)}
								</div>
								<div>
									<DesktopAppSectionLabel>
										{type === 'text'
											? t('colorPicker.textTitle')
											: t('colorPicker.highlightTitle')}
									</DesktopAppSectionLabel>
									<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
										{t('colorPicker.hint')}
									</p>
								</div>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								className="h-11 w-11 min-h-11 min-w-11"
								onClick={onClose}
								aria-label={t('colorPicker.close')}
								title={t('colorPicker.close')}
							>
								<XMarkIcon width={16} height={16} />
							</DesktopAppButton>
						</div>

						<div className="mb-4">
							<div className="mb-2 flex items-center justify-between gap-3">
								<DesktopAppSectionLabel>
									{t('colorPicker.palette')}
								</DesktopAppSectionLabel>
								<DesktopAppStatusBadge>
									{allColors.length}
								</DesktopAppStatusBadge>
							</div>
							{/* biome-ignore lint/a11y/useSemanticElements: палитра кнопок, не табличная вёрстка */}
							<div
								role="grid"
								aria-label={t('colorPicker.palette')}
								className="grid grid-cols-8 gap-2"
							>
								{allColors.map((color, index) => (
									<button
										id={`ude-color-swatch-${color.replace(/^#/, '')}`}
										key={color}
										type="button"
										data-swatch="true"
										onClick={() => handleColorSelect(color)}
										onFocus={() => {
											focusedSwatchRef.current = index;
										}}
										className="flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-(--desktop-radius) border-2 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/60"
										style={{
											backgroundColor: color,
											borderColor:
												currentColor === color
													? 'rgba(255,255,255,0.95)'
													: 'rgba(255,255,255,0.18)',
										}}
										title={color}
										aria-label={t('colorPicker.ariaColor', { color })}
									>
										{currentColor === color ? (
											<CheckIcon
												width={14}
												height={14}
												className="text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
											/>
										) : null}
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<DesktopAppSectionLabel>
								{t('colorPicker.customLabel')}
							</DesktopAppSectionLabel>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={customColor}
									onChange={(e) => setCustomColor(e.target.value)}
									className="h-11 min-h-11 w-14 cursor-pointer rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
									title={t('colorPicker.pickNative')}
									aria-label={t('colorPicker.pickNative')}
								/>
								<DesktopAppInput
									type="text"
									value={customColor}
									onChange={(e) => setCustomColor(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleCustomColorSubmit();
										}
									}}
									placeholder="#000000"
									className="min-h-11 flex-1 font-mono"
									pattern="^#[0-9A-F]{6}$"
								/>
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									className="min-h-11"
									onClick={handleCustomColorSubmit}
								>
									{t('colorPicker.apply')}
								</DesktopAppButton>
							</div>
						</div>

						<DesktopAppPanel className="mt-4 flex items-center gap-3 border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-3">
							<DesktopAppSectionLabel>
								{t('colorPicker.current')}
							</DesktopAppSectionLabel>
							<div
								className="h-6 w-6 rounded border border-(--desktop-border-subtle)"
								style={{ backgroundColor: currentColor }}
							/>
							<span className="font-mono text-xs text-(--desktop-text-secondary)">
								{currentColor}
							</span>
						</DesktopAppPanel>
					</DesktopAppMenuSurface>
				</motion.div>
			</AnimatePresence>
		</ShellPortalMount>
	);
};
