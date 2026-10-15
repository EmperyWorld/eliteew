/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scoped ProseMirror CSS for Ultimate Doc Editor — comment anchors, collaboration
 * carets, list restoration, task lists, tables, and code blocks.
 *
 * Invariants:
 * - Injected as inline `<style>` sibling to editor host (same as pre-atomization).
 * - Selectors remain under `.tiptap` / `.ProseMirror` scope.
 *
 * Related:
 * - TiptapEditor.tsx
 * - commentAnchorExtension.ts
 */

import * as React from 'react';

export const TIPTAP_EDITOR_PROSE_STYLES = `
        .tiptap.ProseMirror {
          color: var(--desktop-text-primary);
        }

        .tiptap.ProseMirror ::selection {
          background: rgba(var(--desktop-accent-rgb), 0.28);
        }

        .tiptap.ProseMirror.comment-anchor-flash {
          animation: comment-anchor-pulse 1.2s ease-out;
        }

        .tiptap .comment-anchor-range {
          border-radius: 4px;
          box-decoration-break: clone;
          transition: background-color 140ms ease, box-shadow 140ms ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .tiptap .comment-anchor-range {
            transition: none;
          }
          .tiptap.ProseMirror.comment-anchor-flash {
            animation: none;
          }
        }
        .tiptap .comment-anchor-open {
          background: rgba(59, 130, 246, 0.2);
          box-shadow: inset 0 -1px 0 rgba(96, 165, 250, 0.5);
        }
        .tiptap .comment-anchor-resolved {
          background: rgba(34, 197, 94, 0.14);
          box-shadow: inset 0 -1px 0 rgba(74, 222, 128, 0.35);
        }
        .tiptap .comment-anchor-active {
          background: rgba(var(--desktop-accent-rgb), 0.35);
          box-shadow: inset 0 -1px 0 rgba(var(--desktop-accent-rgb), 0.95), 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.45);
        }

        @keyframes comment-anchor-pulse {
          0% {
            box-shadow: inset 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.78), 0 0 0 0 rgba(var(--desktop-accent-rgb), 0.22);
            background: linear-gradient(120deg, rgba(var(--desktop-accent-rgb), 0.16), transparent 40%);
          }
          70% {
            box-shadow: inset 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.2), 0 0 0 10px rgba(var(--desktop-accent-rgb), 0);
            background: linear-gradient(120deg, rgba(var(--desktop-accent-rgb), 0.04), transparent 40%);
          }
          100% {
            box-shadow: inset 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.08), 0 0 0 14px rgba(var(--desktop-accent-rgb), 0);
            background: transparent;
          }
        }

        /* Совместное редактирование: чужие курсоры и выделения (TipTap CollaborationCaret + y-tiptap) */
        .tiptap .collaboration-carets__caret.doc-collab-remote-caret,
        .ProseMirror .collaboration-carets__caret.doc-collab-remote-caret {
          position: relative;
          z-index: 6;
          pointer-events: none;
          vertical-align: text-top;
          min-height: 1.35em;
          margin-left: -1px;
        }
        .tiptap .collaboration-carets__label.doc-collab-remote-label,
        .ProseMirror .collaboration-carets__label.doc-collab-remote-label {
          position: absolute;
          left: 0;
          bottom: 100%;
          margin-bottom: 4px;
          margin-left: -2px;
          max-width: min(14rem, 70vw);
          padding: 3px 9px 4px;
          border-radius: 0.5rem;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.2;
          color: rgba(255, 255, 255, 0.98);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow:
            0 4px 14px rgba(0, 0, 0, 0.22),
            0 0 0 1px rgba(0, 0, 0, 0.14);
          z-index: 10;
          pointer-events: none;
        }
        .tiptap .ProseMirror-yjs-selection,
        .tiptap .doc-collab-remote-selection {
          border-radius: 5px;
          opacity: 0.58;
        }

        /* Локальный пользователь: мягкая подсветка блока, где стоит курсор (совместный режим) */
        .tiptap .doc-collab-local-typing-block {
          border-radius: 6px;
          background: rgba(var(--desktop-accent-rgb), 0.1);
          box-shadow:
            inset 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.28),
            0 0 0 1px rgba(var(--desktop-accent-rgb), 0.06);
        }
        @media (prefers-reduced-motion: reduce) {
          .tiptap .doc-collab-local-typing-block {
            box-shadow: inset 0 0 0 1px rgba(var(--desktop-accent-rgb), 0.32);
          }
        }
        /* Легаси-классы y-prosemirror (если встретятся в старых путях) */
        .tiptap [class*="collaboration-cursor__selection"],
        .ProseMirror [class*="collaboration-cursor__selection"] {
          border-radius: 4px;
          opacity: 0.52;
        }

        /*
         * Bullet / ordered lists: Tailwind preflight sets list-style: none and zero padding on ul/ol.
         * We do not use @tailwindcss/typography here, so .prose does not restore markers — lists looked "broken"
         * while toggleBulletList / toggleOrderedList still updated the document (toolbar stayed "active").
         */
        .tiptap.ProseMirror ul:not(.task-list) {
          list-style-type: disc;
          list-style-position: outside;
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .tiptap.ProseMirror ol:not(.task-list) {
          list-style-type: decimal;
          list-style-position: outside;
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .tiptap.ProseMirror ul:not(.task-list) ul {
          list-style-type: circle;
        }
        .tiptap.ProseMirror ul:not(.task-list) ul ul {
          list-style-type: square;
        }
        .tiptap.ProseMirror li > p {
          margin: 0.25rem 0;
        }
        .tiptap.ProseMirror li > p:first-child {
          margin-top: 0;
        }
        .tiptap.ProseMirror li > p:last-child {
          margin-bottom: 0;
        }

        /* Task list styles */
        .task-list {
          list-style: none;
          padding-left: 0;
        }
        .task-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .task-item input[type="checkbox"] {
          margin-top: 0.25rem;
          cursor: pointer;
        }

        /* Highlight styles */
        .highlight {
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }

        /* Horizontal rule styles */
        .horizontal-rule {
          border: none;
          border-top: 2px solid rgba(var(--desktop-accent-rgb), 0.35);
          margin: 1.5rem 0;
        }

        /* Math formula styles */
        .math-formula {
          display: inline-block;
          margin: 0.5rem 0;
        }

        /* Code block improvements */
        .code-block {
          position: relative;
        }
        .code-block pre {
          margin: 0;
          padding: 1rem;
          background: var(--desktop-surface-soft);
          color: var(--desktop-text-primary);
          border: 1px solid var(--desktop-border-subtle);
          border-radius: var(--desktop-radius-lg);
          overflow-x: auto;
        }
        .editor-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--desktop-border-subtle);
          overflow: hidden;
          border-radius: var(--desktop-radius-lg);
        }
        .editor-table-row {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .editor-table-cell {
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.5rem 0.75rem;
        }
        .editor-table-header {
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.5rem 0.75rem;
          background: var(--desktop-surface-soft);
          font-weight: 700;
        }
        .editor-content-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: var(--desktop-radius-lg);
          box-shadow: var(--desktop-shadow-soft);
        }
        .editor-link {
          color: rgb(var(--desktop-accent-rgb));
          text-decoration: underline;
          cursor: pointer;
        }
      `;

export function TiptapEditorProseStyles(): React.ReactElement {
	return React.createElement('style', null, TIPTAP_EDITOR_PROSE_STYLES);
}
