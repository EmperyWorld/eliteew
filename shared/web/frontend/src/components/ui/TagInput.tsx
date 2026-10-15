/**
 * ============================================
 * FILE: web/frontend/src/components/ui/TagInput.tsx
 * ============================================
 *
 * CRITICAL INFO:
 * - Purpose: Tag input component with autocomplete
 * - Dependencies: React, framer-motion, axios, @heroicons/react
 * - Used by: UnifiedContentManager
 * - Features: Tag chips, autocomplete, keyboard navigation
 *
 * CHANGE LOG:
 * - 2025-10-24: Initial creation - Tag input with autocomplete
 */

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { PlusIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { log } from '../../utils/logger';
import { contentApi } from '../../services/contentApi';
import {
	type TagSuggestion,
	validateTag,
	normalizeTag,
	fuzzyMatchTag,
	getTagColor,
	TAG_VALIDATION_RULES,
} from '../../types/contentTags';

interface TagInputProps {
	value: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
	maxTags?: number;
	disabled?: boolean;
	showSuggestions?: boolean;
	className?: string;
}

const TagInput: React.FC<TagInputProps> = ({
	value = [],
	onChange,
	placeholder = 'Add tags...',
	maxTags = TAG_VALIDATION_RULES.MAX_TAGS_PER_CONTENT,
	disabled = false,
	showSuggestions = true,
	className = '',
}) => {
	const [inputValue, setInputValue] = useState('');
	const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [validationError, setValidationError] = useState<string | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Fetch suggestions from API
	const fetchSuggestions = useCallback(async (search: string) => {
		if (!search || search.length < 2) {
			setSuggestions([]);
			return;
		}

		try {
			const tags = await contentApi.getPopularTags(10, search);

			// Calculate fuzzy match scores
			const scored = tags
				.map((tag) => ({
					...tag,
					matchScore: fuzzyMatchTag(search, tag.tag),
				}))
				.filter((tag) => tag.matchScore > 30); // Only show relevant matches

			// Sort by match score
			scored.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

			setSuggestions(scored);
		} catch (error) {
			log.error(
				'[TagInput] Failed to fetch suggestions:',
				error as unknown as string
			);
			setSuggestions([]);
		}
	}, []);

	// Handle input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const newValue = e.target.value;
		setInputValue(newValue);
		setValidationError(null);
		setSelectedIndex(-1);

		if (showSuggestions && newValue.length >= 2) {
			fetchSuggestions(newValue);
			setShowDropdown(true);
		} else {
			setShowDropdown(false);
		}
	};

	// Add tag
	const addTag = (tag: string): void => {
		const normalized = normalizeTag(tag);

		if (!normalized) {
			return;
		}

		// Validate tag
		const validation = validateTag(normalized);
		if (!validation.isValid) {
			setValidationError(validation.errors[0] ?? 'Invalid tag');
			return;
		}

		// Check max tags
		if (value.length >= maxTags) {
			setValidationError(`Maximum ${maxTags} tags allowed`);
			return;
		}

		// Check duplicates
		if (value.includes(normalized)) {
			setValidationError('Tag already added');
			return;
		}

		// Add tag
		onChange([...value, normalized]);
		setInputValue('');
		setSuggestions([]);
		setShowDropdown(false);
		setValidationError(null);
		inputRef.current?.focus();
	};

	// Remove tag
	const removeTag = (index: number): void => {
		const newTags = [...value];
		newTags.splice(index, 1);
		onChange(newTags);
	};

	// Handle key down
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		// Enter or comma: add tag
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();

			if (selectedIndex >= 0 && suggestions[selectedIndex]) {
				addTag(suggestions[selectedIndex].tag);
			} else if (inputValue.trim()) {
				addTag(inputValue.trim());
			}
		}

		// Backspace: remove last tag if input empty
		else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
			removeTag(value.length - 1);
		}

		// Arrow down: navigate suggestions
		else if (e.key === 'ArrowDown') {
			e.preventDefault();
			setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
		}

		// Arrow up: navigate suggestions
		else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setSelectedIndex((prev) => Math.max(prev - 1, -1));
		}

		// Escape: close dropdown
		else if (e.key === 'Escape') {
			setShowDropdown(false);
			setSelectedIndex(-1);
		}
	};

	// Click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div className={`relative ${className}`}>
			{/* Tag chips + input */}
			<div className="flex flex-wrap gap-2 p-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg min-h-[42px]">
				{/* Existing tags */}
				<AnimatePresence>
					{value.map((tag, index) => {
						const color = getTagColor(tag);
						return (
							<motion.div
								key={tag}
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								transition={{ duration: 0.2 }}
								className={`px-3 py-1 bg-linear-to-r from-${color}-500/20 to-${color}-600/20 border border-${color}-500/30 rounded-full text-${color}-400 text-sm flex items-center gap-1`}
							>
								<TagIcon className="w-3 h-3" />
								<span>{tag}</span>
								{!disabled && (
									<button
										type="button"
										onClick={() => removeTag(index)}
										className={`ml-1 hover:bg-${color}-500/30 rounded-full p-0.5 transition-colors`}
										aria-label={`Remove ${tag}`}
									>
										<XMarkIcon className="w-3 h-3" />
									</button>
								)}
							</motion.div>
						);
					})}
				</AnimatePresence>

				{/* Input */}
				{value.length < maxTags && (
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onKeyDown={handleKeyDown}
						onFocus={() => {
							if (showSuggestions && inputValue.length >= 2) {
								setShowDropdown(true);
							}
						}}
						placeholder={value.length === 0 ? placeholder : ''}
						disabled={disabled}
						className="flex-1 min-w-[120px] bg-transparent text-white placeholder-gray-400 outline-hidden disabled:opacity-50"
						aria-label="Tag input"
					/>
				)}
			</div>

			{/* Validation error */}
			{validationError && (
				<motion.div
					initial={{ opacity: 0, y: -5 }}
					animate={{ opacity: 1, y: 0 }}
					className="mt-1 text-sm text-red-400"
				>
					{validationError}
				</motion.div>
			)}

			{/* Autocomplete dropdown */}
			<AnimatePresence>
				{showDropdown && suggestions.length > 0 && (
					<motion.div
						ref={dropdownRef}
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
						className="absolute z-50 mt-2 w-full bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl max-h-60 overflow-y-auto"
					>
						{suggestions.map((suggestion, index) => (
							<motion.div
								key={suggestion.tag}
								onClick={() => addTag(suggestion.tag)}
								className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
									index === selectedIndex
										? 'bg-purple-500/20 text-purple-400'
										: 'hover:bg-white/5 text-white'
								}`}
								whileHover={{ x: 4 }}
								transition={{ duration: 0.1 }}
							>
								<div className="flex items-center gap-2">
									<PlusIcon className="w-4 h-4" />
									<span>{suggestion.tag}</span>
								</div>
								<span className="text-xs text-gray-400">
									{suggestion.count} files
								</span>
							</motion.div>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Helper text */}
			<div className="mt-1 text-xs text-gray-400">
				{value.length}/{maxTags} tags • Press Enter or comma to add
			</div>
		</div>
	);
};

export default TagInput;
