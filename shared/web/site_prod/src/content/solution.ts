/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Solution block — EmpiierOS pillars (floor / install / session).
 *
 * Related:
 * - reestr-mintsifry/11-website/page-description.md
 */

import type { CtaSpec } from "./types";

export const solution = {
  id: "solution",
  eyebrow: "EmpiierOS · состав изделия",
  title: "Что входит в операционную систему",
  identity:
    "EmpiierOS — операционная система общего назначения для x86_64: пол Linux 6.12.20 и Buildroot 2025.02.1, профиль empiieros-shell, графический сеанс Wayland с композитором labwc 0.8.3.",
  trustNotes: [
    "Только x86_64",
    "Русская оболочка по умолчанию",
    "Не запись в реестре",
  ],
  pillarsEyebrow: "Три опоры",
  pillarsIntro:
    "Пол · установка · сеанс. Лабораторный архив rootfs от 22.09.2026 — не коммерческий релиз.",
  pillars: [
    {
      id: "sandbox",
      title: "Пол из исходников",
      metaphor: "Buildroot",
      tech: "Ядро Linux 6.12.20, Buildroot 2025.02.1, профиль empiieros-shell. Не установка готового Fedora как единственной основы.",
      benefit:
        "Сборка пола под изделие, а не переклейка чужого дистрибутива без профиля empiieros-shell.",
      result: "Повторяемый образ rootfs с зафиксированным SHA256 лабораторного архива.",
    },
    {
      id: "zero-agent",
      title: "Установка на диск",
      metaphor: "EFI · корень · состояние",
      tech: "UEFI: системный раздел EFI, корень, отдельный раздел состояния LUKS2. PIN первого включения не равен ключу тома состояния.",
      benefit:
        "Локальное хранение состояния отделено от системного раздела; время при установке задаёт человек.",
      result: "Рабочее место на внутреннем диске, не в облачной вкладке.",
    },
    {
      id: "instant",
      title: "Сеанс и сеть",
      metaphor: "Wayland · labwc",
      tech: "Графический сеанс, браузер кресла и локальный щит. Сеть: DHCP, статика, Wi‑Fi. Канал обновлений можно не включать.",
      benefit:
        "Сеанс не описан как невозможный без постоянного интернета; NTP в установочном контуре выключен.",
      result: "Русскоязычное кресло на локальном компьютере.",
    },
  ],
  visualBrief:
    "Transformation: «Открыть рабочее место» — локальный сеанс EmpiierOS на диске вместо облачной вкладки",
  transformCtaLabel: "Открыть рабочее место",
  transformLinkLabel: "Подробное описание",
  transformHref: "/empiieros/description",
  cta: {
    label: "Запросить порядок поставки",
    intent: "poc",
    href: "#contact",
    variant: "primary",
  } as const satisfies CtaSpec,
} as const;
