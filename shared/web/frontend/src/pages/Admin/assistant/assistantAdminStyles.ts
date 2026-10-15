/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind class tokens for assistant admin forms and list actions.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/AssistantAdminSection.tsx
 */

/** Поля форм в тёмной админке: без «голого» slate, единый фокус. */
export const ADMIN_FIELD =
	'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-violet-500/35';
export const ADMIN_FIELD_SM =
	'rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35';

/** Вторичные кнопки в списках FAQ/KB */
export const ADMIN_SOFT_BTN =
	'rounded-md border border-transparent px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45';

/** Расширения, согласованные с бэкендом (Tika + .md). */
export const KB_UPLOAD_ACCEPT =
	'.pdf,.doc,.docx,.txt,.md,.markdown,.rtf,.odt,.html,.htm,.xml,.json,.csv,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.zip,.rar,.7z,.tar,.gz,.ods,.odp';
