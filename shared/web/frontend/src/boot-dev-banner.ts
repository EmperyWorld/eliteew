/**
 * ------------------------------------------------------------------------------
 *  EliteEW · Empery World · https://eliteew.ru
 *  Author: po&T <keysray70@gmail.com>
 * ------------------------------------------------------------------------------
 *
 * Purpose:
 * Ранний модуль из `index.html`: печать консольного баннера авторства до загрузки основного бандла `main.tsx`.
 *
 * Invariants:
 * - Должен оставаться первым `type="module"` после разметки preloader/root (см. `index.html`).
 *
 * Related:
 * - `utils/devAuthorshipBanner.ts`, `main.tsx`, `index.html`
 */

import { printAuthorshipConsoleBanner } from './utils/devAuthorshipBanner';

if (typeof window !== 'undefined') {
	printAuthorshipConsoleBanner();
}
