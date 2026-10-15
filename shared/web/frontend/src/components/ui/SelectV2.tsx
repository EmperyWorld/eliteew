/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared custom select/listbox component for legacy glass UI surfaces that cannot
 * use native select styling.
 *
 * Invariants:
 * - Trigger exposes combobox state and the popup exposes listbox/option roles.
 * - Generic labels come from `commonUi`; product copy stays in product namespaces.
 *
 * Related:
 * - src/i18n/locales/ru/commonUi.json
 */

import * as React from 'react';
import {
	useState,
	useRef,
	useEffect,
	useId,
	forwardRef,
	useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { COMMON_UI_NS } from '@/i18n/namespaces';
import { cn } from '../../utils/cn';
import {
	CheckIcon,
	ChevronDownIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
	icon?: React.ReactNode;
}

export interface SelectV2Props {
	/** Опции */
	options: SelectOption[];
	/** Выбранное значение (single select) */
	value?: string;
	/** Выбранные значения (multi select) */
	values?: string[];
	/** Callback при изменении */
	onChange: (value: string | string[]) => void;
	/** Label */
	label?: string;
	/** Placeholder */
	placeholder?: string;
	/** Multi-select режим */
	multiple?: boolean;
	/** Searchable (фильтрация) */
	searchable?: boolean;
	/** Disabled */
	disabled?: boolean;
	/** Error state */
	error?: string;
	/** Helper text */
	helperText?: string;
	/** Custom className */
	className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SelectV2 = forwardRef<HTMLDivElement, SelectV2Props>(
	(
		{
			options,
			value,
			values = [],
			onChange,
			label,
			placeholder,
			multiple = false,
			searchable = false,
			disabled = false,
			error,
			helperText,
			className,
		},
		ref
	) => {
		const { t } = useTranslation(COMMON_UI_NS);
		const id = useId();
		const listboxId = `${id}-listbox`;
		const labelId = label ? `${id}-label` : undefined;
		const [isOpen, setIsOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState('');
		const [highlightedIndex, setHighlightedIndex] = useState(0);
		const containerRef = useRef<HTMLDivElement>(null);
		const searchInputRef = useRef<HTMLInputElement>(null);

		// Selected values для multi-select или single select
		const selectedValues = multiple ? values : value ? [value] : [];

		// Filtered options на основе поиска
		const filteredOptions = searchable
			? options.filter((opt) =>
					opt.label.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: options;

		// ========================================
		// HANDLERS
		// ========================================

		const handleToggle = (): void => {
			if (disabled) {
				return;
			}
			setIsOpen(!isOpen);
		};

		const handleSelect = useCallback(
			(optionValue: string): void => {
				if (multiple) {
					// Multi-select: toggle selection
					const newValues = selectedValues.includes(optionValue)
						? selectedValues.filter((v) => v !== optionValue)
						: [...selectedValues, optionValue];
					onChange(newValues);
				} else {
					// Single select: select and close
					onChange(optionValue);
					setIsOpen(false);
					setSearchQuery('');
				}
			},
			[multiple, onChange, selectedValues]
		);

		const handleRemove = (optionValue: string, e: React.MouseEvent): void => {
			e.stopPropagation();
			if (multiple) {
				onChange(selectedValues.filter((v) => v !== optionValue));
			}
		};

		const handleClearAll = (e: React.MouseEvent): void => {
			e.stopPropagation();
			onChange(multiple ? [] : '');
		};

		// ========================================
		// KEYBOARD NAVIGATION
		// ========================================

		useEffect(() => {
			if (!isOpen) {
				return;
			}

			const handleKeyDown = (e: KeyboardEvent): void => {
				switch (e.key) {
					case 'ArrowDown':
						e.preventDefault();
						setHighlightedIndex((prev) =>
							prev < filteredOptions.length - 1 ? prev + 1 : prev
						);
						break;
					case 'ArrowUp':
						e.preventDefault();
						setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
						break;
					case 'Enter':
						e.preventDefault();
						if (filteredOptions[highlightedIndex]) {
							handleSelect(filteredOptions[highlightedIndex].value);
						}
						break;
					case 'Escape':
						setIsOpen(false);
						setSearchQuery('');
						break;
				}
			};

			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}, [isOpen, highlightedIndex, filteredOptions, handleSelect]);

		// ========================================
		// CLICK OUTSIDE
		// ========================================

		useEffect(() => {
			const handleClickOutside = (e: MouseEvent) => {
				if (
					containerRef.current &&
					!containerRef.current.contains(e.target as Node)
				) {
					setIsOpen(false);
					setSearchQuery('');
				}
			};

			document.addEventListener('mousedown', handleClickOutside);
			return () =>
				document.removeEventListener('mousedown', handleClickOutside);
		}, []);

		// ========================================
		// AUTO FOCUS SEARCH
		// ========================================

		useEffect(() => {
			if (isOpen && searchable && searchInputRef.current) {
				searchInputRef.current.focus();
			}
		}, [isOpen, searchable]);

		// ========================================
		// RENDER
		// ========================================

		// Get selected labels
		const selectedOptions = options.filter((opt) =>
			selectedValues.includes(opt.value)
		);
		const highlightedOption = filteredOptions[highlightedIndex];
		const resolvedPlaceholder = placeholder ?? t('states.chooseOption');

		return (
			<div ref={ref} className={cn('relative w-full', className)}>
				{/* Label */}
				{label && (
					<label
						id={labelId}
						htmlFor={id}
						className="block text-sm font-medium text-white/80 mb-2"
					>
						{label}
					</label>
				)}

				{/* Select Container */}
				<div ref={containerRef} className="relative">
					{/* Trigger */}
					<button
						type="button"
						id={id}
						role="combobox"
						aria-expanded={isOpen}
						aria-haspopup="listbox"
						aria-controls={isOpen ? listboxId : undefined}
						aria-labelledby={labelId}
						aria-activedescendant={
							isOpen && highlightedOption
								? `${listboxId}-option-${highlightedIndex}`
								: undefined
						}
						onClick={handleToggle}
						disabled={disabled}
						className={cn(
							'w-full px-4 py-3 rounded-xl text-left',
							'bg-white/5 backdrop-blur-xl',
							'border-2 transition-all duration-200',
							'text-white flex items-center justify-between gap-2',
							'focus:outline-hidden focus:ring-2',
							error
								? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
								: 'border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20',
							disabled && 'opacity-50 cursor-not-allowed',
							!disabled && 'hover:bg-white/10 cursor-pointer'
						)}
					>
						<div className="flex-1 flex items-center gap-2 flex-wrap">
							{selectedOptions.length > 0 ? (
								multiple ? (
									// Multi-select: показываем badges
									selectedOptions.map((opt) => (
										<span
											key={opt.value}
											className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-lg border border-blue-500/30"
										>
											{opt.icon && <span className="w-4 h-4">{opt.icon}</span>}
											{opt.label}
											<button
												type="button"
												onClick={(e) => handleRemove(opt.value, e)}
												className="hover:text-blue-100"
												aria-label={`Удалить ${opt.label}`}
												title={`Удалить ${opt.label}`}
											>
												<XMarkIcon className="w-3 h-3" />
											</button>
										</span>
									))
								) : // Single select: показываем один
								selectedOptions[0] ? (
									<span className="flex items-center gap-2">
										{selectedOptions[0].icon && (
											<span className="w-4 h-4">{selectedOptions[0].icon}</span>
										)}
										{selectedOptions[0].label}
									</span>
								) : null
							) : (
								<span className="text-white/40">{resolvedPlaceholder}</span>
							)}
						</div>

						{/* Icons */}
						<div className="flex items-center gap-2">
							{selectedValues.length > 0 && !disabled && (
								<button
									type="button"
									onClick={handleClearAll}
									className="text-white/60 hover:text-white transition-colors"
									aria-label={t('actions.clear')}
									title={t('actions.clear')}
								>
									<XMarkIcon className="w-4 h-4" />
								</button>
							)}
							<ChevronDownIcon
								className={cn(
									'w-5 h-5 text-white/60 transition-transform duration-200',
									isOpen && 'rotate-180'
								)}
							/>
						</div>
					</button>

					{/* Dropdown */}
					<AnimatePresence>
						{isOpen && (
							<motion.div
								id={listboxId}
								role="listbox"
								aria-labelledby={labelId}
								aria-multiselectable={multiple || undefined}
								className="absolute z-50 w-full mt-2 py-2 bg-slate-900/95 backdrop-blur-2xl border-2 border-white/20 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.15 }}
							>
								{/* MagnifyingGlassIcon Input */}
								{searchable && (
									<div className="px-3 pb-2 border-b border-white/10">
										<div className="relative">
											<MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
											<input
												ref={searchInputRef}
												type="text"
												placeholder={t('actions.search')}
												aria-label={t('actions.search')}
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-hidden focus:border-blue-500/50"
											/>
										</div>
									</div>
								)}

								{/* Options */}
								{filteredOptions.length > 0 ? (
									filteredOptions.map((option, index) => {
										const isSelected = selectedValues.includes(option.value);
										const isHighlighted = index === highlightedIndex;

										return (
											<button
												id={`${listboxId}-option-${index}`}
												key={option.value}
												type="button"
												role="option"
												aria-selected={isSelected}
												onClick={() => handleSelect(option.value)}
												disabled={option.disabled}
												className={cn(
													'w-full px-4 py-2.5 text-left flex items-center justify-between gap-2',
													'transition-colors duration-150',
													isSelected && 'bg-blue-500/20 text-blue-300',
													!isSelected &&
														'text-white/80 hover:bg-white/10 hover:text-white',
													isHighlighted && !isSelected && 'bg-white/5',
													option.disabled && 'opacity-50 cursor-not-allowed'
												)}
											>
												<span className="flex items-center gap-2">
													{option.icon && (
														<span className="w-4 h-4">{option.icon}</span>
													)}
													{option.label}
												</span>
												{isSelected && <CheckIcon className="w-4 h-4" />}
											</button>
										);
									})
								) : (
									<div className="px-4 py-3 text-center text-white/40 text-sm">
										{t('states.noResults')}
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* Helper/Error Text */}
				{(error || helperText) && (
					<p
						className={cn(
							'mt-1.5 text-sm',
							error ? 'text-red-400' : 'text-white/60'
						)}
					>
						{error || helperText}
					</p>
				)}
			</div>
		);
	}
);

SelectV2.displayName = 'SelectV2';
