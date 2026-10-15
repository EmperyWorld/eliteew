/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Proof / Fact vs Hypothesis and FAQ for EmpiierOS registry honesty.
 *
 * Related:
 * - reestr-mintsifry/11-website/cms-copy-paste.ru.md
 */

export const proof = {
  id: "proof",
  eyebrow: "Proof · факты и границы",
  title: "Что подтверждено и что пока нет",
  intro:
    "Для закупки и реестра: отделяем зафиксированные факты сборки от гипотез приёмки. Без номера реестра и без суммы на сайте.",
  factColumnHint:
    "Факты из лабораторного архива и исходников",
  hypothesisColumnHint:
    "Не обещаем — уточняем на вашем железе и в договоре поставки",
  airGapCaption:
    "LUKS2 для состояния и локальный щит — не сертификат СЗИ и не обещание приёмки на любом компьютере. NOT_READY в деревьях исходников.",
  facts: [
    {
      id: "sandbox",
      title: "Архитектура и пол",
      body: "x86_64; Linux 6.12.20; Buildroot 2025.02.1; профиль empiieros-shell; Wayland и labwc 0.8.3. Лабораторный SHA256 rootfs зафиксирован на 22.09.2026.",
    },
    {
      id: "agentless",
      title: "Реестр и продажи",
      body: "Записи в реестре российского ПО нет. Продаж права использования не было; выручка 0 ₽.",
    },
    {
      id: "instant",
      title: "Правообладатель",
      body: "ИП Кундухова Татьяна Александровна, ИНН 254007993190, ОГРНИП 323253600062900. Запрос: lady_boss@eliteew.ru.",
    },
  ],
  hypotheses: [
    {
      id: "sterile-disk",
      title: "Приёмка на произвольном ПК",
      body: "Сценарий «стереть диск и перезагрузиться» на любом компьютере не закрыт. Деревья помечены NOT_READY — это гипотеза поставки, не опубликованный факт.",
    },
    {
      id: "latency",
      title: "Список железа",
      body: "Полный перечень видеокарт и моделей не опубликован. Заявлена только архитектура x86_64.",
    },
    {
      id: "analog",
      title: "Канал обновлений",
      body: "Скрипты могут называть app.eliteew.ru; где физически стоит сервер обновлений, в фактах не опубликовано. Сеанс не заявлен как невозможный без сети.",
    },
  ],
  expertKit: {
    whitepaperLabel: "Описание для реестра",
    whitepaperStatus: "Страница /empiieros/description",
    whitepaperHref: "/empiieros/description",
    diagramLabel: "Схема разметки диска (EFI · корень · LUKS)",
    diagramHint: "Метафора разделов; детали — в описании и docs",
    contactCtaLabel: "Запросить материалы поставки",
    contactCtaHref: "#contact",
  },
  faqIntro:
    "Короткие ответы без номера реестра, без суммы и без обещания СЗИ.",
  faq: [
    {
      id: "perf",
      tag: "Safe Workspace",
      claimKind: "fact" as const,
      q: "Это Safe Workspace?",
      a: "Нет. Safe Workspace и кабинет app.eliteew.ru — другие продукты. EmpiierOS ставится на диск компьютера.",
      proof: "Fact · класс продукта",
      proofHref: "#comparison",
    },
    {
      id: "photo",
      tag: "Реестр",
      claimKind: "fact" as const,
      q: "ОС уже в реестре Минцифры?",
      a: "Нет. Номера записи нет.",
      proof: "Fact · registry",
      proofHref: "#proof",
    },
    {
      id: "vpn",
      tag: "Цена",
      claimKind: "fact" as const,
      q: "Сколько стоит?",
      a: "Сумма не опубликована. Продаж не было. Запрос на lady_boss@eliteew.ru или страница /empiieros/price.",
      proof: "Fact · on request",
      proofHref: "/empiieros/price",
    },
    {
      id: "rollout",
      tag: "Железо",
      claimKind: "hypothesis" as const,
      q: "На каких компьютерах работает?",
      a: "Заявлена архитектура x86_64. Список проверенных моделей не опубликован. Приёмка на произвольном ПК не закрыта.",
      proof: "Hypothesis · NOT_READY",
      proofHref: "#proof",
    },
  ],
} as const;
