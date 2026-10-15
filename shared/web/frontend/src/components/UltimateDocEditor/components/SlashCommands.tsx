/**
 * 🔥💎 Slash Commands 💎🔥
 *
 * Slash command system for Tiptap editor
 * Type "/" to see available commands
 *
 * Created: 2025-01-XX
 */

import { Extension, type Range } from '@tiptap/core';
import { type Editor, ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { TFunction } from 'i18next';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppMenuSurface,
	DesktopAppSectionLabel,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { cn } from '../../../lib/utils';
import { dispatchDocEditorRuntimeDialogRequest } from '../utils/runtimeDialogEvents';
import { EDITOR_FONT_PRESETS } from '../utils/editorFontPresets';
import i18n from 'i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import {
	Bars3BottomLeftIcon,
	ChatBubbleBottomCenterTextIcon,
	ClipboardDocumentCheckIcon,
	CodeBracketIcon,
	CodeBracketSquareIcon,
	DocumentTextIcon,
	LanguageIcon,
	ListBulletIcon,
	MinusIcon,
	NumberedListIcon,
	PhotoIcon,
	TableCellsIcon,
} from '@heroicons/react/24/outline';

interface CommandItem {
	id: string;
	title: string;
	description: string;
	icon: React.ReactNode;
	command: ({ editor, range }: { editor: Editor; range: Range }) => void;
}

function buildSlashCommands(t: TFunction): CommandItem[] {
	const it = (key: string) => ({
		title: t(`slashCommands.items.${key}.title`),
		description: t(`slashCommands.items.${key}.description`),
	});

	return [
		{
			id: 'heading-1',
			...it('heading1'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 1 })
					.run();
			},
		},
		{
			id: 'heading-2',
			...it('heading2'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 2 })
					.run();
			},
		},
		{
			id: 'heading-3',
			...it('heading3'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 3 })
					.run();
			},
		},
		{
			id: 'heading-4',
			...it('heading4'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 4 })
					.run();
			},
		},
		{
			id: 'heading-5',
			...it('heading5'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 5 })
					.run();
			},
		},
		{
			id: 'heading-6',
			...it('heading6'),
			icon: <Bars3BottomLeftIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.setNode('heading', { level: 6 })
					.run();
			},
		},
		{
			id: 'bullet-list',
			...it('bulletList'),
			icon: <ListBulletIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).toggleBulletList().run();
			},
		},
		{
			id: 'ordered-list',
			...it('orderedList'),
			icon: <NumberedListIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).toggleOrderedList().run();
			},
		},
		{
			id: 'task-list',
			...it('taskList'),
			icon: <ClipboardDocumentCheckIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).toggleTaskList().run();
			},
		},
		{
			id: 'code-block',
			...it('codeBlock'),
			icon: <CodeBracketIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
			},
		},
		{
			id: 'blockquote',
			...it('blockquote'),
			icon: <ChatBubbleBottomCenterTextIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).toggleBlockquote().run();
			},
		},
		{
			id: 'image',
			...it('image'),
			icon: <PhotoIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'image',
					range: { from: range.from, to: range.to },
				});
				editor.chain().focus().run();
			},
		},
		{
			id: 'table',
			...it('table'),
			icon: <TableCellsIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor
					.chain()
					.focus()
					.deleteRange(range)
					.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
					.run();
			},
		},
		{
			id: 'horizontal-rule',
			...it('horizontalRule'),
			icon: <MinusIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).setHorizontalRule().run();
			},
		},
		{
			id: 'formula',
			...it('formula'),
			icon: <CodeBracketSquareIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				dispatchDocEditorRuntimeDialogRequest({
					type: 'formula',
					range: { from: range.from, to: range.to },
					initialValue: 'E = mc^2',
				});
				editor.chain().focus().run();
			},
		},
		{
			id: 'paragraph',
			...it('paragraph'),
			icon: <DocumentTextIcon width={20} height={20} />,
			command: ({ editor, range }): void => {
				editor.chain().focus().deleteRange(range).setParagraph().run();
			},
		},
		...EDITOR_FONT_PRESETS.map((preset) => {
			const label = t(`slashCommands.fontPresetLabels.${preset.presetId}`);
			return {
				id: `font-${preset.presetId}`,
				title: preset.fontFamily
					? t('slashCommands.fontCommand.namedTitle', { label })
					: t('slashCommands.fontCommand.defaultTitle'),
				description: preset.fontFamily
					? t('slashCommands.fontCommand.namedDesc', { label })
					: t('slashCommands.fontCommand.defaultDesc'),
				icon: (
					<span
						className="flex items-center justify-center"
						style={
							preset.fontFamily ? { fontFamily: preset.fontFamily } : undefined
						}
					>
						<LanguageIcon width={20} height={20} />
					</span>
				),
				command: ({
					editor,
					range,
				}: {
					editor: Editor;
					range: Range;
				}): void => {
					const chain = editor.chain().focus().deleteRange(range);
					if (preset.fontFamily === '') {
						chain.unsetFontFamily().run();
					} else {
						chain.setFontFamily(preset.fontFamily).run();
					}
				},
			};
		}),
	];
}

