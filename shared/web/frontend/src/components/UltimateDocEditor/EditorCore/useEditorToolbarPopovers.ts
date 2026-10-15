/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Popover, overflow menu, and insert-dialog state/effects/handlers for Ultimate Doc
 * Editor toolbar — all hooks run before the parent isUsableTiptapEditor guard.
 *
 * Invariants:
 * - Hook must not early-return before all useEffect/useLayoutEffect registrations.
 * - closePopover clears active popover, selection snapshot, positions, and form errors.
 *
 * Related:
 * - EditorToolbar.tsx, editorToolbarUrlSanitize.ts
 */
import type { Editor } from '@tiptap/react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
	type Dispatch,
	type FormEvent,
	type RefObject,
	type SetStateAction,
} from 'react';
import type { TFunction } from 'i18next';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	clampSize,
	sanitizeImageSrc,
	sanitizeUrl,
} from './editorToolbarUrlSanitize';
import { isUsableTiptapEditor } from '../utils/isUsableTiptapEditor';

export type EditorToolbarPopoverId =
	| 'link'
	| 'image'
	| 'table'
	| 'color'
	| 'highlight'
	| 'fontFamily';

export interface UseEditorToolbarPopoversOptions {
	editor: Editor | null;
	closeSignal?: number;
	onRequestExclusiveOpen?: () => void;
	t: TFunction;
}

export interface UseEditorToolbarPopoversResult {
	toolbarNarrow: boolean;
	overflowMenuOpen: boolean;
	setOverflowMenuOpen: Dispatch<SetStateAction<boolean>>;
	overflowButtonRef: RefObject<HTMLButtonElement | null>;
	overflowPosition: { x: number; y: number } | null;
	embeddedModalZ: ReturnType<typeof useEmbeddedPortaledModalZIndex>;
	activePopover: EditorToolbarPopoverId | null;
	colorPickerPosition: { x: number; y: number } | null;
	popoverPosition: { x: number; y: number } | null;
	linkUrl: string;
	setLinkUrl: Dispatch<SetStateAction<string>>;
	linkText: string;
	setLinkText: Dispatch<SetStateAction<string>>;
	linkError: string | null;
	setLinkError: Dispatch<SetStateAction<string | null>>;
	imageUrl: string;
	setImageUrl: Dispatch<SetStateAction<string>>;
	imageAlt: string;
	setImageAlt: Dispatch<SetStateAction<string>>;
	imageError: string | null;
	setImageError: Dispatch<SetStateAction<string | null>>;
	tableRows: string;
	setTableRows: Dispatch<SetStateAction<string>>;
	tableCols: string;
	setTableCols: Dispatch<SetStateAction<string>>;
	tableWithHeader: boolean;
	setTableWithHeader: Dispatch<SetStateAction<boolean>>;
	tableError: string | null;
	linkButtonRef: RefObject<HTMLButtonElement | null>;
	imageButtonRef: RefObject<HTMLButtonElement | null>;
	tableButtonRef: RefObject<HTMLButtonElement | null>;
	colorButtonRef: RefObject<HTMLButtonElement | null>;
	highlightButtonRef: RefObject<HTMLButtonElement | null>;
	fontFamilyButtonRef: RefObject<HTMLButtonElement | null>;
	linkPopoverRef: RefObject<HTMLDivElement | null>;
	imagePopoverRef: RefObject<HTMLDivElement | null>;
	tablePopoverRef: RefObject<HTMLDivElement | null>;
	fontFamilyPopoverRef: RefObject<HTMLDivElement | null>;
	linkUrlInputRef: RefObject<HTMLInputElement | null>;
	imageUrlInputRef: RefObject<HTMLInputElement | null>;
	tableRowsInputRef: RefObject<HTMLInputElement | null>;
	closePopover: () => void;
	togglePopover: (popoverId: EditorToolbarPopoverId) => void;
	handleInsertLink: (event?: FormEvent) => void;
	handleRemoveLink: () => void;
	handleInsertImage: (event?: FormEvent) => void;
	handleInsertTable: (event?: FormEvent) => void;
	handleFontFamilySelect: (fontFamily: string) => void;
}

