/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portal UI for EnhancedWindow text copy/paste context menu.
 *
 * Invariants:
 * - Clipboard failures are logged; menu always closes in finally.
 *
 * Related:
 * - useEnhancedWindowTextContextMenu.ts
 * - EnhancedWindow.tsx
 */

import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { m } from 'framer-motion';
import type { MutableRefObject } from 'react';
import type { DesktopWindowStyle } from '../../../../types/profile';
import { safeCopyToClipboard } from '../../../../utils/clipboard';
import { DesktopAppMenuItem, DesktopAppMenuSurface } from '../DesktopAppChrome';
import type { EnhancedWindowTextContextMenuState } from './useEnhancedWindowTextContextMenu';

export type EnhancedWindowTextContextMenuProps = {
	menu: EnhancedWindowTextContextMenuState;
	visualStyle: DesktopWindowStyle;
	reduceMotion: boolean | undefined;
	floatingMenuZIndex: number;
	floatingMenuBackdropZIndex: number;
	textContextRangeRef: MutableRefObject<Range | null>;
	onClose: () => void;
};

export function EnhancedWindowTextContextMenu({
	menu,
	visualStyle,
	reduceMotion,
	floatingMenuZIndex,
	floatingMenuBackdropZIndex,
	textContextRangeRef,
	onClose,
}: EnhancedWindowTextContextMenuProps) {
	return (
		<ShellPortalMount>
			<div
				className="fixed inset-0"
				style={{ zIndex: floatingMenuBackdropZIndex }}
				aria-hidden
				onClick={onClose}
			/>
			<m.div
				initial={
					reduceMotion === true ? false : { opacity: 0, scale: 0.95, y: 4 }
				}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={
					reduceMotion === true
						? { opacity: 0 }
						: { opacity: 0, scale: 0.95, y: 4 }
				}
				className="fixed"
				style={{
					left: menu.x,
					top: menu.y,
					zIndex: floatingMenuZIndex,
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<DesktopAppMenuSurface windowStyle={visualStyle} className="min-w-42">
					{(menu.mode === 'copy' || menu.mode === 'copy-paste') && (
						<DesktopAppMenuItem
							type="button"
							shortcut={<span className="tabular-nums">Ctrl+C</span>}
							onClick={async () => {
								try {
									const textFromMenu = menu.selectionText;
									const fallbackSelection =
										typeof window !== 'undefined' &&
										typeof window.getSelection === 'function'
											? window.getSelection()
											: null;
									const textFromWindow =
										fallbackSelection && !fallbackSelection.isCollapsed
											? fallbackSelection.toString()
											: '';
									const text = textFromMenu || textFromWindow;
									if (text) {
										const copied = await safeCopyToClipboard(text);
										if (!copied) {
											console.error('[EnhancedWindow] Clipboard copy failed');
										}
									}
								} finally {
									onClose();
								}
							}}
						>
							Копировать
						</DesktopAppMenuItem>
					)}
					{(menu.mode === 'paste' || menu.mode === 'copy-paste') && (
						<DesktopAppMenuItem
							type="button"
							shortcut={<span className="tabular-nums">Ctrl+V</span>}
							onClick={async () => {
								try {
									const active =
										(menu.editableElement as HTMLElement | null) ??
										(typeof document !== 'undefined'
											? (document.activeElement as HTMLElement | null)
											: null);
									if (!active) return;
									active.focus();

									if (typeof document !== 'undefined') {
										try {
											// Keep this first and synchronous to preserve user-activation.
											const pasted = document.execCommand('paste');
											if (pasted) {
												return;
											}
										} catch (err) {
											console.warn(
												'[EnhancedWindow] execCommand(paste) failed',
												err
											);
										}
									}

									let text = '';
									if (
										typeof navigator !== 'undefined' &&
										navigator.clipboard?.readText
									) {
										try {
											text = await navigator.clipboard.readText();
										} catch (err) {
											console.error(
												'[EnhancedWindow] Clipboard readText failed',
												err
											);
										}
									}

									if (!text) return;

									if (
										active instanceof HTMLInputElement ||
										active instanceof HTMLTextAreaElement
									) {
										const el = active;
										const start =
											menu.inputSelection?.start ??
											el.selectionStart ??
											el.value.length;
										const end =
											menu.inputSelection?.end ??
											el.selectionEnd ??
											el.value.length;
										const nextValue =
											el.value.slice(0, start) + text + el.value.slice(end);
										const nativeValueSetter = Object.getOwnPropertyDescriptor(
											el instanceof HTMLTextAreaElement
												? window.HTMLTextAreaElement.prototype
												: window.HTMLInputElement.prototype,
											'value'
										)?.set;
										if (nativeValueSetter) {
											nativeValueSetter.call(el, nextValue);
										} else {
											el.value = nextValue;
										}
										const pos = start + text.length;
										el.selectionStart = pos;
										el.selectionEnd = pos;
										if (typeof InputEvent !== 'undefined') {
											el.dispatchEvent(
												new InputEvent('input', {
													bubbles: true,
													data: text,
													inputType: 'insertText',
												})
											);
										} else {
											el.dispatchEvent(new Event('input', { bubbles: true }));
										}
										el.dispatchEvent(new Event('change', { bubbles: true }));
									} else if (
										active.isContentEditable &&
										typeof window !== 'undefined' &&
										typeof document !== 'undefined'
									) {
										const sel = window.getSelection();
										if (!sel) return;
										let range: Range | null = null;
										const savedRange = textContextRangeRef.current;
										if (
											savedRange &&
											active.contains(savedRange.commonAncestorContainer)
										) {
											range = savedRange.cloneRange();
										} else if (sel.rangeCount > 0) {
											const candidate = sel.getRangeAt(0);
											if (active.contains(candidate.commonAncestorContainer)) {
												range = candidate;
											}
										}
										if (!range) {
											range = document.createRange();
											range.selectNodeContents(active);
											range.collapse(false);
											sel.removeAllRanges();
											sel.addRange(range);
										}
										range.deleteContents();
										const node = document.createTextNode(text);
										range.insertNode(node);
										range.setStartAfter(node);
										range.collapse(true);
										sel.removeAllRanges();
										sel.addRange(range);
										if (typeof InputEvent !== 'undefined') {
											active.dispatchEvent(
												new InputEvent('input', {
													bubbles: true,
													data: text,
													inputType: 'insertText',
												})
											);
										} else {
											active.dispatchEvent(
												new Event('input', { bubbles: true })
											);
										}
										active.dispatchEvent(
											new Event('change', { bubbles: true })
										);
									} else if (typeof document !== 'undefined') {
										try {
											document.execCommand('insertText', false, text);
										} catch (err) {
											console.error(
												'[EnhancedWindow] execCommand(insertText) failed',
												err
											);
										}
									}
								} catch (err) {
									console.error('[EnhancedWindow] Clipboard paste failed', err);
								} finally {
									onClose();
								}
							}}
						>
							Вставить
						</DesktopAppMenuItem>
					)}
				</DesktopAppMenuSurface>
			</m.div>
		</ShellPortalMount>
	);
}
