/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JTBD portraits for EmpiierOS supply (infra, owner, end user).
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §JTBD
 */

export type JobRoleId = "ciso" | "ceo" | "employee";

export type JobRole = {
  id: JobRoleId;
  role: string;
  audience: string;
  pain: string;
  jobs: readonly string[];
  resonance: string;
};

export const jobs = {
  id: "jobs",
  eyebrow: "JTBD · кто нанимает ОС",
  title: "Три роли — три работы, которые нанимает EmpiierOS",
  intro:
    "Локальное рабочее место на диске: инфраструктура принимает архитектуру, владелец контура — риски закупки, сотрудник — сеанс на русском языке.",
  audienceChips: [
    "x86_64 · UEFI",
    "Диск · LUKS состояние",
    "Без ложных продаж",
  ] as const,
  rolesEyebrow: "Портреты ролей",
  rolesIntro:
    "Боль → Jobs to be Done → резонанс. Читайте карту своей роли: инфраструктура, закупка, пользователь кресла.",
  roles: [
    {
      id: "ciso",
      role: "ИТ-директор / инфраструктура",
      audience: "Decision Maker & Champion",
      pain: "Нужен контролируемый локальный контур: установка на диск, сеть, обновления по политике владельца — без подмены облачным кабинетом.",
      jobs: [
        "Дай пол из исходников с понятным профилем образа empiieros-shell.",
        "Раздели системный EFI, корень и зашифрованное состояние; PIN включения не равен ключу тома.",
        "Оставь канал обновлений опциональным — политика «не обновлять» описана.",
      ],
      resonance: "Для инфраструктуры — факты сборки и сеть, не обещание реестра или СЗИ.",
    },
    {
      id: "ceo",
      role: "Собственник / закупка",
      audience: "Economic Buyer",
      pain: "Нужна честная позиция для реестра и договоров: продаж не было, номера записи нет, цена только по запросу после готовности поставки.",
      jobs: [
        "Не публиковать сумму без утверждённого прайса.",
        "Отделить EmpiierOS от EliteEW cloud и от Fedora-киоска в документах.",
        "Запросить порядок поставки через lady_boss@eliteew.ru.",
      ],
      resonance: "Для закупки — правообладатель ИП и 0 ₽ выручки, без оферты на странице.",
    },
    {
      id: "employee",
      role: "Пользователь кресла",
      audience: "End User",
      pain: "Нужно локальное графическое место на русском языке: Wayland, labwc, браузер кресла — без требования постоянного интернета для самого сеанса.",
      jobs: [
        "Работать в графическом сеансе после установки на диск.",
        "Подключать сеть по DHCP, статике или Wi‑Fi по решению организации.",
        "Не путать это приложение с телефонным клиентом или облачной вкладкой.",
      ],
      resonance: "Для пользователя — русская оболочка и локальное кресло, не мониторинг личного телефона.",
    },
  ] as const satisfies readonly JobRole[],
} as const;
