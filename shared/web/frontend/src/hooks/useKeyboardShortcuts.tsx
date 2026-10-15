import { useEffect, useCallback, useRef } from 'react';

// ============= TYPE DEFINITIONS =============

type KeyboardHandler = () => void;

interface KeyboardShortcut {
	key: string;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	handler: KeyboardHandler;
	description?: string;
}

// ============= KEYBOARD SHORTCUTS HOOK =============

/**
 * Hook for managing keyboard shortcuts
 * Supports Ctrl, Alt, and Shift modifiers
 *
 * @example
 * ```tsx
 * const shortcuts = {
 *   'Ctrl+k': () => openSearch(),
 *   'Ctrl+/': () => toggleSidebar(),
 *   'Escape': () => closeModals()
 * };
 *
 * useKeyboardShortcuts(shortcuts);
 * ```
 */
export function useKeyboardShortcuts(
	shortcuts: Record<string, KeyboardHandler>
) {
	const shortcutsRef = useRef(shortcuts);

	// Update ref when shortcuts change
	useEffect(() => {
		shortcutsRef.current = shortcuts;
	}, [shortcuts]);

	const handleKeyPress = useCallback((e: KeyboardEvent) => {
		// Build key combination string
		let combination = '';

		if (e.ctrlKey || e.metaKey) {
			combination += 'Ctrl+';
		}
		if (e.altKey) {
			combination += 'Alt+';
		}
		if (e.shiftKey) {
			combination += 'Shift+';
		}
		combination += e.key;

		// Check if this combination has a handler
		const handler = shortcutsRef.current[combination];

		if (handler) {
			e.preventDefault();
			handler();
		}
	}, []);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyPress);

		return () => {
			document.removeEventListener('keydown', handleKeyPress);
		};
	}, [handleKeyPress]);
}

/**
 * Hook for advanced keyboard shortcuts with custom configuration
 */
export function useAdvancedKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
	const shortcutsRef = useRef(shortcuts);

	useEffect(() => {
		shortcutsRef.current = shortcuts;
	}, [shortcuts]);

	const handleKeyPress = useCallback((e: KeyboardEvent) => {
		for (const shortcut of shortcutsRef.current) {
			const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
			const matchesCtrl = shortcut.ctrl
				? e.ctrlKey || e.metaKey
				: !e.ctrlKey && !e.metaKey;
			const matchesAlt = shortcut.alt ? e.altKey : !e.altKey;
			const matchesShift = shortcut.shift ? e.shiftKey : !e.shiftKey;

			if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
				e.preventDefault();
				shortcut.handler();
				break;
			}
		}
	}, []);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyPress);

		return () => {
			document.removeEventListener('keydown', handleKeyPress);
		};
	}, [handleKeyPress]);
}

/**
 * Hook to disable/enable keyboard shortcuts based on input focus
 */
export function useConditionalKeyboardShortcuts(
	shortcuts: Record<string, KeyboardHandler>,
	enabled = true
) {
	const handleKeyPress = useCallback(
		(e: KeyboardEvent) => {
			// Don't trigger shortcuts when typing in input fields
			const target = e.target as HTMLElement;
			const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
			const isContentEditable = target.isContentEditable;

			if (isInput || isContentEditable) {
				return;
			}

			if (!enabled) {
				return;
			}

			// Build key combination
			let combination = '';
			if (e.ctrlKey || e.metaKey) {
				combination += 'Ctrl+';
			}
			if (e.altKey) {
				combination += 'Alt+';
			}
			if (e.shiftKey) {
				combination += 'Shift+';
			}
			combination += e.key;

			const handler = shortcuts[combination];
			if (handler) {
				e.preventDefault();
				handler();
			}
		},
		[shortcuts, enabled]
	);

	useEffect(() => {
		document.addEventListener('keydown', handleKeyPress);

		return () => {
			document.removeEventListener('keydown', handleKeyPress);
		};
	}, [handleKeyPress]);
}

export type { KeyboardShortcut, KeyboardHandler };
