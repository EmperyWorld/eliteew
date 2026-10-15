/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public EmpiierOS pages copy. Additive to Safe Workspace, not a replacement.
 *
 * Invariants:
 * - No price amount, no registry number, no sales claim.
 * - Support hours and phone stay unpublished.
 */

export const empiierosPaths = {
  home: "/empiieros",
  description: "/empiieros/description",
  price: "/empiieros/price",
  docs: "/empiieros/docs",
  workspace: "/",
} as const;

export const empiierosMeta = {
  homeTitle: "EmpiierOS — операционная система",
  homeDescription:
    "Операционная система для компьютера x86_64. Русская оболочка, установка на диск. Не облачный кабинет. В реестр не включена. Цена по запросу.",
  descriptionTitle: "Описание EmpiierOS",
  descriptionDescription:
    "Назначение EmpiierOS: x86_64, Linux 6.12, русская оболочка. Записи в реестре нет.",
  priceTitle: "Цена EmpiierOS — по запросу",
  priceDescription:
    "Стоимость EmpiierOS определяется по запросу. Продаж не было. Сумма не опубликована.",
  docsTitle: "Документы EmpiierOS",
  docsDescription:
    "Установка, требования и поддержка EmpiierOS. Часы поддержки не опубликованы.",
} as const;

export const empiierosOwner = {
  name: "Кундухова Татьяна Александровна",
  status: "ИП",
  inn: "254007993190",
  ogrnip: "323253600062900",
  email: "lady_boss@eliteew.ru",
  phone: "не опубликован",
  hours: "не заданы",
} as const;

export const empiierosFacts = {
  arch: "x86_64",
  kernel: "Linux 6.12.20",
  buildroot: "Buildroot 2025.02.1",
  profile: "empiieros-shell",
  compositor: "labwc 0.8.3",
  imageSha256: "cf0b46e1b92e9efb3820dd5a9da456dd120ebab9fcf39f9f159c6511bb30247b",
  imageDate: "2026-09-22",
  registry: "записи нет",
  sales: "не было",
  revenue: "0 ₽",
  readiness: "приёмка на произвольном компьютере не закрыта",
} as const;

export const empiierosNav = [
  { href: empiierosPaths.home, label: "Обзор" },
  { href: empiierosPaths.description, label: "Описание" },
  { href: empiierosPaths.price, label: "Цена" },
  { href: empiierosPaths.docs, label: "Документы" },
] as const;

export const empiierosHome = {
  kicker: "Операционная система · x86_64",
  title: "EmpiierOS",
  lead: "Пол из исходников Linux и графическая оболочка на русском языке. Для рабочего компьютера, не для облачной вкладки.",
  forWhom:
    "Для организации, которой нужно локальное рабочее место: установка на диск, сеть, обновления по решению владельца контура.",
  includes: [
    "Linux 6.12.20 и Buildroot 2025.02.1, профиль empiieros-shell.",
    "Графический сеанс Wayland, композитор labwc 0.8.3.",
    "Установка на внутренний диск. Отдельный зашифрованный раздел состояния. PIN включения не является ключом этого раздела.",
    "Сеть: DHCP, статический адрес, Wi‑Fi.",
    "Канал обновлений и значение политики «не обновлять».",
  ],
  excludes: [
    "Не Safe Workspace и не облачный кабинет EliteEW.",
    "Не телефонное приложение.",
    "Не Fedora-киоск и не клиент Tauri.",
    "Не запись в реестре российского ПО. Номера нет.",
    "Не сертифицированное средство защиты информации.",
  ],
} as const;

export const empiierosDescription = {
  title: "Описание",
  lead: "EmpiierOS ставится на диск компьютера x86_64 и открывает графическое рабочее место. Язык оболочки по умолчанию — русский. Класс ориентира 02.09. Записи в реестре нет.",
  functions: [
    "Установка на внутренний диск: системный раздел EFI, корень, отдельный раздел состояния.",
    "PIN первого включения не равен ключу тома состояния.",
    "Сеть по DHCP, статическому адресу или Wi‑Fi. Лабораторная подсеть 192.168.8.10/30 в изделие не входит.",
    "Время при установке задаёт человек. Публичный NTP в установочном контуре выключен.",
    "Обновления можно не включать. Если канал включён, скрипты называют app.eliteew.ru. Где стоит сервер, не опубликовано.",
    "Браузер кресла и локальный щит. Сертификата средства защиты нет.",
  ],
  floor: "Пол собирается из исходников окружением Buildroot. Это не установка готового Fedora как единственной основы. Fedora-киоск в соседнем каталоге в этот образ не входит.",
} as const;

export const empiierosPrice = {
  title: "Цена",
  lead: "По запросу. Сумма не опубликована.",
  body: "Продаж права использования не было. Выручка от этой операционной системы — 0 ₽. Прайс уже совершённых продаж на странице не размещается.",
  offer: "Это не оферта и не счёт.",
  scopeGap: "Состав поставки и срок поддержки не утверждены.",
} as const;