function getSlashCommandsForCurrentLanguage(): CommandItem[] {
	const t = i18n.getFixedT(i18n.language, ULTIMATE_DOC_EDITOR_NS);
	return buildSlashCommands(t);
}

interface CommandListProps {
	items: CommandItem[];
	command: (item: CommandItem) => void;
}

interface CommandListHandle {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const CommandList = forwardRef<CommandListHandle, CommandListProps>(
	(props, ref) => {
		const { t } = useTranslation('ultimateDocEditor');
		const [selectedIndex, setSelectedIndex] = useState(0);
		const { items, command } = props;

		const selectItem = (index: number): void => {
			const item = items[index];
			if (item) {
				command(item);
			}
		};

		// Reset keyboard selection when the filtered slash list changes (e.g. typing after "/").
		// biome-ignore lint/correctness/useExhaustiveDependencies: intentional — query drives `items` from TipTap suggestion
		useEffect(() => {
			setSelectedIndex(0);
		}, [items]);

		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: ({ event }: { event: KeyboardEvent }): boolean => {
					const n = items.length;
					if (n === 0) {
						return false;
					}

					if (event.key === 'ArrowUp') {
						setSelectedIndex((prev) => (prev + n - 1) % n);
						return true;
					}

					if (event.key === 'ArrowDown') {
						setSelectedIndex((prev) => (prev + 1) % n);
						return true;
					}

					if (event.key === 'Enter') {
						const item = items[selectedIndex];
						if (item) {
							command(item);
						}
						return true;
					}

					return false;
				},
			}),
			[selectedIndex, items, command]
		);

		return (
			<DesktopAppMenuSurface className="min-w-[300px] max-h-[320px] overflow-y-auto p-1.5">
				<div className="px-3 pb-2 pt-1">
					<div className="flex items-center justify-between gap-3">
						<div>
							<DesktopAppSectionLabel>
								{t('slashCommands.title')}
							</DesktopAppSectionLabel>
							<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
								{t('slashCommands.subtitle')}
							</p>
						</div>
						<DesktopAppStatusBadge>{items.length}</DesktopAppStatusBadge>
					</div>
				</div>
				{items.length ? (
					items.map((item, index) => (
						<button
							key={item.id}
							type="button"
							onClick={() => selectItem(index)}
							className={cn(
								'flex w-full min-h-11 items-center gap-3 rounded-(--desktop-radius) px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/50',
								index === selectedIndex
									? 'bg-(--desktop-surface-accent) text-white'
									: 'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-white'
							)}
						>
							<span
								className={cn(
									'flex h-9 w-9 shrink-0 items-center justify-center rounded-(--desktop-radius) border',
									index === selectedIndex
										? 'border-white/15 bg-white/10 text-white'
										: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
								)}
							>
								{item.icon}
							</span>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-semibold">
									{item.title}
								</div>
								<div
									className={cn(
										'truncate text-xs leading-relaxed',
										index === selectedIndex
											? 'text-white/70'
											: 'text-(--desktop-text-muted)'
									)}
								>
									{item.description}
								</div>
							</div>
						</button>
					))
				) : (
					<div
						role="status"
						aria-live="polite"
						className="px-4 py-4 text-center"
					>
						<p className="text-sm font-medium text-(--desktop-text-primary)">
							{t('slashCommands.emptyTitle')}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
							{t('slashCommands.emptyHint')}
						</p>
					</div>
				)}
			</DesktopAppMenuSurface>
		);
	}
);