export function useEditorToolbarPopovers({
	editor,
	closeSignal,
	onRequestExclusiveOpen,
	t,
}: UseEditorToolbarPopoversOptions): UseEditorToolbarPopoversResult {
	const [, bumpSelectionTick] = useReducer((x: number) => x + 1, 0);
	const [toolbarNarrow, setToolbarNarrow] = useState(false);
	const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
	const overflowButtonRef = useRef<HTMLButtonElement>(null);
	const [overflowPosition, setOverflowPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);

	const [activePopover, setActivePopover] =
		useState<EditorToolbarPopoverId | null>(null);
	const [savedSelection, setSavedSelection] = useState<{
		from: number;
		to: number;
	} | null>(null);
	const [colorPickerPosition, setColorPickerPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [popoverPosition, setPopoverPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const [linkUrl, setLinkUrl] = useState('');
	const [linkText, setLinkText] = useState('');
	const [linkError, setLinkError] = useState<string | null>(null);

	const [imageUrl, setImageUrl] = useState('');
	const [imageAlt, setImageAlt] = useState('');
	const [imageError, setImageError] = useState<string | null>(null);

	const [tableRows, setTableRows] = useState('3');
	const [tableCols, setTableCols] = useState('3');
	const [tableWithHeader, setTableWithHeader] = useState(true);
	const [tableError, setTableError] = useState<string | null>(null);

	const linkButtonRef = useRef<HTMLButtonElement>(null);
	const imageButtonRef = useRef<HTMLButtonElement>(null);
	const tableButtonRef = useRef<HTMLButtonElement>(null);
	const colorButtonRef = useRef<HTMLButtonElement>(null);
	const highlightButtonRef = useRef<HTMLButtonElement>(null);
	const fontFamilyButtonRef = useRef<HTMLButtonElement>(null);

	const linkPopoverRef = useRef<HTMLDivElement>(null);
	const imagePopoverRef = useRef<HTMLDivElement>(null);
	const tablePopoverRef = useRef<HTMLDivElement>(null);
	const fontFamilyPopoverRef = useRef<HTMLDivElement>(null);

	const linkUrlInputRef = useRef<HTMLInputElement>(null);
	const imageUrlInputRef = useRef<HTMLInputElement>(null);
	const tableRowsInputRef = useRef<HTMLInputElement>(null);

	const popoverRefs = useMemo(
		() => ({
			link: { button: linkButtonRef, popover: linkPopoverRef },
			image: { button: imageButtonRef, popover: imagePopoverRef },
			table: { button: tableButtonRef, popover: tablePopoverRef },
			fontFamily: {
				button: fontFamilyButtonRef,
				popover: fontFamilyPopoverRef,
			},
			color: { button: colorButtonRef, popover: null },
			highlight: { button: highlightButtonRef, popover: null },
		}),
		[]
	);

	const closePopover = useCallback(() => {
		setActivePopover(null);
		setSavedSelection(null);
		setColorPickerPosition(null);
		setPopoverPosition(null);
		setLinkError(null);
		setImageError(null);
		setTableError(null);
	}, []);

	useEffect(() => {
		if (!isUsableTiptapEditor(editor)) {
			return;
		}
		const onSel = (): void => {
			bumpSelectionTick();
		};
		const onDestroy = (): void => {
			bumpSelectionTick();
		};
		editor.on('selectionUpdate', onSel);
		editor.on('destroy', onDestroy);
		return () => {
			editor.off('selectionUpdate', onSel);
			editor.off('destroy', onDestroy);
		};
	}, [editor]);

	useEffect(() => {
		if (!activePopover || !editor) {
			return;
		}

		const handleClickOutside = (event: MouseEvent) => {
			const refs = popoverRefs[activePopover];
			const target = event.target as Node;

			if (refs?.button.current?.contains(target)) {
				return;
			}

			if (refs?.popover?.current?.contains(target)) {
				return;
			}

			closePopover();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closePopover();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [activePopover, popoverRefs, closePopover, editor]);

	useEffect(() => {
		if (closeSignal === undefined || !editor) {
			return;
		}
		closePopover();
	}, [closeSignal, closePopover, editor]);

	useEffect(() => {
		if (!editor) {
			return;
		}

		if (activePopover === 'link') {
			const existingLink = editor.getAttributes('link');
			const { from, to } = savedSelection ?? editor.state.selection;
			const selectedText =
				from !== to ? editor.state.doc.textBetween(from, to, '\n') : '';

			setLinkUrl(existingLink?.href ?? '');
			setLinkText(selectedText || existingLink?.href || '');
			setLinkError(null);

			const timer = window.setTimeout(() => {
				linkUrlInputRef.current?.focus();
			}, 10);

			return () => window.clearTimeout(timer);
		}

		if (activePopover === 'image') {
			setImageError(null);
			const timer = window.setTimeout(() => {
				imageUrlInputRef.current?.focus();
			}, 10);
			return () => window.clearTimeout(timer);
		}

		if (activePopover === 'table') {
			setTableError(null);
			const timer = window.setTimeout(() => {
				tableRowsInputRef.current?.focus();
			}, 10);
			return () => window.clearTimeout(timer);
		}

		return undefined;
	}, [activePopover, editor, savedSelection]);

	useLayoutEffect(() => {
		if (
			!activePopover ||
			activePopover === 'color' ||
			activePopover === 'highlight' ||
			typeof window === 'undefined'
		) {
			return;
		}

		const refs = popoverRefs[activePopover];
		const button = refs?.button.current;

		if (!button) {
			return;
		}

		const updatePosition = (): void => {
			const currentButton = refs?.button.current;
			const currentPopover = refs?.popover?.current;

			if (!currentButton) {
				return;
			}

			const buttonRect = currentButton.getBoundingClientRect();
			const panelWidth = currentPopover?.offsetWidth ?? 320;
			const panelHeight = currentPopover?.offsetHeight ?? 280;
			const margin = 12;
			const gap = 12;

			let nextX = buttonRect.left + buttonRect.width / 2 - panelWidth / 2;
			let nextY = buttonRect.bottom + gap;

			if (nextY + panelHeight > window.innerHeight - margin) {
				const flippedY = buttonRect.top - panelHeight - gap;
				nextY =
					flippedY >= margin
						? flippedY
						: window.innerHeight - panelHeight - margin;
			}

			nextX = Math.min(
				Math.max(nextX, margin),
				Math.max(margin, window.innerWidth - panelWidth - margin)
			);
			nextY = Math.min(
				Math.max(nextY, margin),
				Math.max(margin, window.innerHeight - panelHeight - margin)
			);

			setPopoverPosition((previous) =>
				previous?.x === nextX && previous?.y === nextY
					? previous
					: { x: nextX, y: nextY }
			);
		};

		const frame = window.requestAnimationFrame(updatePosition);
		window.addEventListener('resize', updatePosition);

		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener('resize', updatePosition);
		};
	}, [activePopover, popoverRefs]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const mq = window.matchMedia('(max-width: 900px)');
		const apply = (): void => {
			setToolbarNarrow(mq.matches);
		};
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	}, []);

	useEffect(() => {
		if (!overflowMenuOpen) {
			setOverflowPosition(null);
			return;
		}
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setOverflowMenuOpen(false);
			}
		};
		const onClick = (event: MouseEvent): void => {
			const target = event.target as Node;
			if (overflowButtonRef.current?.contains(target)) {
				return;
			}
			const panel = document.getElementById('editor-toolbar-overflow-panel');
			if (panel?.contains(target)) {
				return;
			}
			setOverflowMenuOpen(false);
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onClick);
		return (): void => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onClick);
		};
	}, [overflowMenuOpen]);

	useLayoutEffect(() => {
		if (!overflowMenuOpen || typeof window === 'undefined') {
			return;
		}
		const btn = overflowButtonRef.current;
		if (!btn) {
			return;
		}
		const update = (): void => {
			const r = overflowButtonRef.current?.getBoundingClientRect();
			if (!r) {
				return;
			}
			const panelW = 420;
			const panelH = Math.min(window.innerHeight - 24, 560);
			let x = r.right - panelW;
			let y = r.bottom + 8;
			x = Math.max(8, Math.min(x, window.innerWidth - panelW - 8));
			if (y + panelH > window.innerHeight - 8) {
				y = Math.max(8, r.top - panelH - 8);
			}
			setOverflowPosition({ x, y });
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, [overflowMenuOpen]);

	const togglePopover = useCallback(
		(popoverId: EditorToolbarPopoverId) => {
			if (activePopover === popoverId) {
				closePopover();
				setColorPickerPosition(null);
				return;
			}

			onRequestExclusiveOpen?.();

			if (popoverId === 'color' || popoverId === 'highlight') {
				const buttonRef =
					popoverId === 'color' ? colorButtonRef : highlightButtonRef;
				if (buttonRef.current) {
					const rect = buttonRef.current.getBoundingClientRect();
					setColorPickerPosition({ x: rect.left, y: rect.bottom + 8 });
				}
			} else if (editor) {
				const { from, to } = editor.state.selection;
				setSavedSelection({ from, to });
			}

			setActivePopover(popoverId);
		},
		[activePopover, closePopover, editor, onRequestExclusiveOpen]
	);

	const handleInsertLink = useCallback(
		(event?: FormEvent) => {
			event?.preventDefault();
			if (!editor) {
				return;
			}

			const href = sanitizeUrl(linkUrl);
			if (!href) {
				setLinkError(t('toolbar.errors.invalidLinkUrl'));
				return;
			}

			const displayText = (linkText || href).trim();

			let chain = editor.chain().focus();
			if (savedSelection) {
				chain = chain.setTextSelection(savedSelection);
			}

			const { from, to } = savedSelection ?? editor.state.selection;
			if (from !== to) {
				chain = chain.deleteRange({ from, to });
			}

			chain
				.insertContent({
					type: 'text',
					text: displayText || href,
					marks: [
						{
							type: 'link',
							attrs: { href },
						},
					],
				})
				.run();

			closePopover();
		},
		[closePopover, editor, linkText, linkUrl, savedSelection, t]
	);

	const handleRemoveLink = useCallback(() => {
		if (!editor) {
			return;
		}

		let chain = editor.chain().focus();
		if (savedSelection) {
			chain = chain.setTextSelection(savedSelection);
		}

		chain.unsetLink().run();
		closePopover();
	}, [closePopover, editor, savedSelection]);

	const handleInsertImage = useCallback(
		(event?: FormEvent) => {
			event?.preventDefault();
			if (!editor) {
				return;
			}

			const src = sanitizeImageSrc(imageUrl);
			if (!src) {
				setImageError(t('toolbar.errors.invalidImageUrl'));
				return;
			}

			let chain = editor.chain().focus();
			if (savedSelection) {
				chain = chain.setTextSelection(savedSelection);
			}

			chain
				.setImage({
					src,
					alt: imageAlt.trim() || undefined,
				})
				.run();

			closePopover();
			setImageUrl('');
			setImageAlt('');
		},
		[closePopover, editor, imageAlt, imageUrl, savedSelection, t]
	);

	const handleInsertTable = useCallback(
		(event?: FormEvent) => {
			event?.preventDefault();
			if (!editor) {
				return;
			}

			const rows = clampSize(Number.parseInt(tableRows, 10));
			const cols = clampSize(Number.parseInt(tableCols, 10));
			const opts = { rows, cols, withHeaderRow: tableWithHeader };

			const runInsert = (): boolean => {
				let chain = editor.chain().focus();
				if (savedSelection) {
					chain = chain.setTextSelection(savedSelection);
				}
				return chain.insertTable(opts).run();
			};

			if (runInsert()) {
				closePopover();
				setTableError(null);
				return;
			}

			let chain2 = editor.chain().focus();
			if (savedSelection) {
				chain2 = chain2.setTextSelection(savedSelection);
			}
			if (chain2.insertContent('<p></p>').insertTable(opts).run()) {
				closePopover();
				setTableError(null);
				return;
			}

			setTableError(t('toolbar.errors.tableInsertFailed'));
		},
		[
			closePopover,
			editor,
			savedSelection,
			t,
			tableCols,
			tableRows,
			tableWithHeader,
		]
	);

	const handleFontFamilySelect = useCallback(
		(fontFamily: string) => {
			if (!editor) {
				return;
			}
			if (fontFamily === '') {
				editor.chain().focus().unsetFontFamily().run();
			} else {
				editor.chain().focus().setFontFamily(fontFamily).run();
			}
			closePopover();
		},
		[closePopover, editor]
	);

	return {
		toolbarNarrow,
		overflowMenuOpen,
		setOverflowMenuOpen,
		overflowButtonRef,
		overflowPosition,
		embeddedModalZ,
		activePopover,
		colorPickerPosition,
		popoverPosition,
		linkUrl,
		setLinkUrl,
		linkText,
		setLinkText,
		linkError,
		setLinkError,
		imageUrl,
		setImageUrl,
		imageAlt,
		setImageAlt,
		imageError,
		setImageError,
		tableRows,
		setTableRows,
		tableCols,
		setTableCols,
		tableWithHeader,
		setTableWithHeader,
		tableError,
		linkButtonRef,
		imageButtonRef,
		tableButtonRef,
		colorButtonRef,
		highlightButtonRef,
		fontFamilyButtonRef,
		linkPopoverRef,
		imagePopoverRef,
		tablePopoverRef,
		fontFamilyPopoverRef,
		linkUrlInputRef,
		imageUrlInputRef,
		tableRowsInputRef,
		closePopover,
		togglePopover,
		handleInsertLink,
		handleRemoveLink,
		handleInsertImage,
		handleInsertTable,
		handleFontFamilySelect,
	};
}
