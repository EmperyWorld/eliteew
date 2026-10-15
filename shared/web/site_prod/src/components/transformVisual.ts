/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layering stage labels for TransformationScene (chaos → Safe Workspace dome).
 *
 * Invariants:
 * - Stage B is separation / isolation language, not employee surveillance.
 *
 * Related:
 * - TransformationScene.tsx
 * - documentation/product/SITE-PROD-LANDING.md §Visual
 */

export const LAYERING_STAGE = {
  eyebrow: "Layering · One Click Transformation",
  title: "Облачная вкладка → локальное кресло на диске",
  flowHint: "A хаос → B купол · один клик",
  stages: [
    {
      id: "chaos",
      letter: "A",
      label: "Хаос BYOD",
      hint: "мессенджеры · облака · файлы на личном устройстве",
      status: "без рабочего слоя",
      tone: "risk" as const,
    },
    {
      id: "dome",
      letter: "B",
      label: "EmpiierOS",
      hint: "локальный сеанс на диске — облако остаётся отдельным продуктом",
      status: "сеанс активен",
      tone: "safe" as const,
    },
  ],
  disclaimer: "Метафора Layering — демонстрация купола, не live desktop клиента.",
} as const;

/** Device bezel + Stage A chrome copy for the interactive laptop frame. */
export const LAYERING_DEVICE = {
  bezelLabel: "Личное устройство · BYOD",
  clock: "09:41",
  stageABadge: "этап A · без рабочего слоя",
  stageBBadge: "этап B · купол активен",
  addressBar: "personal-device.local · BYOD · без корпоративного периметра",
  riskBanner:
    "Корп. данные в личных каналах · классический периметр эти окна не видит",
  riskChip: "смешение · риск утечки",
} as const;

export function layeringStageActiveId(domeActive: boolean): "chaos" | "dome" {
  return domeActive ? "dome" : "chaos";
}