CommandList.displayName = 'CommandList';

export const SlashCommand = Extension.create({
	name: 'slashCommand',

	addOptions() {
		return {
			suggestion: {
				char: '/',
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor;
					range: Range;
					props: CommandItem;
				}): void => {
					props.command({ editor, range });
				},
				items: ({ query }: { query: string }): CommandItem[] => {
					const all = getSlashCommandsForCurrentLanguage();
					const q = query.trim().toLowerCase();
					if (!q) {
						return all;
					}
					return all.filter((item) => {
						const title = item.title.toLowerCase();
						const desc = item.description.toLowerCase();
						return title.includes(q) || desc.includes(q);
					});
				},
				render: (): {
					onStart: (props: {
						editor: Editor;
						clientRect?: () => DOMRect | null;
					}) => void;
					onUpdate: (props: {
						editor: Editor;
						clientRect?: () => DOMRect | null;
					}) => void;
					onKeyDown: (props: { event: KeyboardEvent }) => boolean;
					onExit: () => void;
				} => {
					let component: ReactRenderer;
					let popup: TippyInstance | undefined;

					return {
						onStart: (props: {
							editor: Editor;
							clientRect?: () => DOMRect | null;
						}): void => {
							component = new ReactRenderer(CommandList, {
								props,
								editor: props.editor,
							});

							if (!props.clientRect) {
								return;
							}

							popup = tippy(document.body, {
								getReferenceClientRect: (): DOMRect => {
									const rect = props.clientRect?.();
									if (!rect) {
										// Return a default rect if null
										return new DOMRect(0, 0, 0, 0);
									}
									return rect;
								},
								appendTo: (): HTMLElement => document.body,
								content: component.element,
								showOnCreate: true,
								interactive: true,
								trigger: 'manual',
								placement: 'bottom-start',
							});
						},

						onUpdate: (props: {
							editor: Editor;
							clientRect?: () => DOMRect | null;
						}): void => {
							component.updateProps(props);

							if (!props.clientRect) {
								return;
							}

							if (popup) {
								popup.setProps({
									getReferenceClientRect: (): DOMRect => {
										const rect = props.clientRect?.();
										if (!rect) {
											// Return a default rect if null
											return new DOMRect(0, 0, 0, 0);
										}
										return rect;
									},
								});
							}
						},

						onKeyDown: (props: { event: KeyboardEvent }): boolean => {
							if (props.event.key === 'Escape') {
								if (popup) {
									popup.hide();
								}
								return true;
							}

							return (
								(component.ref as CommandListHandle | null)?.onKeyDown(props) ??
								false
							);
						},

						onExit: (): void => {
							if (popup) {
								popup.destroy();
							}
							component.destroy();
						},
					};
				},
			} as unknown as SuggestionOptions<CommandItem, CommandItem>,
		};
	},

	addProseMirrorPlugins(): ReturnType<typeof Suggestion>[] {
		return [
			Suggestion({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				...(this.options.suggestion as SuggestionOptions<
					CommandItem,
					CommandItem
				>),
				editor: this.editor,
			}),
		];
	},
});
