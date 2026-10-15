/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for Solution pillars (Safe Workspace value props).
 *
 * Invariants:
 * - Keys align with solution.pillars ids; separation framing only.
 *
 * Related:
 * - SolutionSection.tsx
 * - content/solution.ts
 */

export const SOLUTION_PILLAR_VISUAL = {
  sandbox: {
    step: "01",
    techLabel: "Как устроено",
    benefitLabel: "Зачем бизнесу",
    outcomeLabel: "Итог",
    layerHint: "Buildroot 2025.02.1 · ядро 6.12.20",
    tone: "lead" as const,
    badge: "Floor",
  },
  "zero-agent": {
    step: "02",
    techLabel: "Как устроено",
    benefitLabel: "Зачем бизнесу",
    outcomeLabel: "Итог",
    layerHint: "EFI · корень · LUKS2 состояние",
    tone: "access" as const,
    badge: "Install",
  },
  instant: {
    step: "03",
    techLabel: "Как устроено",
    benefitLabel: "Зачем бизнесу",
    outcomeLabel: "Итог",
    layerHint: "Wayland · labwc · русская оболочка",
    tone: "speed" as const,
    badge: "Session",
  },
} as const;

export const SOLUTION_PILLARS_META = {
  flowHint: "пол · установка · сеанс",
} as const;

export type SolutionPillarVisualId = keyof typeof SOLUTION_PILLAR_VISUAL;

export function hasVisualForPillar(id: string): id is SolutionPillarVisualId {
  return id in SOLUTION_PILLAR_VISUAL;
}

export const SOLUTION_LAYER_STACK = [
  {
    id: "device",
    letter: "A",
    role: "Нижний слой · BYOD",
    label: "Личное устройство",
    detail: "Мессенджеры · фото · личные облака — хаос остаётся здесь",
    chips: ["Мессенджеры", "Чаты", "Облака", "Фото"],
  },
  {
    id: "dome",
    letter: "B",
    role: "Рабочий слой · купол",
    label: "EmpiierOS",
    detail: "Локальный графический сеанс на диске — не облачная вкладка",
    chips: ["Buildroot пол", "LUKS состояние", "Wayland · labwc"],
  },
] as const;

export const SOLUTION_LAYER_CAPTION =
  "Мы не подменяем облако — показываем локальную ОС на диске x86_64";

export const SOLUTION_LAYER_DEMO = {
  href: "#hook",
  label: "Интерактивно в hero",
  hint: "One Click Transformation · кнопка «Открыть рабочее место»",
} as const;

export const SOLUTION_CTA_PATHS = {
  poc: {
    step: "01",
    eyebrow: "Пилот",
    hint: "Запрос поставки · заявка в #contact",
    friction: "Один запрос",
  },
  transform: {
    step: "02",
    eyebrow: "Демо Layering",
    hint: "One Click Transformation в hero · без формы",
    friction: "~30 сек",
  },
} as const;
