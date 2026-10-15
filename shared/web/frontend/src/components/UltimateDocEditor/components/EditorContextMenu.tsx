/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Provides the custom TipTap document-editor context menu for clipboard,
 * formatting, table, link, image, and insertion actions.
 *
 * Invariants:
 * - Plain-text clipboard fallback must preserve newlines without interpreting
 *   clipboard text as trusted HTML.
 * - Menu actions must keep editor focus/selection before mutating content.
 *
 * Related:
 * - src/components/UltimateDocEditor/EditorCore/TiptapEditor.tsx
 */

import type { Editor } from '@tiptap/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import { notify } from '@/notifications';
import { safeCopyToClipboard } from '@/utils/clipboard';
import { clampDesktopUiScale } from '../../../pages/Desktop/utils/desktopUiScale';
import {
	DesktopAppMenuDivider,
	DesktopAppMenuHeader,
	DesktopAppMenuItem,
	DesktopAppMenuSurface,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { useDismissibleFloatingMenu } from '../../../pages/Desktop/hooks/useDismissibleFloatingMenu';
import { ShellPortalMount } from '../../../pages/Desktop/shell/shellPortal';
import {
	getContextMenuPositionFromCursor,
	getDesktopPortalShellProps,
} from '../../../pages/Desktop/utils/desktopUi';
import type { DesktopWindowStyle } from '../../../types/profile';
import {
	isUsableTiptapEditor,
	safeEditorCan,
	safeEditorCanRedo,
	safeEditorCanUndo,
} from '../utils/isUsableTiptapEditor';
import { useDocEditorContextMenuZIndex } from '../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '../../../lib/utils';
import { dispatchDocEditorRuntimeDialogRequest } from '../utils/runtimeDialogEvents';
import { EDITOR_FONT_PRESETS } from '../utils/editorFontPresets';
import { convertPlainTextToHtml } from '../utils/htmlComparableText';
import {
	ArrowTopRightOnSquareIcon,
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	ArrowsPointingOutIcon,
	Bars3BottomLeftIcon,
	Bars3Icon,
	BoldIcon,
	ChatBubbleBottomCenterTextIcon,
	ClipboardDocumentCheckIcon,
	ClipboardIcon,
	CodeBracketSquareIcon,
	DocumentDuplicateIcon,
	ItalicIcon,
	LanguageIcon,
	LinkIcon,
	LinkSlashIcon,
	ListBulletIcon,
	MinusIcon,
	NumberedListIcon,
	PencilIcon,
	PhotoIcon,
	RectangleStackIcon,
	ScissorsIcon,
	SparklesIcon,
	Square2StackIcon,
	StrikethroughIcon,
	SwatchIcon,
	TableCellsIcon,
	TrashIcon,
	UnderlineIcon,
} from '@heroicons/react/24/outline';

const MENU_ICON = 16;

function primaryShortcut(letter: string): string {
	if (typeof navigator === 'undefined') {
		return `Ctrl+${letter}`;
	}
	return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)
		? `⌘${letter}`
		: `Ctrl+${letter}`;
}

function redoShortcutLabel(): string {
	if (typeof navigator === 'undefined') {
		return 'Ctrl+Y';
	}
	return /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent) ? '⌘⇧Z' : 'Ctrl+Y';
}

function selectAllShortcut(): string {
	return primaryShortcut('A');
}

interface EditorContextMenuProps {
	editor: Editor | null;
	isOpen: boolean;
	position: { x: number; y: number };
	onClose: () => void;
	shellWindowStyle?: DesktopWindowStyle;
	/** Масштаб UI рабочего стола — портал в `document.body` визуально совпадает с окном. */
	desktopUiScale?: number;
}

type MenuRow =
	| { kind: 'section'; key: string; title: string }
	| { kind: 'divider'; key: string }
	| {
			kind: 'item';
			key: string;
			label: string;
			icon: React.ReactNode;
			shortcut?: React.ReactNode;
			action: () => void;
			disabled?: boolean;
			tone?: 'default' | 'danger';
	  };

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
	editor,
	isOpen,
	position,
	onClose,
	shellWindowStyle,
	desktopUiScale,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const contextMenuZ = useDocEditorContextMenuZIndex();
	const menuRef = useRef<HTMLDivElement>(null);
	const uiScale = useMemo(
		() => clampDesktopUiScale(desktopUiScale ?? 1),
		[desktopUiScale]
	);
	const [resolvedPosition, setResolvedPosition] = useState({
		x: position.x + 4,
		y: position.y + 4,
	});

	useDismissibleFloatingMenu({
		isOpen,
		menuRef,
		onClose,
	});

	useLayoutEffect(() => {
		if (!isOpen || typeof window === 'undefined') {
			return;
		}

		const updatePosition = (): void => {
			const menu = menuRef.current;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const menuWidth = (menu?.offsetWidth ?? 284) * uiScale;
			const menuHeight = (menu?.offsetHeight ?? 420) * uiScale;

			const next = getContextMenuPositionFromCursor({
				clientX: position.x,
				clientY: position.y,
				menuWidth,
				menuHeight,
				viewportWidth,
				viewportHeight,
				padding: 12,
				cursorGap: 4,
				flipGap: 8,
			});

			setResolvedPosition((previous) =>
				previous.x === next.x && previous.y === next.y ? previous : next
			);
		};

		let ro: ResizeObserver | null = null;
		updatePosition();

		const raf = requestAnimationFrame(() => {
			updatePosition();
			const menuEl = menuRef.current;
			if (typeof ResizeObserver !== 'undefined' && menuEl) {
				ro = new ResizeObserver(() => updatePosition());
				ro.observe(menuEl);
			}
		});

		window.addEventListener('resize', updatePosition);

		return (): void => {
			cancelAnimationFrame(raf);
			ro?.disconnect();
			window.removeEventListener('resize', updatePosition);
		};
	}, [isOpen, position.x, position.y, uiScale]);

	useLayoutEffect(() => {
		if (!isOpen) {
			return;
		}
		const id = requestAnimationFrame(() => {
			const root = menuRef.current;
			if (!root) {
				return;
			}
			const items = [
				...root.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
			].filter((b) => !b.disabled);
			items[0]?.focus();
		});
		return (): void => cancelAnimationFrame(id);
	}, [isOpen]);

	const selFrom = editor?.state?.selection.from ?? 0;
	const selTo = editor?.state?.selection.to ?? 0;
	const selEmpty = editor?.state?.selection.empty ?? true;
	const hasSelection = editor ? !selEmpty : false;
	const selectedText =
		editor && hasSelection ? editor.state.doc.textBetween(selFrom, selTo) : '';
	const selectionRange = hasSelection
		? { from: selFrom, to: selTo }
		: undefined;

	const px = position.x;
	const py = position.y;

	const menuRows: MenuRow[] = useMemo(() => {
		if (!isOpen || !isUsableTiptapEditor(editor)) {
			return [];
		}

		const toastTitle = t('editorContextMenu.clipboardTitle');

		const inTable = editor.isActive('table');
		const inLink = editor.isActive('link');
		const inImage = editor.isActive('image');
		const linkHref =
			(editor.getAttributes('link')?.href as string | undefined) ?? '';
		const imageAttrs = editor.getAttributes('image') as {
			src?: string;
			alt?: string;
		};
		const imageSrc = imageAttrs.src ?? '';
		const imageAlt = imageAttrs.alt ?? '';

		const canUndo = safeEditorCanUndo(editor);
		const canRedo = safeEditorCanRedo(editor);

		const rows: MenuRow[] = [];

		const pushDivider = (): void => {
			if (rows.length === 0) return;
			const last = rows[rows.length - 1];
			if (last?.kind === 'divider') return;
			rows.push({ kind: 'divider', key: `d-${rows.length}` });
		};

		if (inTable) {
			rows.push({
				kind: 'section',
				key: 'sec-table',
				title: t('editorContextMenu.sectionTable'),
			});
			rows.push({
				kind: 'item',
				key: 't-rb',
				label: t('editorContextMenu.tableAddRowBefore'),
				icon: <Bars3Icon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.addRowBefore()),
				action: (): void => {
					editor.chain().focus().addRowBefore().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-ra',
				label: t('editorContextMenu.tableAddRowAfter'),
				icon: <Bars3Icon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.addRowAfter()),
				action: (): void => {
					editor.chain().focus().addRowAfter().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-dr',
				label: t('editorContextMenu.tableDeleteRow'),
				icon: <TrashIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.deleteRow()),
				action: (): void => {
					editor.chain().focus().deleteRow().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-cb',
				label: t('editorContextMenu.tableAddColumnBefore'),
				icon: <RectangleStackIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.addColumnBefore()),
				action: (): void => {
					editor.chain().focus().addColumnBefore().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-ca',
				label: t('editorContextMenu.tableAddColumnAfter'),
				icon: <RectangleStackIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.addColumnAfter()),
				action: (): void => {
					editor.chain().focus().addColumnAfter().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-dc',
				label: t('editorContextMenu.tableDeleteColumn'),
				icon: <TrashIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.deleteColumn()),
				action: (): void => {
					editor.chain().focus().deleteColumn().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-merge',
				label: t('editorContextMenu.tableMergeCells'),
				icon: <Square2StackIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.mergeCells()),
				action: (): void => {
					editor.chain().focus().mergeCells().run();
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 't-del',
				label: t('editorContextMenu.tableDeleteTable'),
				icon: <TrashIcon width={MENU_ICON} height={MENU_ICON} />,
				disabled: !safeEditorCan(editor, (can) => can.deleteTable()),
				action: (): void => {
					editor.chain().focus().deleteTable().run();
					onClose();
				},
			});
			pushDivider();
		}

		if (inLink) {
			rows.push({
				kind: 'section',
				key: 'sec-link',
				title: t('editorContextMenu.sectionLink'),
			});
			if (linkHref) {
				rows.push({
					kind: 'item',
					key: 'l-copy',
					label: t('editorContextMenu.linkCopyAddress'),
					icon: <DocumentDuplicateIcon width={MENU_ICON} height={MENU_ICON} />,
					action: (): void => {
						void safeCopyToClipboard(linkHref).then((copied) => {
							if (!copied) {
								notify.error(
									toastTitle,
									t('editorContextMenu.clipboardCopyLinkFailed')
								);
								return;
							}
							onClose();
						});
					},
				});
				const openable = /^https?:\/\//i.test(linkHref);
				rows.push({
					kind: 'item',
					key: 'l-open',
					label: t('editorContextMenu.linkOpen'),
					icon: (
						<ArrowTopRightOnSquareIcon width={MENU_ICON} height={MENU_ICON} />
					),
					disabled: !openable,
					action: (): void => {
						if (openable) {
							window.open(linkHref, '_blank', 'noopener,noreferrer');
						}
						onClose();
					},
				});
			}
			rows.push({
				kind: 'item',
				key: 'l-edit',
				label: t('editorContextMenu.linkEdit'),
				icon: <PencilIcon width={MENU_ICON} height={MENU_ICON} />,
				action: (): void => {
					dispatchDocEditorRuntimeDialogRequest({
						type: 'link',
						range: selectionRange,
						selectedText,
						initialUrl: linkHref || undefined,
						initialText: selectedText,
					});
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 'l-unset',
				label: t('editorContextMenu.linkUnset'),
				icon: <LinkSlashIcon width={MENU_ICON} height={MENU_ICON} />,
				action: (): void => {
					editor.chain().focus().extendMarkRange('link').unsetLink().run();
					onClose();
				},
			});
			pushDivider();
		}

		if (inImage) {
			rows.push({
				kind: 'section',
				key: 'sec-img',
				title: t('editorContextMenu.sectionImage'),
			});
			if (imageSrc && !imageSrc.startsWith('blob:')) {
				rows.push({
					kind: 'item',
					key: 'i-copy',
					label: t('editorContextMenu.imageCopyAddress'),
					icon: <DocumentDuplicateIcon width={MENU_ICON} height={MENU_ICON} />,
					action: (): void => {
						void safeCopyToClipboard(imageSrc).then((copied) => {
							if (!copied) {
								notify.error(
									toastTitle,
									t('editorContextMenu.clipboardCopyImageFailed')
								);
								return;
							}
							onClose();
						});
					},
				});
			}
			rows.push({
				kind: 'item',
				key: 'i-repl',
				label: t('editorContextMenu.imageReplace'),
				icon: <PhotoIcon width={MENU_ICON} height={MENU_ICON} />,
				action: (): void => {
					dispatchDocEditorRuntimeDialogRequest({
						type: 'image',
						range: selectionRange,
						initialUrl: imageSrc,
						initialAlt: imageAlt,
					});
					onClose();
				},
			});
			rows.push({
				kind: 'item',
				key: 'i-del',
				label: t('editorContextMenu.imageDelete'),
				icon: <TrashIcon width={MENU_ICON} height={MENU_ICON} />,
				tone: 'danger',
				action: (): void => {
					editor.chain().focus().deleteSelection().run();
					onClose();
				},
			});
			pushDivider();
		}

		rows.push({
			kind: 'section',
			key: 'sec-hist',
			title: t('editorContextMenu.sectionHistory'),
		});
		rows.push({
			kind: 'item',
			key: 'undo',
			label: t('editorContextMenu.undo'),
			icon: <ArrowUturnLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('Z'),
			disabled: !canUndo,
			action: (): void => {
				editor.chain().focus().undo().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'redo',
			label: t('editorContextMenu.redo'),
			icon: <ArrowUturnRightIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: redoShortcutLabel(),
			disabled: !canRedo,
			action: (): void => {
				editor.chain().focus().redo().run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd0' });
		rows.push({
			kind: 'section',
			key: 'sec-clip',
			title: t('editorContextMenu.sectionClipboard'),
		});
		rows.push({
			kind: 'item',
			key: 'cut',
			label: t('editorContextMenu.cut'),
			icon: <ScissorsIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('X'),
			disabled: !hasSelection,
			action: (): void => {
				if (!hasSelection) return;
				const text = selectedText;
				void safeCopyToClipboard(text).then((copied) => {
					if (!copied) {
						notify.error(
							toastTitle,
							t('editorContextMenu.clipboardCopyFailed')
						);
						return;
					}
					editor.chain().focus().deleteSelection().run();
					onClose();
				});
			},
		});
		rows.push({
			kind: 'item',
			key: 'copy',
			label: t('editorContextMenu.copy'),
			icon: <DocumentDuplicateIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('C'),
			disabled: !hasSelection,
			action: (): void => {
				if (!hasSelection) return;
				void safeCopyToClipboard(selectedText).then((copied) => {
					if (!copied) {
						notify.error(
							toastTitle,
							t('editorContextMenu.clipboardCopyFailed')
						);
						return;
					}
					onClose();
				});
			},
		});
		rows.push({
			kind: 'item',
			key: 'paste',
			label: t('editorContextMenu.paste'),
			icon: <ClipboardIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('V'),
			action: (): void => {
				void (async () => {
					editor.chain().focus().run();

					if (
						typeof navigator !== 'undefined' &&
						navigator.clipboard?.readText
					) {
						try {
							const text = await navigator.clipboard.readText();
							if (text.length > 0) {
								editor
									.chain()
									.focus()
									.insertContent(convertPlainTextToHtml(text))
									.run();
							}
							onClose();
							return;
						} catch (err) {
							console.warn(
								'[EditorContextMenu] ClipboardIcon readText failed',
								err
							);
						}
					}

					if (typeof document !== 'undefined') {
						try {
							const pasted = document.execCommand('paste');
							if (pasted) {
								onClose();
								return;
							}
						} catch (err) {
							console.error('[EditorContextMenu] execCommand(paste)', err);
						}
					}

					notify.error(toastTitle, t('editorContextMenu.clipboardPasteFailed'));
				})();
			},
		});
		rows.push({
			kind: 'item',
			key: 'select-all',
			label: t('editorContextMenu.selectAll'),
			icon: <ArrowsPointingOutIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: selectAllShortcut(),
			action: (): void => {
				editor.chain().focus().selectAll().run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd1' });
		rows.push({
			kind: 'section',
			key: 'sec-fmt',
			title: t('editorContextMenu.sectionFormat'),
		});
		rows.push({
			kind: 'item',
			key: 'bold',
			label: t('editorContextMenu.bold'),
			icon: <BoldIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('B'),
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleBold().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'italic',
			label: t('editorContextMenu.italic'),
			icon: <ItalicIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('I'),
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleItalic().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'underline',
			label: t('editorContextMenu.underline'),
			icon: <UnderlineIcon width={MENU_ICON} height={MENU_ICON} />,
			shortcut: primaryShortcut('U'),
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleUnderline().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'strike',
			label: t('editorContextMenu.strike'),
			icon: <StrikethroughIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleStrike().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'sub',
			label: t('editorContextMenu.subscript'),
			icon: <Bars3BottomLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleSubscript().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'sup',
			label: t('editorContextMenu.superscript'),
			icon: <Bars3BottomLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().toggleSuperscript().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'quote',
			label: t('editorContextMenu.blockquote'),
			icon: (
				<ChatBubbleBottomCenterTextIcon width={MENU_ICON} height={MENU_ICON} />
			),
			action: (): void => {
				editor.chain().focus().toggleBlockquote().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'clear-fmt',
			label: t('editorContextMenu.clearFormatting'),
			icon: <MinusIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().unsetAllMarks().unsetFontFamily().run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd2' });
		rows.push({
			kind: 'section',
			key: 'sec-head',
			title: t('editorContextMenu.sectionHeadings'),
		});
		for (const level of [1, 2, 3, 4, 5, 6] as const) {
			rows.push({
				kind: 'item',
				key: `h${level}`,
				label: t(`editorContextMenu.heading${level}` as const),
				icon: (
					<span className="text-[11px] font-bold tabular-nums">H{level}</span>
				),
				action: (): void => {
					editor.chain().focus().toggleHeading({ level }).run();
					onClose();
				},
			});
		}

		rows.push({ kind: 'divider', key: 'd3' });
		rows.push({
			kind: 'section',
			key: 'sec-ins',
			title: t('editorContextMenu.sectionInsert'),
		});
		rows.push({
			kind: 'item',
			key: 'link',
			label: t('editorContextMenu.insertLink'),
			icon: <LinkIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'link',
					range: selectionRange,
					selectedText,
				});
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'image',
			label: t('editorContextMenu.insertImage'),
			icon: <PhotoIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'image',
					range: selectionRange,
				});
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'table',
			label: t('editorContextMenu.insertTable'),
			icon: <TableCellsIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor
					.chain()
					.focus()
					.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
					.run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'formula',
			label: t('editorContextMenu.insertFormula'),
			icon: <CodeBracketSquareIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'formula',
					range: selectionRange,
					initialValue: 'E = mc^2',
				});
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'hr',
			label: t('editorContextMenu.horizontalRule'),
			icon: <MinusIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().setHorizontalRule().run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd4' });
		rows.push({
			kind: 'section',
			key: 'sec-list',
			title: t('editorContextMenu.sectionLists'),
		});
		rows.push({
			kind: 'item',
			key: 'bullet',
			label: t('editorContextMenu.bulletList'),
			icon: <ListBulletIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().toggleBulletList().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'ordered',
			label: t('editorContextMenu.orderedList'),
			icon: <NumberedListIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().toggleOrderedList().run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'task',
			label: t('editorContextMenu.taskList'),
			icon: <ClipboardDocumentCheckIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().toggleTaskList().run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd5' });
		rows.push({
			kind: 'section',
			key: 'sec-align',
			title: t('editorContextMenu.sectionAlign'),
		});
		rows.push({
			kind: 'item',
			key: 'al',
			label: t('editorContextMenu.alignLeft'),
			icon: <Bars3BottomLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().setTextAlign('left').run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'ac',
			label: t('editorContextMenu.alignCenter'),
			icon: <Bars3BottomLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().setTextAlign('center').run();
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'ar',
			label: t('editorContextMenu.alignRight'),
			icon: <Bars3BottomLeftIcon width={MENU_ICON} height={MENU_ICON} />,
			action: (): void => {
				editor.chain().focus().setTextAlign('right').run();
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd6' });
		rows.push({
			kind: 'section',
			key: 'sec-font',
			title: t('editorContextMenu.sectionFont'),
		});
		for (let index = 0; index < EDITOR_FONT_PRESETS.length; index++) {
			const preset = EDITOR_FONT_PRESETS[index];
			if (!preset) continue;
			rows.push({
				kind: 'item',
				key: `font-${preset.presetId}`,
				label: t(`slashCommands.fontPresetLabels.${preset.presetId}`, {
					defaultValue: preset.label,
				}),
				icon: <LanguageIcon width={MENU_ICON} height={MENU_ICON} />,
				action: (): void => {
					if (preset.fontFamily === '') {
						editor.chain().focus().unsetFontFamily().run();
					} else {
						editor.chain().focus().setFontFamily(preset.fontFamily).run();
					}
					onClose();
				},
			});
		}

		rows.push({ kind: 'divider', key: 'd7' });
		rows.push({
			kind: 'section',
			key: 'sec-color',
			title: t('editorContextMenu.sectionColor'),
		});
		rows.push({
			kind: 'item',
			key: 'fg',
			label: t('editorContextMenu.textColor'),
			icon: <SwatchIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'textColor',
					range: selectionRange,
					position: { x: px + 12, y: py + 12 },
				});
				onClose();
			},
		});
		rows.push({
			kind: 'item',
			key: 'bg',
			label: t('editorContextMenu.highlightColor'),
			icon: <SparklesIcon width={MENU_ICON} height={MENU_ICON} />,
			disabled: !hasSelection,
			action: (): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'highlightColor',
					range: selectionRange,
					position: { x: px + 12, y: py + 12 },
				});
				onClose();
			},
		});

		rows.push({ kind: 'divider', key: 'd8' });
		rows.push({
			kind: 'item',
			key: 'del',
			label: t('editorContextMenu.delete'),
			icon: <TrashIcon width={MENU_ICON} height={MENU_ICON} />,
			tone: 'danger',
			disabled: !hasSelection,
			action: (): void => {
				editor.chain().focus().deleteSelection().run();
				onClose();
			},
		});

		return rows;
	}, [
		editor,
		hasSelection,
		isOpen,
		onClose,
		px,
		py,
		selectedText,
		selectionRange,
		t,
	]);

	const handleMenuKeyDownCapture = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
				return;
			}
			const root = menuRef.current;
			if (!root) {
				return;
			}
			const buttons = [
				...root.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
			].filter((b) => !b.disabled);
			if (buttons.length === 0) {
				return;
			}

			const currentIdx = buttons.indexOf(
				document.activeElement as HTMLButtonElement
			);

			if (event.key === 'ArrowDown') {
				event.preventDefault();
				event.stopPropagation();
				const next = currentIdx < 0 ? 0 : (currentIdx + 1) % buttons.length;
				buttons[next]?.focus();
				buttons[next]?.scrollIntoView({ block: 'nearest' });
			} else if (event.key === 'ArrowUp') {
				event.preventDefault();
				event.stopPropagation();
				const next = currentIdx <= 0 ? buttons.length - 1 : currentIdx - 1;
				buttons[next]?.focus();
				buttons[next]?.scrollIntoView({ block: 'nearest' });
			} else if (event.key === 'Home') {
				event.preventDefault();
				event.stopPropagation();
				buttons[0]?.focus();
				buttons[0]?.scrollIntoView({ block: 'nearest' });
			} else if (event.key === 'End') {
				event.preventDefault();
				event.stopPropagation();
				const last = buttons.length - 1;
				buttons[last]?.focus();
				buttons[last]?.scrollIntoView({ block: 'nearest' });
			}
		},
		[]
	);

	if (!editor) {
		return null;
	}

	if (typeof document === 'undefined') {
		return null;
	}

	const { style: portalShellStyle, theme: portalTheme } =
		getDesktopPortalShellProps();

	return (
		<ShellPortalMount>
			<div
				style={portalShellStyle}
				className={portalTheme === 'dark' ? 'dark' : ''}
			>
				<AnimatePresence>
					{isOpen && (
						<motion.div
							ref={menuRef}
							role="menu"
							aria-orientation="vertical"
							aria-label={t('editorContextMenu.ariaLabel')}
							onKeyDownCapture={handleMenuKeyDownCapture}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 6 }}
							transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
							className="fixed outline-none"
							style={{
								zIndex: contextMenuZ,
								left: `${resolvedPosition.x}px`,
								top: `${resolvedPosition.y}px`,
								transform: `scale(${uiScale})`,
								transformOrigin: 'top left',
							}}
						>
							<DesktopAppMenuSurface
								windowStyle={shellWindowStyle}
								className={cn(
									'flex max-h-[min(500px,calc(100vh-1.5rem))] min-w-[272px] min-h-0 flex-col overflow-hidden',
									'ring-1 ring-(--desktop-border-menu)'
								)}
							>
								<DesktopAppMenuHeader
									className="shrink-0"
									eyebrow={
										<DesktopAppSectionLabel>
											{t('editorContextMenu.headerEyebrow')}
										</DesktopAppSectionLabel>
									}
									subtitle={
										hasSelection
											? t('editorContextMenu.headerSubtitleSelection')
											: t('editorContextMenu.headerSubtitleCursor')
									}
									trailing={
										<DesktopAppStatusBadge
											className={cn(
												'border-transparent tabular-nums shadow-none',
												hasSelection
													? 'bg-[rgb(var(--desktop-accent-rgb))]/14 text-(--desktop-text-primary)'
													: 'bg-(--desktop-surface-soft)'
											)}
										>
											{hasSelection
												? t('editorContextMenu.badgeChars', {
														count: selectedText.length,
													})
												: t('editorContextMenu.badgeNoSelection')}
										</DesktopAppStatusBadge>
									}
								/>
								<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
									{menuRows.map((row) => {
										if (row.kind === 'divider') {
											return <DesktopAppMenuDivider key={row.key} />;
										}
										if (row.kind === 'section') {
											return (
												<div
													key={row.key}
													className={cn(
														'px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--desktop-text-dim)',
														row.key === 'sec-clip' ||
															row.key === 'sec-table' ||
															row.key === 'sec-link' ||
															row.key === 'sec-img'
															? 'mt-1.5'
															: 'mt-2.5'
													)}
												>
													{row.title}
												</div>
											);
										}
										return (
											<DesktopAppMenuItem
												key={row.key}
												type="button"
												role="menuitem"
												onClick={row.action}
												disabled={row.disabled}
												icon={row.icon}
												shortcut={row.shortcut}
												tone={row.tone === 'danger' ? 'danger' : 'default'}
											>
												{row.label}
											</DesktopAppMenuItem>
										);
									})}
								</div>
							</DesktopAppMenuSurface>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</ShellPortalMount>
	);
};
