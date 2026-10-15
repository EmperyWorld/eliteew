"use strict";

const APP_URL = "https://app.eliteew.ru";
const ANDROID_APP_URL = "https://app.eliteew.ru/mobile-app/";
const LANGUAGE_STORAGE_KEY = "eliteew.landing.lang";
const DEFAULT_LANGUAGE = "ru";
const SUPPORTED_LANGUAGES = new Set(["ru", "en"]);
/** Old demo MP4 is outdated; hide section until the new video is ready. */
const VIDEO_SECTION_ENABLED = false;
const NAV_SECTIONS = VIDEO_SECTION_ENABLED
  ? ["journey", "video", "platform", "philosophy", "products", "roadmap", "faq"]
  : ["journey", "platform", "philosophy", "products", "roadmap", "faq"];

const filterVideoNavHighlights = (highlights) => {
  if (VIDEO_SECTION_ENABLED || !Array.isArray(highlights)) {
    return highlights ?? [];
  }
  return highlights.filter((item) => item.icon !== "video" && item.href !== "#video");
};

const navIconSvg = (section) => {
  const icons = {
    trust: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>`,
    journey: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>`,
    video: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
    platform: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
    philosophy: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>`,
    products: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`,
    roadmap: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>`,
    faq: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
    cta: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>`,
  };
  return icons[section] ?? icons.platform;
};

const renderNavIcon = (section, iconClass = "nav-link-icon") =>
  `<span class="nav-link-icon-wrap" aria-hidden="true"><svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${navIconSvg(section)}</svg></span>`;

const renderNavLink = (section, label, className = "nav-link text-gray-300 hover:text-white transition-colors font-medium") =>
  `<a href="#${section}" class="${className} nav-link-with-icon" data-nav-section="${section}" aria-label="${escapeHtml(label)}">${renderNavIcon(section)}<span class="nav-link-label">${escapeHtml(label)}</span></a>`;

const ewaSymbolMarkSvg = () =>
  `<svg class="philosophy-assistant-symbol-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 6 54 18v28L32 58 10 46V18Z" stroke="currentColor" stroke-width="2"></path><circle cx="32" cy="32" r="7" fill="currentColor" opacity="0.55"></circle><path d="M32 18v28M18 32h28" stroke="currentColor" stroke-width="1.5" opacity="0.28"></path></svg>`;

const amkaSymbolMarkSvg = () =>
  `<svg class="philosophy-assistant-symbol-svg" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="14" y="10" width="36" height="44" rx="4" stroke="currentColor" stroke-width="2"></rect><path d="M22 22h20M22 32h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"></path><path d="M38 40l5 5 11-13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

const renderAssistantSymbolMark = (key) => {
  if (key === "ewa") {
    return `<span class="philosophy-assistant-symbol" aria-hidden="true">${ewaSymbolMarkSvg()}</span>`;
  }
  if (key === "amka") {
    return `<span class="philosophy-assistant-symbol philosophy-assistant-symbol-amka" aria-hidden="true">${amkaSymbolMarkSvg()}</span>`;
  }
  return "";
};

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scrollProgress = document.getElementById("scroll-progress");
const scrollToTopBtn = document.getElementById("scroll-to-top");
const landingRoot = document.getElementById("landing-root");
const metaDescription = document.getElementById("meta-description");
const metaKeywords = document.getElementById("meta-keywords");

let currentLanguage = DEFAULT_LANGUAGE;
let pageContent = null;
let interactionAbort = null;
let videoHandlersAbort = null;
let revealObserver = null;
let landingBuildMeta = null;
let metricCounterObserver = null;
let languageSwitchAbort = null;

const setNavLinkCurrent = (link, isActive) => {
  if (isActive) {
    link.setAttribute("aria-current", "true");
  } else {
    link.removeAttribute("aria-current");
  }
};

const getActiveNavSection = () => {
  let activeSection = NAV_SECTIONS[0];
  for (const sectionId of NAV_SECTIONS) {
    const section = document.getElementById(sectionId);
    if (!section) {
      continue;
    }
    if (section.getBoundingClientRect().top <= 140) {
      activeSection = sectionId;
    }
  }
  return activeSection;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderVideoTracks = (tracks) => {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return "";
  }
  return tracks
    .map((track) => {
      const defaultAttr = track.default ? " default" : "";
      return `<track kind="captions" src="${escapeHtml(track.src)}" srclang="${escapeHtml(track.srclang)}" label="${escapeHtml(track.label)}"${defaultAttr}>`;
    })
    .join("\n                        ");
};

const resolveLanguage = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : DEFAULT_LANGUAGE;
};

const getInitialLanguage = () => {
  const urlLanguage = new URL(window.location.href).searchParams.get("lang");
  if (urlLanguage) {
    return resolveLanguage(urlLanguage);
  }
  try {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (storedLanguage) {
      return resolveLanguage(storedLanguage);
    }
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
  return navigator.language.toLowerCase().startsWith("en") ? "en" : DEFAULT_LANGUAGE;
};

const getHistoryState = () =>
  window.history.state && typeof window.history.state === "object" ? { ...window.history.state } : {};

const replaceHistoryUrl = (urlString, patchState = {}) => {
  window.history.replaceState({ ...getHistoryState(), ...patchState }, "", urlString);
};

const syncLanguageInUrl = (language, options = {}) => {
  const url = new URL(window.location.href);
  if (language === DEFAULT_LANGUAGE) {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", language);
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const historyMode = options.historyMode ?? "replace";
  if (historyMode === "push") {
    window.history.pushState({ landingLang: language }, "", nextUrl);
    return;
  }
  replaceHistoryUrl(nextUrl, { landingLang: language });
};

const statusClass = (status) => {
  if (status === "done") {
    return "bg-green-900/30 text-green-400";
  }
  if (status === "active") {
    return "bg-amber-900/30 text-amber-400";
  }
  return "bg-indigo-900/30 text-indigo-400";
};

const statusIconClass = (status) => {
  if (status === "done") {
    return "text-green-400";
  }
  if (status === "active") {
    return "text-amber-400";
  }
  return "text-indigo-400";
};

const labelToneClass = (tone) => {
  if (tone === "ready") {
    return "product-label product-label-ready";
  }
  if (tone === "evolving") {
    return "product-label product-label-evolving";
  }
  return "product-label product-label-brand";
};

const renderSectionHeader = (eyebrow, title, subtitle, options = {}) => {
  const compact = options.compact === true;
  const wrapClass = compact ? "text-center mb-8 reveal" : "text-center mb-10 md:mb-12 reveal";
  const titleClass = compact ? "text-3xl md:text-4xl" : "text-3xl md:text-5xl";
  const subtitleClass = compact ? "text-base md:text-lg" : "text-lg md:text-xl";
  return `
    <div class="${wrapClass}">
        ${eyebrow ? `<p class="section-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h2 class="${titleClass} font-black mb-4"><span class="gradient-text">${escapeHtml(title)}</span></h2>
        ${subtitle ? `<p class="${subtitleClass} text-gray-400 max-w-3xl mx-auto">${escapeHtml(subtitle)}</p>` : ""}
    </div>
  `;
};

const renderIdentityStrip = (brand, identity) => {
  if (!brand?.company || !brand?.project) {
    return "";
  }
  const companyLabel = identity?.companyLabel ?? "Company";
  const projectLabel = identity?.projectLabel ?? "Project";
  return `
    <div class="identity-strip animate-slide-up delay-01" role="note" aria-label="${escapeHtml(`${companyLabel} ${brand.company}, ${projectLabel} ${brand.project}`)}">
        <span class="identity-pill identity-pill-company">
            <span class="identity-pill-label">${escapeHtml(companyLabel)}</span>
            <span class="identity-pill-value">${escapeHtml(brand.company)}</span>
        </span>
        <span class="identity-pill identity-pill-project">
            <span class="identity-pill-label">${escapeHtml(projectLabel)}</span>
            <span class="identity-pill-value">${escapeHtml(brand.project)}</span>
            ${brand.projectExpansion?.trim() ? `<span class="identity-pill-meta">${escapeHtml(brand.projectExpansion)}</span>` : ""}
        </span>
    </div>
  `;
};

const productGroupIconSvg = (group) => {
  if (group === "projects") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>`;
  }
  if (group === "collab") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>`;
  }
  if (group === "clients") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>`;
};

const metricIconSvg = (index) => {
  const icons = [
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`,
  ];
  return icons[index] ?? icons[0];
};

const roadmapTopicIconSvg = (index) => {
  const icons = [
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>`,
  ];
  return icons[index] ?? icons[0];
};

const ctaPanelIconSvg = () =>
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`;

const videoHighlightIconSvg = (icon) => {
  if (icon === "ewa") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>`;
  }
  if (icon === "android") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`;
};

const trustSummaryIconSvg = (icon) => {
  if (icon === "inhouse") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>`;
  }
  if (icon === "assistants") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>`;
  }
  return videoHighlightIconSvg("desktop");
};

const resolveHighlightIconSvg = (icon, kind) => {
  if (kind === "ecosystem") {
    return productGroupIconSvg(icon);
  }
  if (kind === "trust") {
    return trustSummaryIconSvg(icon);
  }
  return videoHighlightIconSvg(icon);
};

const renderHighlightPills = (items, { listClass, itemClass, iconWrapClass, iconClass, kind, linkable = false }) => {
  if (!items?.length) {
    return "";
  }
  const pills = items
    .map((item) => {
      const inner = `
            <span class="${iconWrapClass}" aria-hidden="true">
                <svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${resolveHighlightIconSvg(item.icon, kind)}</svg>
            </span>
            <span>${escapeHtml(item.label)}</span>
      `;
      if (linkable && item.href) {
        return `<li><a href="${escapeHtml(item.href)}" class="${itemClass} ${itemClass}-link" data-ecosystem="${escapeHtml(item.icon ?? "")}" aria-label="${escapeHtml(item.label)}">${inner}</a></li>`;
      }
      return `<li class="${itemClass}">${inner}</li>`;
    })
    .join("");
  return `<ul class="${listClass} reveal">${pills}</ul>`;
};

const renderVideoHighlights = (highlights) =>
  renderHighlightPills(highlights, {
    listClass: "video-highlights",
    itemClass: "video-highlight-item",
    iconWrapClass: "video-highlight-icon-wrap",
    iconClass: "video-highlight-icon",
    kind: "video",
  });

const renderTrustSummary = (summary) =>
  renderHighlightPills(summary, {
    listClass: "trust-summary-strip",
    itemClass: "trust-summary-item",
    iconWrapClass: "trust-summary-icon-wrap",
    iconClass: "trust-summary-icon",
    kind: "trust",
  });

const renderPlatformEcosystem = (ecosystem) =>
  renderHighlightPills(ecosystem, {
    listClass: "platform-ecosystem-strip",
    itemClass: "platform-ecosystem-item",
    iconWrapClass: "platform-ecosystem-icon-wrap",
    iconClass: "platform-ecosystem-icon",
    kind: "ecosystem",
    linkable: true,
  });

const renderPlatformMetricsDivider = (label) => {
  if (!label?.trim()) {
    return "";
  }
  return `<div class="platform-metrics-divider reveal" role="separator"><span>${escapeHtml(label)}</span></div>`;
};

const renderGroupIconSvg = (groupId) =>
  `<svg class="product-group-inline-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${productGroupIconSvg(groupId)}</svg>`;

const syncSocialMeta = (content, language) => {
  const og = content.meta?.og ?? {};
  const baseUrl = "https://eliteew.ru/";
  const canonicalUrl = language === "en" ? `${baseUrl}?lang=en` : baseUrl;
  const setMeta = (id, value, attr = "content") => {
    if (!value) {
      return;
    }
    document.getElementById(id)?.setAttribute(attr, value);
  };
  setMeta("meta-og-title", content.meta.title);
  setMeta("meta-og-description", content.meta.description);
  setMeta("meta-og-site-name", og.siteName ?? content.brand.company);
  setMeta("meta-og-locale", language === "en" ? "en_US" : "ru_RU");
  setMeta("meta-og-locale-alt", language === "en" ? "ru_RU" : "en_US");
  setMeta("meta-og-url", canonicalUrl);
  const ogImagePath = og.image ?? "logo_empery.png";
  const ogImageUrl = ogImagePath.startsWith("http") ? ogImagePath : `${baseUrl}${ogImagePath.replace(/^\//, "")}`;
  setMeta("meta-og-image", ogImageUrl);
  if (ogImageUrl.startsWith("https://")) {
    setMeta("meta-og-image-secure", ogImageUrl);
  }
  if (og.imageWidth) {
    setMeta("meta-og-image-width", String(og.imageWidth));
  }
  if (og.imageHeight) {
    setMeta("meta-og-image-height", String(og.imageHeight));
  }
  if (og.imageAlt) {
    setMeta("meta-og-image-alt", og.imageAlt);
    setMeta("meta-twitter-image-alt", og.imageAlt);
  }
  setMeta("meta-twitter-title", content.meta.title);
  setMeta("meta-twitter-description", content.meta.description);
  setMeta("meta-twitter-image", ogImageUrl);
  setMeta("link-canonical", canonicalUrl, "href");
  setMeta("link-hreflang-ru", baseUrl, "href");
  setMeta("link-hreflang-en", `${baseUrl}?lang=en`, "href");
  setMeta("link-hreflang-x", baseUrl, "href");
  if (landingBuildMeta?.buildTime) {
    setMeta("meta-modified", landingBuildMeta.buildTime);
  }
  const preloadId = "link-og-image-preload";
  document.getElementById(preloadId)?.remove();
  if (ogImagePath && !ogImagePath.startsWith("http")) {
    const preloadLink = document.createElement("link");
    preloadLink.id = preloadId;
    preloadLink.rel = "preload";
    preloadLink.as = "image";
    preloadLink.type = "image/png";
    preloadLink.href = ogImagePath.replace(/^\//, "");
    document.head.appendChild(preloadLink);
  }
  syncOgVideoMeta(content, baseUrl);
};

const syncOgVideoMeta = (content, baseUrl = "https://eliteew.ru/") => {
  document.getElementById("meta-og-video")?.remove();
  document.getElementById("meta-og-video-type")?.remove();
  document.getElementById("meta-og-video-secure")?.remove();
  if (!VIDEO_SECTION_ENABLED) {
    return;
  }
  const videoSrc = content.video?.src;
  if (!videoSrc || String(videoSrc).startsWith("http")) {
    return;
  }
  const videoUrl = `${baseUrl}${String(videoSrc).replace(/^\//, "")}`;
  const appendMeta = (id, property, value) => {
    const meta = document.createElement("meta");
    meta.id = id;
    meta.setAttribute("property", property);
    meta.content = value;
    document.head.appendChild(meta);
  };
  appendMeta("meta-og-video", "og:video", videoUrl);
  appendMeta("meta-og-video-type", "og:video:type", "video/mp4");
  if (videoUrl.startsWith("https://")) {
    appendMeta("meta-og-video-secure", "og:video:secure_url", videoUrl);
  }
};

const syncReduceMotionDataset = () => {
  if (prefersReducedMotion()) {
    document.documentElement.dataset.reduceMotion = "true";
  } else {
    delete document.documentElement.dataset.reduceMotion;
  }
};

const injectStructuredData = (content, language) => {
  document.getElementById("landing-jsonld")?.remove();
  const baseUrl = "https://eliteew.ru/";
  const pageUrl = language === "en" ? `${baseUrl}?lang=en` : baseUrl;
  const featureList = (content.products?.items ?? [])
    .map((item) => item.name ?? item.title)
    .filter(Boolean)
    .slice(0, 12);
  const ogImagePath = content.meta?.og?.image ?? "logo_empery.png";
  const logoUrl = `${baseUrl}${ogImagePath.replace(/^\//, "")}`;
  const orgId = `${baseUrl}#organization`;
  const websiteId = `${baseUrl}#website`;
  const webpageId = `${pageUrl}#webpage`;
  const softwareId = `${baseUrl}#software`;
  const softwareApplication = {
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: content.brand.project,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, VR, AR",
    description: content.meta.description,
    image: logoUrl,
    author: { "@id": orgId },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  if (content.brand.projectExpansion?.trim()) {
    softwareApplication.alternateName = content.brand.projectExpansion.trim();
  }
  if (featureList.length > 0) {
    softwareApplication.featureList = featureList;
  }
  softwareApplication.url = APP_URL;
  const webPage = {
    "@type": "WebPage",
    "@id": webpageId,
    name: content.meta.title,
    description: content.meta.description,
    url: pageUrl,
    inLanguage: language === "en" ? "en-US" : "ru-RU",
    isPartOf: { "@id": websiteId },
    about: { "@id": softwareId },
    mainEntity: { "@id": softwareId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: logoUrl,
      ...(content.meta?.og?.imageWidth ? { width: content.meta.og.imageWidth } : {}),
      ...(content.meta?.og?.imageHeight ? { height: content.meta.og.imageHeight } : {}),
    },
  };
  if (landingBuildMeta?.buildTime) {
    webPage.dateModified = landingBuildMeta.buildTime;
  }
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: content.brand.company,
        url: baseUrl,
        description: content.meta.description,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
          ...(content.meta?.og?.imageWidth ? { width: content.meta.og.imageWidth } : {}),
          ...(content.meta?.og?.imageHeight ? { height: content.meta.og.imageHeight } : {}),
        },
        ...(content.meta?.contactEmail
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                email: content.meta.contactEmail,
                contactType: "customer support",
                availableLanguage: ["Russian", "English"],
              },
            }
          : {}),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: content.brand.company,
        url: baseUrl,
        inLanguage: ["ru-RU", "en-US"],
        publisher: { "@id": orgId },
        potentialAction: {
          "@type": "ViewAction",
          name: content.nav?.cta ?? content.brand.project,
          target: APP_URL,
        },
      },
      webPage,
      softwareApplication,
    ],
  };
  const productItems = content.products?.items ?? [];
  if (productItems.length > 0 && content.products?.title) {
    payload["@graph"].push({
      "@type": "ItemList",
      "@id": `${pageUrl}#products`,
      name: content.products.title,
      isPartOf: { "@id": webpageId },
      itemListElement: productItems.slice(0, 24).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name ?? item.title,
        url: `${pageUrl}#products-${item.group ?? "core"}`,
      })),
    });
  }
  if (content.faq?.items?.length) {
    const faqPageId = `${pageUrl}#faq`;
    payload["@graph"].push({
      "@type": "FAQPage",
      "@id": faqPageId,
      isPartOf: { "@id": webpageId },
      mainEntity: content.faq.items.map((item, index) => ({
        "@type": "Question",
        "@id": `${pageUrl}#faq-item-${index}`,
        name: item.q,
        url: `${pageUrl}#faq-item-${index}`,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }
  const videoSrc = VIDEO_SECTION_ENABLED ? content.video?.src : null;
  if (videoSrc) {
    const videoObject = {
      "@type": "VideoObject",
      "@id": `${pageUrl}#video`,
      name: content.video.title,
      description: content.video.subtitle ?? content.meta.description,
      thumbnailUrl: `${baseUrl}${content.video.poster ?? "logo_empery.png"}`,
      contentUrl: `${baseUrl}${videoSrc}`,
      uploadDate: content.video.uploadDate ?? "2025-10-01",
      inLanguage: language === "en" ? "en-US" : "ru-RU",
    };
    if (content.video.durationSeconds) {
      videoObject.duration = `PT${content.video.durationSeconds}S`;
    }
    videoObject.isPartOf = { "@id": webpageId };
    payload["@graph"].push(videoObject);
  }
  payload["@graph"].push({
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    isPartOf: { "@id": webpageId },
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: content.brand.company,
        item: baseUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: content.brand.project,
        item: pageUrl,
      },
    ],
  });
  const script = document.createElement("script");
  script.id = "landing-jsonld";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(payload);
  document.head.appendChild(script);
};

const normalizeChip = (chip) => {
  if (typeof chip === "string") {
    return { label: chip, href: "#products" };
  }
  return { label: chip.label, href: chip.href ?? "#products" };
};

const renderAppLink = (text, className, externalHint) => {
  const ariaLabel = externalHint ? `${text} — ${externalHint}` : text;
  return `<a href="${APP_URL}" rel="noopener noreferrer" class="app-external-link ${className}" title="${escapeHtml(externalHint ?? "")}" aria-label="${escapeHtml(ariaLabel)}"><span>${escapeHtml(text)}</span><svg class="app-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>`;
};

const renderAndroidAppLink = (text, className, externalHint) => {
  const ariaLabel = externalHint ? `${text} — ${externalHint}` : text;
  return `<a href="${ANDROID_APP_URL}" rel="noopener noreferrer" class="app-external-link android-app-link ${className}" title="${escapeHtml(externalHint ?? "")}" aria-label="${escapeHtml(ariaLabel)}"><span>${escapeHtml(text)}</span><svg class="app-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></a>`;
};

const heroCtaIconSvg = (type) => {
  if (type === "demo") {
    return `<svg class="hero-cta-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  }
  if (type === "programs") {
    return `<svg class="hero-cta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>`;
  }
  if (type === "android") {
    return `<svg class="hero-cta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`;
  }
  return "";
};

const renderHeroHashCta = (href, text, className, sectionNavPrefix, iconType) => {
  const ariaLabel = sectionNavPrefix ? `${sectionNavPrefix} ${text}` : text;
  const icon = heroCtaIconSvg(iconType);
  return `<a href="${escapeHtml(href)}" class="hero-cta-link ${className}" aria-label="${escapeHtml(ariaLabel)}">${icon}<span>${escapeHtml(text)}</span></a>`;
};

const heroStatIconSvg = (icon) => {
  if (icon === "ewa") {
    return videoHighlightIconSvg("ewa");
  }
  if (icon === "platforms") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`;
};

const renderHeroStats = (stats) => {
  if (!stats?.length) {
    return "";
  }
  const items = stats
    .map((item) => {
      const inner = `
            <span class="hero-stat-icon-wrap" aria-hidden="true">
                <svg class="hero-stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${heroStatIconSvg(item.icon)}</svg>
            </span>
            <span class="hero-stat-copy">
                <span class="hero-stat-value">${escapeHtml(item.value)}</span>
                <span class="hero-stat-label">${escapeHtml(item.label)}</span>
            </span>
      `;
      if (item.href) {
        return `<li><a href="${escapeHtml(item.href)}" class="hero-stat-item hero-stat-link" aria-label="${escapeHtml(`${item.value} ${item.label}`)}">${inner}</a></li>`;
      }
      return `<li class="hero-stat-item">${inner}</li>`;
    })
    .join("");
  return `<ul class="hero-stats reveal delay-03">${items}</ul>`;
};

const footerHighlightIconSvg = (icon) => {
  if (icon === "app") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>`;
  }
  if (icon === "video") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
  }
  if (icon === "android") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>`;
};

const renderFooterHighlights = (highlights, externalHint) => {
  if (!highlights?.length) {
    return "";
  }
  const items = highlights
    .map((item) => {
      const inner = `
            <span class="footer-highlight-icon-wrap" aria-hidden="true">
                <svg class="footer-highlight-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${footerHighlightIconSvg(item.icon)}</svg>
            </span>
            <span>${escapeHtml(item.label)}</span>
      `;
      if (item.type === "app") {
        const ariaLabel = externalHint ? `${item.label} — ${externalHint}` : item.label;
        return `<li><a href="${APP_URL}" rel="noopener noreferrer" class="footer-highlight-item footer-highlight-link app-external-link" aria-label="${escapeHtml(ariaLabel)}">${inner}</a></li>`;
      }
      if (item.type === "android") {
        const androidHint = item.externalHint ?? externalHint;
        const ariaLabel = androidHint ? `${item.label} — ${androidHint}` : item.label;
        return `<li><a href="${ANDROID_APP_URL}" rel="noopener noreferrer" class="footer-highlight-item footer-highlight-link app-external-link android-app-link" aria-label="${escapeHtml(ariaLabel)}">${inner}</a></li>`;
      }
      if (item.href) {
        return `<li><a href="${escapeHtml(item.href)}" class="footer-highlight-item footer-highlight-link" aria-label="${escapeHtml(item.label)}">${inner}</a></li>`;
      }
      return `<li class="footer-highlight-item">${inner}</li>`;
    })
    .join("");
  return `<ul class="footer-highlights">${items}</ul>`;
};

const renderFooterBrand = (brand) => {
  if (!brand?.company) {
    return "";
  }
  return `
    <div class="footer-brand">
        <img src="logo_empery.png" width="52" height="52" alt="" class="footer-logo" decoding="async">
        <div class="footer-brand-copy">
            <div class="footer-brand-title gradient-gold">${escapeHtml(brand.company)}</div>
            <span class="footer-project-pill">${escapeHtml(brand.project ?? "EliteEW")}</span>
            <p class="footer-brand-line">${escapeHtml(brand.footerLine ?? "")}</p>
        </div>
    </div>
  `;
};

const renderLangSwitcher = (lang, label) => `
    <div class="lang-switcher" role="group" aria-label="${escapeHtml(label ?? (lang === "en" ? "Language switcher" : "Переключение языка"))}">
        <button type="button" class="lang-toggle${lang === "ru" ? " active" : ""}" data-lang="ru" lang="ru" aria-pressed="${lang === "ru" ? "true" : "false"}">RU</button>
        <button type="button" class="lang-toggle${lang === "en" ? " active" : ""}" data-lang="en" lang="en" aria-pressed="${lang === "en" ? "true" : "false"}">EN</button>
    </div>
`;

const platformIconSvg = (key) => {
  if (key === "android") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;
  }
  if (key === "vr") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`;
};

const renderPlatformsStrip = (platforms) => {
  if (!platforms?.length) {
    return "";
  }
  const pills = platforms
    .map((platform) => {
      const inner = `
            <svg class="platform-pill-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">${platformIconSvg(platform.key)}</svg>
            <span>${escapeHtml(platform.label)}</span>
      `;
      if (platform.href) {
        const externalAttrs = /^https?:\/\//i.test(platform.href) ? ' rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(platform.href)}"${externalAttrs} class="platform-pill platform-pill-link" data-platform="${escapeHtml(platform.key ?? "")}" aria-label="${escapeHtml(platform.label)}">${inner}</a>`;
      }
      return `<span class="platform-pill" data-platform="${escapeHtml(platform.key ?? "")}">${inner}</span>`;
    })
    .join("");
  return `<div class="platforms-strip reveal delay-05">${pills}</div>`;
};

const renderRoadmapStatusIcon = (status) => {
  if (status === "active") {
    return `<svg class="w-8 h-8 ${statusIconClass(status)}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }
  if (status === "planned") {
    return `<svg class="w-8 h-8 ${statusIconClass(status)}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>`;
  }
  return `<svg class="w-8 h-8 ${statusIconClass(status)}" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
};

const trustIconSvg = (index) => {
  const icons = [
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM15 7h4a1 1 0 011 1v10a1 1 0 01-1 1h-4"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>`,
  ];
  return icons[index] ?? icons[0];
};

const journeyIconSvg = (index) => {
  const icons = [
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path>`,
    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>`,
  ];
  return icons[index] ?? icons[0];
};

const pillarIconSvg = (key) => {
  if (key === "empery") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>`;
  }
  if (key === "world") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
  }
  if (key === "awakening") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>`;
  }
  return `<circle cx="12" cy="12" r="4" stroke-width="2"></circle>`;
};

const assistantIconSvg = (name) => {
  if (name === "EWA") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>`;
  }
  if (name === "АМКА" || name === "AMKA") {
    return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>`;
  }
  return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>`;
};

const renderJourneySection = (journey, ui) => {
  if (!journey?.steps?.length) {
    return "";
  }
  const total = journey.steps.length;
  const steps = journey.steps
    .map((step, index) => {
      const delayClass = index > 0 ? ` delay-0${Math.min(index + 1, 5)}` : "";
      const inner = `
            <div class="journey-step-top">
                <span class="journey-step-icon-wrap" aria-hidden="true">
                    <svg class="journey-step-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${journeyIconSvg(index)}</svg>
                </span>
                <span class="journey-step-num" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            </div>
            <div>
                <h3 class="journey-step-title">${escapeHtml(step.title)}</h3>
                <p class="journey-step-text">${escapeHtml(step.text)}</p>
            </div>
      `;
      if (step.href) {
        return `
        <li class="journey-step-item reveal${delayClass}">
            <a href="${escapeHtml(step.href)}" class="journey-step journey-step-link" data-journey-index="${index}">${inner}</a>
        </li>
      `;
      }
      return `<li class="journey-step reveal${delayClass}" data-journey-index="${index}">${inner}</li>`;
    })
    .join("");
  const progressLabel = ui?.journeyProgress ?? "";
  const journeyProgress = `
    <div class="journey-progress reveal" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="1" aria-label="${escapeHtml(progressLabel)}" data-journey-progress>
        <div class="journey-progress-track">
            <div class="journey-progress-fill" style="width: ${Math.round((1 / total) * 100)}%"></div>
        </div>
        <p class="journey-progress-label" data-journey-progress-label>${escapeHtml(progressLabel ? `${progressLabel} · 1/${total}` : `1/${total}`)}</p>
    </div>
  `;
  return `
    <section id="journey" class="py-12 md:py-16 px-6 border-b border-white/10 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-5xl">
            ${renderSectionHeader(journey.eyebrow, journey.title, journey.subtitle)}
            ${journeyProgress}
            <ol class="journey-track reveal">${steps}</ol>
        </div>
    </section>
  `;
};

const renderRoadmapSummary = (phases, legend) => {
  const counts = { done: 0, active: 0, planned: 0 };
  for (const phase of phases ?? []) {
    if (counts[phase.status] !== undefined) {
      counts[phase.status] += 1;
    }
  }
  return `
    <div class="roadmap-summary reveal">
        <span class="roadmap-summary-item"><span class="roadmap-legend-dot roadmap-legend-dot-done"></span>${escapeHtml(legend.done)} · ${counts.done}</span>
        <span class="roadmap-summary-item"><span class="roadmap-legend-dot roadmap-legend-dot-active"></span>${escapeHtml(legend.active)} · ${counts.active}</span>
        <span class="roadmap-summary-item"><span class="roadmap-legend-dot roadmap-legend-dot-planned"></span>${escapeHtml(legend.planned)} · ${counts.planned}</span>
    </div>
  `;
};

const renderRoadmapProgress = (phases, ui) => {
  const total = phases?.length ?? 0;
  if (total === 0) {
    return "";
  }
  const done = phases.filter((phase) => phase.status === "done").length;
  const percent = Math.round((done / total) * 100);
  return `
    <div class="roadmap-progress reveal" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="${escapeHtml(ui?.roadmapProgress ?? "Progress")}">
        <div class="roadmap-progress-track">
            <div class="roadmap-progress-fill" style="width: ${percent}%"></div>
        </div>
        <p class="roadmap-progress-label">${escapeHtml(ui?.roadmapProgress ?? "")} · ${percent}%</p>
    </div>
  `;
};

const getOutlineLabel = (sectionId, content) => {
  if (sectionId === "trust") {
    return content.trust?.title ?? sectionId;
  }
  if (sectionId === "journey") {
    return content.journey?.title ?? sectionId;
  }
  if (sectionId === "video") {
    return content.video?.title ?? sectionId;
  }
  if (sectionId === "faq") {
    return content.faq?.title ?? sectionId;
  }
  if (sectionId === "cta") {
    return content.cta?.title ?? sectionId;
  }
  return content.nav?.[sectionId] ?? sectionId;
};

const getFaqHashLabel = () => {
  const faqMatch = window.location.hash.match(/^#faq-item-(\d+)$/);
  if (!faqMatch || !pageContent?.faq?.items) {
    return null;
  }
  return pageContent.faq.items[Number(faqMatch[1])]?.q ?? null;
};

const getFaqHashAnswer = () => {
  const faqMatch = window.location.hash.match(/^#faq-item-(\d+)$/);
  if (!faqMatch || !pageContent?.faq?.items) {
    return null;
  }
  return pageContent.faq.items[Number(faqMatch[1])]?.a ?? null;
};

const truncateMetaDescription = (text, maxLength = 160) => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}…`;
};

const syncHashDocumentMeta = () => {
  if (!pageContent) {
    return;
  }
  const faqLabel = getFaqHashLabel();
  const faqAnswer = getFaqHashAnswer();
  const pageTitle = faqLabel
    ? `${faqLabel} · ${pageContent.faq?.title ?? "FAQ"}`
    : pageContent.meta.title;
  const pageDescription = faqAnswer
    ? truncateMetaDescription(faqAnswer)
    : pageContent.meta.description;
  document.title = pageTitle;
  metaDescription?.setAttribute("content", pageDescription);
  const ogTitle = faqLabel ? pageTitle : pageContent.meta.title;
  const ogDescription = faqAnswer ? pageDescription : pageContent.meta.description;
  document.getElementById("meta-og-title")?.setAttribute("content", ogTitle);
  document.getElementById("meta-og-description")?.setAttribute("content", ogDescription);
  document.getElementById("meta-twitter-title")?.setAttribute("content", ogTitle);
  document.getElementById("meta-twitter-description")?.setAttribute("content", ogDescription);
  const shareUrl = new URL(window.location.href);
  if (!faqLabel) {
    shareUrl.hash = "";
  }
  document.getElementById("meta-og-url")?.setAttribute("content", shareUrl.toString());
  document.getElementById("link-canonical")?.setAttribute("href", getCanonicalPageUrl());
};

const clearPageHash = () => {
  if (!window.location.hash) {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = "";
  replaceHistoryUrl(`${url.pathname}${url.search}`);
  syncHashDocumentMeta();
};

const restorePageFromBfcache = () => {
  if (!pageContent) {
    return;
  }
  const urlLanguage = getInitialLanguage();
  if (urlLanguage !== currentLanguage) {
    void applyLanguage(urlLanguage, { historyMode: "replace" });
    return;
  }
  syncHashDocumentMeta();
  scrollToHashTarget();
  updateScrollProgress();
  toggleHeaderState();
  toggleScrollToTop();
  toggleMobileCtaBar();
  toggleHeroScrollHint();
  updateActiveNav();
  updateProductJumpNav();
  updateJourneyActiveStep();
};

const resolveSectionIdFromHash = (hash) => {
  if (!hash || hash === "#") {
    return null;
  }
  const faqMatch = hash.match(/^#faq-item-(\d+)$/);
  if (faqMatch) {
    return "faq";
  }
  return hash.replace(/^#/, "");
};

const announceSectionNavigation = (sectionId) => {
  const announcer = document.getElementById("lang-announcer");
  const prefix = pageContent?.ui?.sectionNavPrefix;
  if (!announcer || !prefix || !sectionId || !pageContent) {
    return;
  }
  const label = pageContent.nav?.[sectionId] ?? getOutlineLabel(sectionId, pageContent);
  announcer.textContent = `${prefix} ${label}`;
};

const renderFaqSection = (faq, ui, language) => {
  if (!faq?.items?.length) {
    return "";
  }
  const copyLabel = ui?.faqCopyLink ?? "Copy link";
  const faqCountLabel =
    language === "en" ? `${faq.items.length} questions` : `${faq.items.length} вопросов`;
  const items = faq.items
    .map(
      (item, index) => `
        <details id="faq-item-${index}" class="faq-item faq-item-anchor reveal${index > 0 ? ` delay-0${Math.min(index + 1, 4)}` : ""}">
            <summary class="faq-question">
                <span class="faq-num" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
                <span class="faq-question-text">${escapeHtml(item.q)}</span>
                <span class="faq-toggle-icon" aria-hidden="true"></span>
            </summary>
            <div class="faq-answer-wrap">
                <p class="faq-answer">${escapeHtml(item.a)}</p>
                <button type="button" class="faq-copy-link copy-link-btn" data-faq-index="${index}" aria-label="${escapeHtml(copyLabel)}">${escapeHtml(copyLabel)}</button>
            </div>
        </details>
      `,
    )
    .join("");
  return `
    <section id="faq" class="py-20 md:py-24 px-6 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-3xl">
            ${renderSectionHeader(faq.eyebrow, faq.title, faq.subtitle, { compact: true })}
            <p class="faq-count reveal">${escapeHtml(faqCountLabel)}</p>
            <div class="faq-list" role="group" aria-label="${escapeHtml(faq.title)}">${items}</div>
        </div>
    </section>
  `;
};

const renderTrustCard = (item, index) => {
  const delayClass = index > 0 ? ` delay-0${Math.min(index + 1, 4)}` : "";
  const trustIndexAttr = ` data-trust-index="${index}"`;
  const inner = `
            <div class="trust-icon-wrap" aria-hidden="true">
                <svg class="w-6 h-6 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">${trustIconSvg(index)}</svg>
            </div>
            <h3 class="text-lg font-bold mb-2 gradient-text">${escapeHtml(item.title)}</h3>
            <p class="text-gray-400 text-sm leading-relaxed">${escapeHtml(item.text)}</p>
  `;
  if (item.href) {
    return `
        <a href="${escapeHtml(item.href)}" class="glass-hover trust-card trust-card-link rounded-2xl p-6 text-center md:text-left h-full reveal block${delayClass}"${trustIndexAttr} aria-label="${escapeHtml(item.title)}">
            ${inner}
        </a>
      `;
  }
  return `
        <div class="glass-hover trust-card rounded-2xl p-6 text-center md:text-left h-full reveal${delayClass}"${trustIndexAttr}>
            ${inner}
        </div>
      `;
};

const renderSectionHashLink = (href, text, className, sectionNavPrefix) => {
  const ariaLabel = sectionNavPrefix ? `${sectionNavPrefix} ${text}` : text;
  return `<a href="${escapeHtml(href)}" class="${className}" aria-label="${escapeHtml(ariaLabel)}">${escapeHtml(text)}</a>`;
};

const renderNavLinks = (nav, lang, externalHint, langSwitcherLabel, variant = "desktop") => {
  const linksClass = variant === "mobile" ? "header-nav-links mobile-nav-links" : "header-nav-links";
  const ctaClass =
    variant === "mobile"
      ? "header-nav-cta mobile-nav-cta app-external-link w-full justify-center px-6 py-3 bg-gradient-to-r from-primary-600 to-pink-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/50 transition-all"
      : "header-nav-cta app-external-link px-4 py-2 bg-gradient-to-r from-primary-600 to-pink-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/50 transition-shadow shrink-0";
  return `
    <div class="${linksClass}">
    ${NAV_SECTIONS.map((section) => renderNavLink(section, nav[section])).join("")}
    </div>
    <div class="${variant === "mobile" ? "mobile-nav-actions" : "header-nav-actions"}">
    ${renderLangSwitcher(lang, langSwitcherLabel)}
    ${renderAppLink(nav.cta, ctaClass, externalHint)}
    </div>
  `;
};

const renderProductCard = (item, index, readyRibbon) => {
  const delayClass = index > 0 ? ` delay-${String(Math.min(index % 12, 11)).padStart(2, "0")}` : "";
  const readyClass = item.labelTone === "ready" ? " feature-card-ready" : "";
  const rawHref = item.link === false ? null : (item.href ?? `#products-${item.group ?? "core"}`);
  const isExternalHref = rawHref != null && /^https?:\/\//i.test(rawHref);
  const cardHref = rawHref == null ? null : escapeHtml(rawHref);
  const externalLinkAttrs = isExternalHref ? ' rel="noopener noreferrer"' : "";
  const readyRibbonHtml =
    item.labelTone === "ready" && readyRibbon
      ? `<span class="feature-ready-ribbon">${escapeHtml(readyRibbon)}</span>`
      : "";
  const tags = item.tags
    .map(
      (tag) =>
        `<span class="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-lg text-xs font-medium">${escapeHtml(tag)}</span>`,
    )
    .join("");
  const inner = `
        ${readyRibbonHtml}
        <div class="flex items-start gap-4 mb-4">
            <div class="product-icon-wrap shrink-0" data-group="${escapeHtml(item.group ?? "core")}">
                <svg class="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    ${productGroupIconSvg(item.group)}
                </svg>
            </div>
            <div class="min-w-0">
                <h3 class="text-xl md:text-2xl font-bold mb-2 leading-snug">${escapeHtml(item.name)}</h3>
                <span class="${labelToneClass(item.labelTone)}">${escapeHtml(item.label)}</span>
            </div>
        </div>
        <p class="text-gray-300 mb-4 leading-relaxed text-sm md:text-base">${escapeHtml(item.description)}</p>
        <div class="flex flex-wrap gap-2">${tags}</div>
  `;
  if (cardHref) {
    return `
    <a href="${cardHref}"${externalLinkAttrs} class="feature-card feature-card-link glass-hover gradient-border rounded-2xl p-8 reveal block h-full${delayClass}${readyClass}" data-product-group="${escapeHtml(item.group ?? "core")}" aria-label="${escapeHtml(item.name)}">
        ${inner}
    </a>
  `;
  }
  return `
    <article class="feature-card glass-hover gradient-border rounded-2xl p-8 reveal${delayClass}${readyClass}" data-product-group="${escapeHtml(item.group ?? "core")}">
        ${inner}
    </article>
  `;
};

const renderProductSection = (products, jumpLabel, groupItemsSuffix, groupHighlights, readyRibbon) => {
  const groupOrder = products.groupOrder ?? [];
  const groupTitles = products.groupTitles ?? {};
  const groupIntros = products.groupIntros ?? {};
  const itemsByGroup = new Map();

  for (const item of products.items ?? []) {
    const groupId = item.group ?? "other";
    if (!itemsByGroup.has(groupId)) {
      itemsByGroup.set(groupId, []);
    }
    itemsByGroup.get(groupId).push(item);
  }

  const activeGroups = groupOrder.filter((groupId) => (itemsByGroup.get(groupId)?.length ?? 0) > 0);
  const jumpLinks = activeGroups
    .map(
      (groupId) =>
        `<a href="#products-${groupId}" class="product-jump-link" data-product-group="${groupId}"><span class="product-jump-icon-wrap" aria-hidden="true">${renderGroupIconSvg(groupId)}</span><span>${escapeHtml(groupTitles[groupId] ?? groupId)}</span></a>`,
    )
    .join("");

  let cardIndex = 0;
  const groupsHtml = activeGroups
    .map((groupId) => {
      const items = itemsByGroup.get(groupId) ?? [];
      const cards = items
        .map((item) => {
          const html = renderProductCard(item, cardIndex, readyRibbon);
          cardIndex += 1;
          return html;
        })
        .join("");
      const intro = groupIntros[groupId];
      const highlight = groupHighlights?.[groupId];
      const countLabel =
        groupItemsSuffix && items.length > 0
          ? `<span class="product-group-count">${items.length} ${escapeHtml(groupItemsSuffix)}</span>`
          : "";
      return `
        <div id="products-${groupId}" class="product-group reveal scroll-mt-32" data-group="${groupId}">
            <h3 class="product-group-title" data-group="${groupId}">
                <span class="product-group-title-main">
                    <span class="product-group-title-icon-wrap" aria-hidden="true">${renderGroupIconSvg(groupId)}</span>
                    <span>${escapeHtml(groupTitles[groupId] ?? groupId)}</span>
                </span>
                ${countLabel}
            </h3>
            ${intro ? `<p class="product-group-intro">${escapeHtml(intro)}</p>` : ""}
            ${highlight ? `<p class="product-group-highlight reveal" data-group="${groupId}">${escapeHtml(highlight)}</p>` : ""}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cards}</div>
        </div>
      `;
    })
    .join("");

  const jumpNavHtml =
    jumpLinks && jumpLabel
      ? `
        <nav class="product-jump-nav reveal" aria-label="${escapeHtml(jumpLabel)}">
            ${jumpLinks}
        </nav>
      `
      : "";

  return { jumpNavHtml, groupsHtml };
};

const renderRoadmapLegend = (legend) => `
    <div class="roadmap-legend reveal">
        <span class="roadmap-legend-item"><span class="roadmap-legend-dot roadmap-legend-dot-done"></span>${escapeHtml(legend.done)}</span>
        <span class="roadmap-legend-item"><span class="roadmap-legend-dot roadmap-legend-dot-active"></span>${escapeHtml(legend.active)}</span>
        <span class="roadmap-legend-item"><span class="roadmap-legend-dot roadmap-legend-dot-planned"></span>${escapeHtml(legend.planned)}</span>
    </div>
`;

const renderRoadmapItem = (phase, index, legend) => {
  const delayClass = index > 0 ? ` delay-${String(Math.min(index, 9)).padStart(2, "0")}` : "";
  const sideClass = index % 2 === 0 ? "roadmap-card-side-left" : "roadmap-card-side-right";
  const statusLabel = legend[phase.status] ?? phase.status;
  const cardInner = `
                <div class="roadmap-card-head">
                    <span class="roadmap-phase-icon-wrap" aria-hidden="true">
                        <svg class="roadmap-phase-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${roadmapTopicIconSvg(index)}</svg>
                    </span>
                    <div class="roadmap-card-meta">
                        <div class="flex flex-wrap items-center gap-3 mb-1">
                            <span class="roadmap-phase-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
                            <span class="px-3 py-1 ${statusClass(phase.status)} rounded-lg text-sm font-semibold">${escapeHtml(statusLabel)}</span>
                            <span class="text-gray-400 font-medium">${escapeHtml(phase.period)}</span>
                        </div>
                        <h3 class="text-xl md:text-2xl font-bold mb-2">${escapeHtml(phase.title)}</h3>
                    </div>
                </div>
                <p class="text-gray-300 text-sm md:text-base">${escapeHtml(phase.description)}</p>
  `;
  const cardClass = phase.href ? "roadmap-card roadmap-card-link" : "roadmap-card";

  return `
    <div class="relative reveal${delayClass}">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6 roadmap-phase-row">
            <div class="w-16 h-16 glass-hover rounded-full flex items-center justify-center shrink-0 relative z-10 -ml-8 md:ml-0 md:absolute md:left-1/2 md:-translate-x-1/2 roadmap-status-icon-wrap" data-status="${escapeHtml(phase.status)}">
                ${renderRoadmapStatusIcon(phase.status)}
            </div>
            ${
              phase.href
                ? `<a href="${escapeHtml(phase.href)}" class="glass-hover rounded-2xl p-6 ${sideClass} ${cardClass}" aria-label="${escapeHtml(phase.title)}">${cardInner}</a>`
                : `<div class="glass-hover rounded-2xl p-6 ${sideClass} ${cardClass}">${cardInner}</div>`
            }
        </div>
    </div>
  `;
};

const renderPhilosophySection = (philosophy, sectionEyebrow) => {
  if (!philosophy) {
    return "";
  }

  const paragraphs = (philosophy.paragraphs ?? [])
    .map((paragraph) => `<p class="text-gray-300 leading-relaxed text-base md:text-lg">${escapeHtml(paragraph)}</p>`)
    .join("");

  const pillars = (philosophy.pillars ?? [])
    .map(
      (pillar, index) => `
        <article class="philosophy-pillar glass-hover rounded-2xl p-6 h-full reveal${index > 0 ? ` delay-0${Math.min(index + 1, 3)}` : ""}"${pillar.key ? ` data-pillar="${escapeHtml(pillar.key)}"` : ""}>
            <div class="philosophy-pillar-head">
                <span class="philosophy-pillar-icon-wrap" aria-hidden="true">
                    <svg class="philosophy-pillar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${pillarIconSvg(pillar.key)}</svg>
                </span>
                <span class="philosophy-pillar-num" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            </div>
            <h3 class="text-lg md:text-xl font-bold gradient-text mb-3">${escapeHtml(pillar.title)}</h3>
            <p class="text-gray-400 text-sm md:text-base leading-relaxed">${escapeHtml(pillar.text)}</p>
        </article>
      `,
    )
    .join("");

  const assistants = (philosophy.assistants?.items ?? [])
    .map(
      (assistant, index) => {
        const delayClass = index > 0 ? " delay-02" : "";
        const assistantKey = assistant.key ?? "";
        const assistantAttr = assistantKey ? ` data-assistant="${escapeHtml(assistantKey)}"` : "";
        const symbolMark = renderAssistantSymbolMark(assistantKey);
        const inner = `
            ${symbolMark}
            <div class="philosophy-assistant-head">
                <span class="philosophy-assistant-icon-wrap" aria-hidden="true">
                    <svg class="philosophy-assistant-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${assistantIconSvg(assistant.name)}</svg>
                </span>
                <div class="flex flex-wrap items-center gap-3 mb-3">
                <span class="philosophy-assistant-name">${escapeHtml(assistant.name)}</span>
                <span class="product-label product-label-brand">${escapeHtml(assistant.role)}</span>
                </div>
            </div>
            <p class="text-gray-300 text-sm md:text-base leading-relaxed">${escapeHtml(assistant.text)}</p>
        `;
        if (assistant.href) {
          return `
        <a href="${escapeHtml(assistant.href)}" class="philosophy-assistant philosophy-assistant-link glass-hover rounded-2xl p-6 reveal block h-full${delayClass}"${assistantAttr} aria-label="${escapeHtml(assistant.name)}">
            ${inner}
        </a>
      `;
        }
        return `
        <article class="philosophy-assistant glass-hover rounded-2xl p-6 reveal h-full${delayClass}"${assistantAttr}>
            ${inner}
        </article>
      `;
      },
    )
    .join("");

  const assistantsBlock =
    philosophy.assistants?.title && assistants
      ? `
        <div class="mt-12 md:mt-16 reveal">
            <h3 class="text-2xl md:text-3xl font-bold text-center mb-8">${escapeHtml(philosophy.assistants.title)}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${assistants}</div>
        </div>
      `
      : "";

  return `
    <section id="philosophy" class="py-20 md:py-24 px-6 bg-gradient-to-b from-black/50 to-transparent scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-5xl">
            ${renderSectionHeader(sectionEyebrow, philosophy.title, philosophy.subtitle)}
            ${
              philosophy.quote
                ? `<blockquote class="philosophy-quote reveal">
                <span class="philosophy-quote-mark" aria-hidden="true">
                    <svg class="philosophy-quote-mark-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h4v6H5c0-2 1-3 2-4V8zm10 0h4v6h-6c0-2 1-3 2-4V8z"></path></svg>
                </span>
                <p>${escapeHtml(philosophy.quote)}</p>
            </blockquote>`
                : ""
            }
            <div class="glass-hover rounded-3xl p-6 md:p-10 space-y-5 md:space-y-6 reveal delay-02">${paragraphs}</div>
            <div class="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">${pillars}</div>
            ${assistantsBlock}
        </div>
    </section>
  `;
};

const renderMetricCard = (metric, index) => {
  const delayClass = index > 0 ? ` delay-0${Math.min(index + 1, 4)}` : "";
  const inner = `
            <div class="metric-icon-wrap" aria-hidden="true">
                <svg class="metric-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${metricIconSvg(index)}</svg>
            </div>
            <div class="text-3xl md:text-5xl font-black gradient-text mb-2 stat-number" data-metric-value="${escapeHtml(metric.value)}">${escapeHtml(metric.value)}</div>
            <div class="text-gray-400 text-sm leading-snug">${escapeHtml(metric.label)}</div>
  `;
  if (metric.href) {
    return `
        <a href="${escapeHtml(metric.href)}" class="metric-card metric-card-link text-center reveal block${delayClass}" aria-label="${escapeHtml(`${metric.value} ${metric.label}`)}">
            ${inner}
        </a>
      `;
  }
  return `
        <div class="text-center metric-card reveal${delayClass}">
            ${inner}
        </div>
      `;
};

const renderHeroBadge = (hero) => {
  const inner = `
                <span class="relative flex h-3 w-3 shrink-0">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span class="text-xs md:text-sm font-semibold text-gray-200">${escapeHtml(hero.badge)}</span>
  `;
  const className =
    "hero-badge inline-flex items-center gap-2 px-4 py-2 mb-8 glass rounded-full animate-glow max-w-full";
  if (hero.badgeHref) {
    return `<a href="${escapeHtml(hero.badgeHref)}" class="${className} hero-badge-link" aria-label="${escapeHtml(hero.badge)}">${inner}</a>`;
  }
  return `<div class="${className}">${inner}</div>`;
};

const renderLoadError = (ui) => `
    <div class="landing-error container mx-auto px-6 py-32 text-center max-w-lg">
        <p class="text-red-300 mb-6 leading-relaxed">${escapeHtml(ui?.loadError ?? "Failed to load")}</p>
        <button type="button" id="landing-retry-btn" class="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-primary-600 to-pink-500 hover:scale-105 transition-transform">
            ${escapeHtml(ui?.retry ?? "Retry")}
        </button>
    </div>
`;

const renderLoading = (ui) => `
    <div class="landing-loading" aria-live="polite">
        <div class="landing-loading-spinner" aria-hidden="true"></div>
        <p>${escapeHtml(ui?.loading ?? "…")}</p>
        <div class="landing-skeleton" aria-hidden="true">
            <div class="landing-skeleton-bar landing-skeleton-bar-lg"></div>
            <div class="landing-skeleton-bar"></div>
            <div class="landing-skeleton-bar landing-skeleton-bar-sm"></div>
        </div>
    </div>
`;

const renderVideoSection = (content, ui) => {
  if (!VIDEO_SECTION_ENABLED || !content.video) {
    return "";
  }
  const videoSrc = escapeHtml(content.video.src ?? "kuku2.mp4");
  const videoPoster = escapeHtml(content.video.poster ?? "logo_empery.png");
  const videoDescribedBy = content.video.caption ? ' aria-describedby="video-caption"' : "";
  return `
    <section id="video" class="py-12 md:py-16 px-6 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-5xl">
            ${renderSectionHeader(content.video.eyebrow, content.video.title, content.video.subtitle, { compact: true })}
            <div class="glass-hover rounded-3xl overflow-hidden reveal shadow-glow-soft">
                <div class="relative video-frame video-shell">
                    ${
                      content.video.durationLabel
                        ? `<span class="video-duration-badge">${escapeHtml(content.video.durationLabel)}</span>`
                        : ""
                    }
                    <video class="absolute inset-0 h-full w-full object-cover video-radius landing-video" controls controlslist="nodownload" preload="none" playsinline decoding="async" poster="${videoPoster}" aria-label="${escapeHtml(content.video.title)}"${videoDescribedBy}>
                        <source src="${videoSrc}" type="video/mp4">
                        ${renderVideoTracks(content.video.tracks)}
                        <p class="video-fallback">${escapeHtml(ui.videoFallback ?? "")}</p>
                    </video>
                    <div class="video-play-hint-wrap" aria-hidden="false">
                        <button type="button" class="video-play-hint" aria-label="${escapeHtml(ui.videoPlayHint ?? content.video.title)}">
                            <span class="video-play-icon">
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                            </span>
                            <span>${escapeHtml(ui.videoPlayHint ?? "")}</span>
                        </button>
                    </div>
                </div>
            </div>
            ${content.video.caption ? `<p id="video-caption" class="video-caption reveal">${escapeHtml(content.video.caption)}</p>` : ""}
            ${renderVideoHighlights(content.video.highlights)}
        </div>
    </section>
  `;
};

const renderPage = (content) => {
  const ui = content.ui ?? {};
  const heroChips = (content.hero.chips ?? [])
    .map((chip) => {
      const normalized = normalizeChip(chip);
      return `<a href="${escapeHtml(normalized.href)}" class="hero-chip px-4 py-2 glass rounded-full text-gray-300 text-sm" aria-label="${escapeHtml(normalized.label)}">${escapeHtml(normalized.label)}</a>`;
    })
    .join("");

  const trustItems = content.trust.items.map((item, index) => renderTrustCard(item, index)).join("");

  const journeySection = renderJourneySection(content.journey, ui);

  const platformParagraphs = content.platform.paragraphs
    .map((paragraph) => `<p class="text-gray-300 leading-relaxed text-base md:text-lg">${escapeHtml(paragraph)}</p>`)
    .join("");

  const metrics = content.platform.metrics
    .map((metric, index) => renderMetricCard(metric, index))
    .join("");

  const { jumpNavHtml, groupsHtml } = renderProductSection(
    content.products,
    content.ui?.productJumpLabel,
    ui.groupItemsSuffix,
    content.products.groupHighlights,
    ui.readyRibbon,
  );
  const philosophySection = renderPhilosophySection(content.philosophy, content.nav?.philosophy);
  const faqSection = renderFaqSection(content.faq, ui, currentLanguage);
  const roadmapSummary = renderRoadmapSummary(content.roadmap.phases, content.roadmap.legend);
  const roadmapProgress = renderRoadmapProgress(content.roadmap.phases, ui);
  const roadmapLegend = renderRoadmapLegend(content.roadmap.legend);
  const roadmap = content.roadmap.phases
    .map((phase, index) => renderRoadmapItem(phase, index, content.roadmap.legend))
    .join("");

  const videoSection = renderVideoSection(content, ui);
  const footerHighlights = filterVideoNavHighlights(content.footer?.highlights);

  if (scrollToTopBtn) {
    scrollToTopBtn.setAttribute("aria-label", ui.scrollTop ?? "Scroll to top");
  }

  landingRoot.innerHTML = `
    <header class="fixed left-0 right-0 z-50 glass header-shell" id="header">
        <nav class="container mx-auto px-4 md:px-6 header-nav-shell" aria-label="${escapeHtml(ui.mainNavLabel ?? (currentLanguage === "en" ? "Main navigation" : "Главная навигация"))}">
            <a href="#" class="header-brand header-nav-brand flex items-center gap-2.5 md:gap-3 group min-w-0" aria-label="${escapeHtml(ui.logoHome ?? content.brand.company)}">
                <img src="logo_empery.png" alt="${escapeHtml(content.brand.company)}" class="header-logo h-11 w-11 md:h-12 md:w-12 filter drop-shadow-lg shrink-0" loading="eager" fetchpriority="high" decoding="async" width="48" height="48">
                <div class="header-brand-copy flex flex-col min-w-0">
                    <span class="header-brand-title text-lg md:text-xl font-black gradient-gold truncate">${escapeHtml(content.brand.company)}</span>
                    <div class="header-brand-meta flex flex-wrap items-center gap-2 mt-0.5">
                        <span class="header-project-pill">${escapeHtml(content.brand.project)}</span>
                        <span class="header-brand-tagline text-xs text-gray-400 font-medium truncate">${escapeHtml(content.brand.tagline)}</span>
                    </div>
                </div>
            </a>
            <div class="header-nav-end hidden md:flex items-center justify-end gap-3 lg:gap-4 min-w-0">${renderNavLinks(content.nav, currentLanguage, ui.externalLink, ui.langSwitcherLabel)}</div>
            <button type="button" class="md:hidden p-2 rounded-lg hover:bg-white/5 mobile-menu-toggle shrink-0 justify-self-end" id="mobile-menu-btn" aria-label="${escapeHtml(ui.menu ?? "Menu")}" aria-expanded="false" aria-controls="mobile-menu">
                <svg class="w-6 h-6 menu-icon-open" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
                <svg class="w-6 h-6 menu-icon-close hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </nav>
        <div class="md:hidden hidden mobile-menu-panel glass border-t border-white/10" id="mobile-menu" role="dialog" aria-modal="false" aria-label="${escapeHtml(ui.mobileMenuLabel ?? ui.menu ?? "Menu")}" inert>
            <div class="container mx-auto px-6 py-5 flex flex-col gap-5">${renderNavLinks(content.nav, currentLanguage, ui.externalLink, ui.langSwitcherLabel, "mobile")}</div>
        </div>
        <div class="header-accent" aria-hidden="true"></div>
    </header>

    <main id="main-content" aria-label="${escapeHtml(ui.mainContentLabel ?? (currentLanguage === "en" ? "Page content" : "Содержание страницы"))}">
    <section class="relative min-h-[90vh] md:min-h-screen flex items-center justify-center pt-24 pb-12 px-6 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute top-1/4 -left-20 w-72 md:w-96 h-72 md:h-96 bg-primary-600/20 rounded-full blur-3xl animate-float"></div>
            <div class="absolute bottom-1/4 -right-20 w-72 md:w-96 h-72 md:h-96 bg-pink-500/20 rounded-full blur-3xl animate-float delay-10"></div>
        </div>
        <div class="container mx-auto max-w-5xl text-center relative z-10">
            ${renderHeroBadge(content.hero)}
            <h1 class="text-4xl sm:text-5xl md:text-7xl font-black mb-5 leading-tight animate-slide-down">
                <span class="gradient-gold block mb-2">${escapeHtml(content.hero.titleAccent)}</span>
                <span class="text-white">${escapeHtml(content.hero.title)}</span>
            </h1>
            ${renderIdentityStrip(content.brand, content.identity)}
            <p class="text-lg md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto font-light leading-relaxed animate-slide-up delay-02">${escapeHtml(content.hero.lead)}</p>
            <p class="text-base md:text-lg text-gray-400 mb-8 max-w-2xl mx-auto animate-slide-up delay-03">${escapeHtml(content.hero.secondary)}</p>
            ${renderHeroStats(content.hero.stats)}
            <div class="hero-cta-row flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-stretch sm:items-center animate-scale-in delay-04">
                ${renderAppLink(content.hero.ctaPrimary, "btn-magnetic px-8 py-4 bg-gradient-to-r from-primary-600 to-pink-500 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-primary-500/50 transition-all flex items-center justify-center hover:scale-105", ui.externalLink)}
                ${
                  content.hero.ctaAndroid
                    ? renderAndroidAppLink(
                        content.hero.ctaAndroid,
                        "px-8 py-4 glass-hover rounded-2xl font-semibold text-lg flex items-center justify-center",
                        ui.androidExternalLink,
                      )
                    : ""
                }
                ${
                  VIDEO_SECTION_ENABLED && content.hero.ctaSecondary
                    ? renderHeroHashCta(
                        content.hero.ctaSecondaryHref ?? "#video",
                        content.hero.ctaSecondary,
                        "px-8 py-4 glass-hover rounded-2xl font-semibold text-lg flex items-center justify-center",
                        ui.sectionNavPrefix,
                        "demo",
                      )
                    : ""
                }
                ${
                  content.hero.ctaTertiary
                    ? renderHeroHashCta(
                        content.hero.ctaTertiaryHref ?? "#products",
                        content.hero.ctaTertiary,
                        "px-8 py-4 glass rounded-2xl font-semibold text-lg flex items-center justify-center text-gray-300 hover:text-white",
                        ui.sectionNavPrefix,
                        "programs",
                      )
                    : ""
                }
            </div>
            <div class="hero-chips-scroll reveal delay-06">
                <div class="hero-chips-inner">${heroChips}</div>
            </div>
            ${renderPlatformsStrip(content.hero.platforms)}
        </div>
        <a href="#trust" class="hero-scroll-hint" aria-label="${escapeHtml(ui.scrollHint ?? "Scroll")}">
            <span>${escapeHtml(ui.scrollHint ?? "")}</span>
            <svg class="hero-scroll-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
            </svg>
        </a>
    </section>

    <section id="trust" class="py-12 md:py-16 px-6 border-b border-white/10 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-6xl">
            ${renderSectionHeader(content.trust?.eyebrow, content.trust?.title, content.trust?.subtitle, { compact: true })}
            ${renderTrustSummary(content.trust.summary)}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">${trustItems}</div>
        </div>
    </section>

    ${journeySection}

    ${videoSection}

    <section id="platform" class="py-20 md:py-24 px-6 bg-gradient-to-b from-transparent to-black/50 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-5xl">
            ${renderSectionHeader(content.nav?.platform, content.platform.title, content.platform.subtitle)}
            <div class="glass-hover rounded-3xl p-6 md:p-12 space-y-5 md:space-y-6 reveal">${platformParagraphs}</div>
            ${renderPlatformEcosystem(content.platform.ecosystem)}
            ${renderPlatformMetricsDivider(content.platform.metricsLabel)}
            <div class="mt-10 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 reveal delay-02">${metrics}</div>
        </div>
    </section>

    ${philosophySection}

    <section id="products" class="py-20 md:py-24 px-6 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-7xl">
            ${renderSectionHeader(content.nav?.products, content.products.title, content.products.subtitle)}
            ${jumpNavHtml}
            <div class="space-y-12 md:space-y-16">${groupsHtml}</div>
        </div>
    </section>

    <section id="roadmap" class="py-20 md:py-24 px-6 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-6xl">
            ${renderSectionHeader(content.nav?.roadmap, content.roadmap.title, content.roadmap.subtitle)}
            ${roadmapProgress}
            ${roadmapSummary}
            ${roadmapLegend}
            <div class="relative pl-8 md:pl-0 mt-10">
                <div class="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-600 via-pink-500 to-transparent"></div>
                <div class="space-y-10 md:space-y-12">${roadmap}</div>
            </div>
        </div>
    </section>

    ${faqSection}

    <section id="cta" class="cta-section py-20 md:py-24 px-6 scroll-mt-28 section-focus-target" tabindex="-1">
        <div class="container mx-auto max-w-4xl text-center reveal cta-panel glass-hover rounded-3xl p-8 md:p-12">
            <div class="cta-icon-wrap" aria-hidden="true">
                <svg class="cta-panel-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${ctaPanelIconSvg()}</svg>
            </div>
            ${content.cta.eyebrow ? `<p class="section-eyebrow mb-4">${escapeHtml(content.cta.eyebrow)}</p>` : ""}
            <h2 class="text-3xl md:text-5xl font-black mb-6">${escapeHtml(content.cta.title)}</h2>
            <p class="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">${escapeHtml(content.cta.text)}</p>
            <div class="cta-actions flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
                ${renderAppLink(content.cta.button, "btn-magnetic inline-flex items-center justify-center gap-4 px-10 md:px-12 py-5 md:py-6 bg-gradient-to-r from-primary-600 to-pink-500 rounded-2xl font-bold text-xl md:text-2xl shadow-2xl hover:shadow-primary-500/50 transition-all hover:scale-105", ui.externalLink)}
                ${
                  content.cta.android
                    ? renderAndroidAppLink(
                        content.cta.android,
                        "inline-flex items-center justify-center gap-3 px-8 md:px-10 py-5 md:py-6 glass-hover rounded-2xl font-semibold text-lg md:text-xl",
                        ui.androidExternalLink,
                      )
                    : ""
                }
                ${
                  VIDEO_SECTION_ENABLED && content.cta.secondary
                    ? renderHeroHashCta(
                        content.cta.secondaryHref ?? "#video",
                        content.cta.secondary,
                        "px-8 py-5 md:py-6 glass-hover rounded-2xl font-semibold text-lg flex items-center justify-center",
                        ui.sectionNavPrefix,
                        "demo",
                      )
                    : ""
                }
            </div>
            <p class="mt-8 text-gray-500 text-sm">${escapeHtml(content.cta.note)}</p>
        </div>
    </section>
    </main>

    <footer class="glass border-t border-white/10 py-12 px-6">
        <div class="container mx-auto max-w-7xl">
            ${renderFooterHighlights(footerHighlights, ui.externalLink)}
            <div class="footer-main flex flex-col lg:flex-row justify-between items-start gap-8 mt-8">
                ${renderFooterBrand(content.brand)}
                ${renderAppLink(content.nav.cta, "footer-open-app app-external-link px-5 py-2.5 bg-gradient-to-r from-primary-600/80 to-pink-500/80 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-primary-500/30 transition-all shrink-0", ui.externalLink)}
            </div>
            <div class="footer-meta mt-8 pt-8 border-t border-white/10 flex flex-col items-center gap-4 text-center text-gray-500 text-sm">
                ${renderLangSwitcher(currentLanguage, ui.langSwitcherLabel)}
                <button type="button" id="copy-page-link" class="copy-link-btn">${escapeHtml(ui.copyLink ?? "Copy link")}</button>
                <div class="footer-util-links">
                    <a href="/.well-known/security.txt" class="footer-util-link footer-security-link">
                        <svg class="footer-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        <span>${escapeHtml(ui.securityContact ?? "Security")}</span>
                    </a>
                    <a href="/humans.txt" class="footer-util-link footer-sitemap-link">
                        <svg class="footer-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>${escapeHtml(ui.humansLink ?? "About")}</span>
                    </a>
                    <a href="/sitemap.xml" class="footer-util-link footer-sitemap-link">
                        <svg class="footer-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                        <span>${escapeHtml(ui.sitemapLink ?? "Sitemap")}</span>
                    </a>
                </div>
                <p id="footer-build-stamp" class="footer-build-stamp" hidden></p>
                <p>${escapeHtml(content.footer.copyright)}</p>
                <p>${escapeHtml(content.footer.signature)}</p>
            </div>
        </div>
    </footer>
  `;
};

const loadLandingBuildMeta = async () => {
  try {
    const response = await fetch("landing-meta.json", { cache: "no-cache" });
    if (!response.ok) {
      return;
    }
    landingBuildMeta = await response.json();
  } catch {
    // Build meta is optional for local dev without full dist.
  }
};

const updateBuildStamp = (ui) => {
  const stamp = document.getElementById("footer-build-stamp");
  if (!stamp) {
    return;
  }
  if (!landingBuildMeta?.lastmod) {
    stamp.hidden = true;
    return;
  }
  stamp.hidden = false;
  stamp.textContent = `${ui?.buildStampLabel ?? "Build"}: ${landingBuildMeta.lastmod}`;
  const titleParts = [];
  if (landingBuildMeta.buildTime) {
    titleParts.push(landingBuildMeta.buildTime);
  }
  if (landingBuildMeta.version) {
    titleParts.push(`v${landingBuildMeta.version}`);
  }
  if (titleParts.length > 0) {
    stamp.title = titleParts.join(" · ");
  } else {
    stamp.removeAttribute("title");
  }
};

const loadContent = async (language, signal) => {
  const resolvedLanguage = resolveLanguage(language);
  const response = await fetch(`content/landing.${resolvedLanguage}.json`, { cache: "no-cache", signal });
  if (!response.ok) {
    throw new Error(`Failed to load landing content (${response.status})`);
  }
  return response.json();
};

const prefetchAlternateContent = (language) => {
  const alternate = language === "ru" ? "en" : "ru";
  const href = `content/landing.${alternate}.json`;
  if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "fetch";
  link.href = href;
  document.head.appendChild(link);
};

const syncNoscriptBanner = (content) => {
  const banner = document.getElementById("noscript-banner");
  if (!banner || !content.ui?.noscript) {
    return;
  }
  const message = content.ui.noscript.replace("app.eliteew.ru", "").trim();
  banner.innerHTML = `${escapeHtml(message)} <a href="${APP_URL}">app.eliteew.ru</a>`;
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
};

const shareUrlIfAvailable = async (url, shareOptions = {}) => {
  if (!navigator.share) {
    return false;
  }
  const payload = { url };
  if (shareOptions.title) {
    payload.title = shareOptions.title;
  }
  if (shareOptions.text) {
    payload.text = shareOptions.text;
  }
  if (navigator.canShare && !navigator.canShare(payload)) {
    const urlOnly = { url };
    if (!navigator.canShare(urlOnly)) {
      return false;
    }
    delete payload.title;
    delete payload.text;
  }
  try {
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
};

const copyOrShareUrl = async (url, shareOptions = {}) => {
  const copied = await copyTextToClipboard(url);
  if (copied) {
    return true;
  }
  return shareUrlIfAvailable(url, shareOptions);
};

const getCanonicalPageUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
};

const runCopyFeedback = async (button, url, labels) => {
  const defaultLabel = labels.defaultLabel;
  const doneLabel = labels.doneLabel ?? defaultLabel;
  const failedLabel = labels.failedLabel ?? defaultLabel;
  const announcer = document.getElementById("lang-announcer");
  try {
    const copied = await copyOrShareUrl(url, {
      title: labels.shareTitle,
      text: labels.shareText,
    });
    if (!copied) {
      throw new Error("copy failed");
    }
    button.textContent = doneLabel;
    button.classList.add("copy-link-btn-done");
    if (announcer && labels.successAnnounced) {
      announcer.textContent = labels.successAnnounced;
    }
    window.setTimeout(() => {
      button.textContent = defaultLabel;
      button.classList.remove("copy-link-btn-done");
    }, 2200);
  } catch {
    button.textContent = failedLabel;
    button.classList.remove("copy-link-btn-done");
    if (announcer && labels.failedAnnounced) {
      announcer.textContent = labels.failedAnnounced;
    }
    window.setTimeout(() => {
      button.textContent = defaultLabel;
    }, 2200);
  }
};

const setupCopyLink = (signal, ui) => {
  const copyBtn = document.getElementById("copy-page-link");
  if (!copyBtn) {
    return;
  }
  const defaultLabel = ui?.copyLink ?? "Copy link";
  copyBtn.textContent = defaultLabel;
  copyBtn.addEventListener(
    "click",
    () => {
      void runCopyFeedback(copyBtn, getCanonicalPageUrl(), {
        defaultLabel,
        doneLabel: ui?.copyLinkDone ?? "Link copied",
        failedLabel: ui?.copyLinkFailed ?? defaultLabel,
        successAnnounced: ui?.copyLinkAnnounced,
        failedAnnounced: ui?.copyLinkFailedAnnounced,
        shareTitle: pageContent?.meta?.title,
        shareText: pageContent?.meta?.description,
      });
    },
    { signal },
  );
};

const setupFaqCopyLinks = (signal, ui) => {
  const faqList = document.querySelector(".faq-list");
  if (!faqList) {
    return;
  }
  const defaultLabel = ui?.faqCopyLink ?? ui?.copyLink ?? "Copy link";
  faqList.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(".faq-copy-link");
      if (!button) {
        return;
      }
      const index = button.dataset.faqIndex;
      if (index === undefined) {
        return;
      }
      const url = new URL(window.location.href);
      url.hash = `faq-item-${index}`;
      const question = pageContent?.faq?.items?.[Number(index)]?.q;
      void runCopyFeedback(button, url.toString(), {
        defaultLabel,
        doneLabel: ui?.faqCopyLinkDone ?? ui?.copyLinkDone ?? "Link copied",
        failedLabel: ui?.copyLinkFailed ?? defaultLabel,
        successAnnounced: ui?.faqCopyLinkAnnounced,
        failedAnnounced: ui?.faqCopyLinkFailedAnnounced ?? ui?.copyLinkFailedAnnounced,
        shareTitle: question,
      });
    },
    { signal },
  );
};

const setupHorizontalNavKeyboard = (container, linkSelector, signal) => {
  if (!container) {
    return;
  }
  container.addEventListener(
    "keydown",
    (event) => {
      const links = [...container.querySelectorAll(linkSelector)];
      if (links.length === 0) {
        return;
      }
      const currentIndex = links.indexOf(document.activeElement);
      if (currentIndex === -1) {
        return;
      }
      let nextIndex = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = Math.min(currentIndex + 1, links.length - 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = links.length - 1;
      }
      if (nextIndex === null || nextIndex === currentIndex) {
        return;
      }
      event.preventDefault();
      links[nextIndex].focus();
    },
    { signal },
  );
};

const setupLangSwitcherKeyboardNav = (signal) => {
  document.querySelectorAll(".lang-switcher").forEach((switcher) => {
    setupHorizontalNavKeyboard(switcher, ".lang-toggle", signal);
  });
};

const setupJourneyKeyboardNav = (signal) => {
  setupHorizontalNavKeyboard(document.querySelector(".journey-track"), ".journey-step-link", signal);
};

const setupProductJumpKeyboardNav = (signal) => {
  setupHorizontalNavKeyboard(document.querySelector(".product-jump-nav"), ".product-jump-link", signal);
};

const setupHeaderNavKeyboardNav = (signal) => {
  document.querySelectorAll(".header-nav-links").forEach((container) => {
    setupHorizontalNavKeyboard(container, ".nav-link[data-nav-section]", signal);
  });
};

const setupOfflineBanner = (signal, ui) => {
  let banner = document.getElementById("offline-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "offline-banner";
    banner.className = "offline-banner";
    banner.hidden = true;
    banner.setAttribute("role", "status");
    document.body.appendChild(banner);
  }
  const showOffline = () => {
    banner.textContent = ui?.offlineBanner ?? "Offline";
    banner.hidden = false;
    document.body.classList.add("is-offline-banner-visible");
  };
  const hideOffline = () => {
    banner.hidden = true;
    document.body.classList.remove("is-offline-banner-visible");
    const announcer = document.getElementById("lang-announcer");
    if (announcer && ui?.onlineBannerAnnounced) {
      announcer.textContent = ui.onlineBannerAnnounced;
    }
  };
  window.addEventListener("online", hideOffline, { signal });
  window.addEventListener(
    "online",
    () => {
      hideOffline();
      void loadLandingBuildMeta().then(() => updateBuildStamp(ui));
    },
    { signal },
  );
  window.addEventListener("offline", showOffline, { signal });
  if (!navigator.onLine) {
    showOffline();
  }
};

const closeOpenFaqItems = () => {
  document.querySelectorAll(".faq-item[open]").forEach((item) => {
    item.open = false;
  });
};

const setupFaqAccordion = (signal) => {
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.addEventListener(
      "toggle",
      () => {
        if (!item.open) {
          const faqMatch = window.location.hash.match(/^#faq-item-(\d+)$/);
          if (faqMatch && item.id === `faq-item-${faqMatch[1]}`) {
            clearPageHash();
          }
          return;
        }
        document.querySelectorAll(".faq-item").forEach((other) => {
          if (other !== item) {
            other.open = false;
          }
        });
        if (!item.id?.startsWith("faq-item-")) {
          return;
        }
        const hash = `#${item.id}`;
        if (window.location.hash !== hash) {
          const url = new URL(window.location.href);
          url.hash = hash;
          replaceHistoryUrl(`${url.pathname}${url.search}${url.hash}`);
        }
        syncHashDocumentMeta();
      },
      { signal },
    );
  });
};

const setupFaqKeyboardNav = (signal) => {
  const faqList = document.querySelector(".faq-list");
  if (!faqList) {
    return;
  }
  faqList.addEventListener(
    "keydown",
    (event) => {
      const summaries = [...faqList.querySelectorAll(".faq-item > summary")];
      if (summaries.length === 0) {
        return;
      }
      const currentIndex = summaries.indexOf(document.activeElement);
      if (currentIndex === -1) {
        return;
      }
      let nextIndex = null;
      if (event.key === "ArrowDown") {
        nextIndex = Math.min(currentIndex + 1, summaries.length - 1);
      } else if (event.key === "ArrowUp") {
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = summaries.length - 1;
      }
      if (nextIndex === null || nextIndex === currentIndex) {
        return;
      }
      event.preventDefault();
      summaries[nextIndex].focus();
    },
    { signal },
  );
};

const setupAppLinkPrefetch = (signal) => {
  const ensureAppPrefetch = () => {
    if (document.querySelector(`link[rel="prefetch"][href="${APP_URL}"]`)) {
      return;
    }
    const prefetchLink = document.createElement("link");
    prefetchLink.rel = "prefetch";
    prefetchLink.href = APP_URL;
    document.head.appendChild(prefetchLink);
  };
  document.querySelectorAll(`a[href="${APP_URL}"]`).forEach((link) => {
    link.addEventListener("mouseenter", ensureAppPrefetch, { once: true, signal });
  });
};

const setupVideoLazyLoad = (signal) => {
  const video = document.querySelector(".landing-video");
  if (!video) {
    return;
  }
  const preloadPoster = () => {
    const poster = video.getAttribute("poster");
    if (!poster || document.querySelector(`link[data-poster-preload="${poster}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = poster;
    link.dataset.posterPreload = poster;
    document.head.appendChild(link);
  };
  if (!("IntersectionObserver" in window)) {
    video.preload = "metadata";
    preloadPoster();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          preloadPoster();
          video.preload = "metadata";
          video.load();
          observer.disconnect();
        }
      }
    },
    { rootMargin: "160px 0px" },
  );
  observer.observe(video.closest(".video-frame") ?? video);
  signal?.addEventListener("abort", () => observer.disconnect(), { once: true });
};

const setupVideoPlayHint = (signal) => {
  const video = document.querySelector(".landing-video");
  const hintWrap = document.querySelector(".video-play-hint-wrap");
  const hintBtn = document.querySelector(".video-play-hint");
  if (!video || !hintBtn) {
    return;
  }
  const hideHint = () => {
    hintWrap?.classList.add("is-hidden");
    hintBtn.classList.add("is-hidden");
  };
  const ensureVideoPrefetch = () => {
    const src = video.querySelector("source")?.getAttribute("src");
    if (!src || document.querySelector(`link[rel="prefetch"][href="${src}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = src;
    document.head.appendChild(link);
  };
  const startPlayback = () => {
    void video.play();
    hideHint();
  };
  video.addEventListener("play", hideHint, { once: true, signal });
  hintBtn.addEventListener("mouseenter", ensureVideoPrefetch, { once: true, signal });
  hintBtn.addEventListener("focus", ensureVideoPrefetch, { once: true, signal });
  hintBtn.addEventListener("click", startPlayback, { signal });
  hintBtn.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startPlayback();
      }
    },
    { signal },
  );
};

const setupVideoViewportPause = (signal) => {
  const video = document.querySelector(".landing-video");
  if (!video || !("IntersectionObserver" in window)) {
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting && !video.paused) {
          video.pause();
        }
      }
    },
    { threshold: 0.12 },
  );
  observer.observe(video.closest(".video-frame") ?? video);
  signal?.addEventListener("abort", () => observer.disconnect(), { once: true });
};

const setupVideoTabPause = (signal) => {
  const video = document.querySelector(".landing-video");
  if (!video) {
    return;
  }
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden && !video.paused) {
        video.pause();
      }
    },
    { signal },
  );
};

const setupVideoKeyboardPlay = (signal) => {
  const video = document.querySelector(".landing-video");
  if (!video) {
    return;
  }
  video.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
    },
    { signal },
  );
};

const setupVideoInteractions = () => {
  videoHandlersAbort?.abort();
  videoHandlersAbort = new AbortController();
  setupVideoLazyLoad(videoHandlersAbort.signal);
  setupVideoPlayHint(videoHandlersAbort.signal);
  setupVideoViewportPause(videoHandlersAbort.signal);
  setupVideoTabPause(videoHandlersAbort.signal);
  setupVideoKeyboardPlay(videoHandlersAbort.signal);
};

const parseMetricNumber = (value) => {
  const match = String(value ?? "").match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
};

const animateMetricElement = (element) => {
  const raw = element.dataset.metricValue ?? element.textContent ?? "";
  const target = parseMetricNumber(raw);
  if (target === null || target > 99) {
    return;
  }
  const suffix = String(raw).replace(/^\d+/, "");
  const durationMs = 700;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / durationMs, 1);
    const current = Math.round(target * progress);
    element.textContent = `${current}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };
  element.textContent = `0${suffix}`;
  requestAnimationFrame(tick);
};

const setupMetricCounters = () => {
  metricCounterObserver?.disconnect();
  const elements = document.querySelectorAll(".stat-number[data-metric-value]");
  if (elements.length === 0) {
    return;
  }
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach((element) => {
      element.textContent = element.dataset.metricValue ?? element.textContent;
    });
    return;
  }
  metricCounterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        animateMetricElement(entry.target);
        metricCounterObserver?.unobserve(entry.target);
      }
    },
    { threshold: 0.45 },
  );
  elements.forEach((element) => metricCounterObserver?.observe(element));
};

const toggleHeroScrollHint = () => {
  const hint = document.querySelector(".hero-scroll-hint");
  if (!hint) {
    return;
  }
  const hidden = window.scrollY > 120;
  hint.classList.toggle("is-hidden", hidden);
  hint.setAttribute("aria-hidden", hidden ? "true" : "false");
  hint.tabIndex = hidden ? -1 : 0;
};

const focusNavTarget = (target) => {
  if (!target) {
    return;
  }
  const focusEl =
    target.matches("details") ? target.querySelector("summary") : target.querySelector("h2, h3") ?? target;
  if (!focusEl) {
    return;
  }
  if (!focusEl.hasAttribute("tabindex")) {
    focusEl.setAttribute("tabindex", "-1");
  }
  focusEl.focus({ preventScroll: true });
};

const navigateToHash = (hash, options = {}) => {
  if (!hash || hash === "#") {
    return;
  }
  const faqMatch = hash.match(/^#faq-item-(\d+)$/);
  if (faqMatch) {
    const targetId = `faq-item-${faqMatch[1]}`;
    document.querySelectorAll(".faq-item[open]").forEach((item) => {
      if (item.id !== targetId) {
        item.open = false;
      }
    });
    const faqItem = document.getElementById(targetId);
    if (faqItem) {
      faqItem.open = true;
    }
  } else {
    closeOpenFaqItems();
  }
  const target = document.querySelector(hash);
  if (!target) {
    return;
  }
  target.scrollIntoView({
    behavior: options.smooth === false || prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  if (options.updateUrl !== false) {
    const url = new URL(window.location.href);
    url.hash = hash;
    replaceHistoryUrl(`${url.pathname}${url.search}${url.hash}`);
  }
  window.requestAnimationFrame(() => {
    focusNavTarget(target);
    announceSectionNavigation(resolveSectionIdFromHash(hash));
    syncHashDocumentMeta();
  });
};

const captureScrollRatio = () => {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  return docHeight > 0 ? window.scrollY / docHeight : 0;
};

const restoreScrollRatio = (ratio) => {
  requestAnimationFrame(() => {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const top = Math.max(0, Math.min(docHeight * ratio, docHeight));
    window.scrollTo({ top, behavior: "auto" });
    runScrollUiUpdates();
  });
};

const scrollToHashTarget = () => {
  const hash = window.location.hash;
  if (!hash || hash === "#") {
    return;
  }
  requestAnimationFrame(() => {
    navigateToHash(hash, { smooth: false, updateUrl: false });
  });
};

const setupRevealObserver = () => {
  revealObserver?.disconnect();
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("active"));
    return;
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          revealObserver?.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  document.querySelectorAll(".reveal").forEach((element) => revealObserver?.observe(element));
};

const updateProductJumpNav = () => {
  const nav = document.querySelector(".product-jump-nav");
  const links = document.querySelectorAll(".product-jump-link[data-product-group]");
  if (links.length === 0) {
    return;
  }
  let activeGroup = links[0]?.dataset.productGroup;
  for (const link of links) {
    const groupId = link.dataset.productGroup;
    if (!groupId) {
      continue;
    }
    const section = document.getElementById(`products-${groupId}`);
    if (!section) {
      continue;
    }
    const rect = section.getBoundingClientRect();
    if (rect.top <= 180) {
      activeGroup = groupId;
    }
  }
  links.forEach((link) => {
    link.classList.toggle("product-jump-link-active", link.dataset.productGroup === activeGroup);
    setNavLinkCurrent(link, link.dataset.productGroup === activeGroup);
  });
  if (!nav || !activeGroup) {
    return;
  }
  const previousGroup = nav.dataset.activeGroup ?? "";
  nav.dataset.activeGroup = activeGroup;
  if (previousGroup && previousGroup !== activeGroup) {
    const activeLink = document.querySelector(`.product-jump-link-active[data-product-group="${activeGroup}"]`);
    activeLink?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }
};

const updateJourneyProgress = () => {
  const bar = document.querySelector("[data-journey-progress]");
  const links = document.querySelectorAll(".journey-step-link");
  if (!bar || links.length === 0) {
    return;
  }
  let activeIndex = 0;
  links.forEach((link, index) => {
    if (link.classList.contains("journey-step-active")) {
      activeIndex = index;
    }
  });
  const total = links.length;
  const step = activeIndex + 1;
  const percent = Math.round((step / total) * 100);
  bar.querySelector(".journey-progress-fill")?.style.setProperty("width", `${percent}%`);
  bar.setAttribute("aria-valuenow", String(step));
  const label = document.querySelector("[data-journey-progress-label]");
  const prefix = pageContent?.ui?.journeyProgress ?? "";
  if (label) {
    label.textContent = prefix ? `${prefix} · ${step}/${total}` : `${step}/${total}`;
  }
};

const updateJourneyActiveStep = () => {
  const links = document.querySelectorAll(".journey-step-link");
  if (links.length === 0) {
    return;
  }
  let activeLink = links[0];
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const section = document.querySelector(href);
    if (!section) {
      continue;
    }
    if (section.getBoundingClientRect().top <= 200) {
      activeLink = link;
    }
  }
  links.forEach((link) => {
    link.classList.toggle("journey-step-active", link === activeLink);
  });
  updateJourneyProgress();
};

const updateActiveNav = () => {
  const navLinks = document.querySelectorAll(".nav-link[data-nav-section]");
  if (navLinks.length === 0) {
    return;
  }
  const activeSection = getActiveNavSection();
  navLinks.forEach((link) => {
    const isActive = link.dataset.navSection === activeSection;
    link.classList.toggle("nav-link-active", isActive);
    setNavLinkCurrent(link, isActive);
  });
  const navWrap = document.querySelector(".header-nav-links");
  if (navWrap) {
    navWrap.dataset.activeSection = activeSection;
  }
};

const bindInteractiveHandlers = () => {
  interactionAbort?.abort();
  interactionAbort = new AbortController();
  const { signal } = interactionAbort;

  const header = document.getElementById("header");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  const setMobileMenuOpen = (isOpen) => {
    mobileMenu?.classList.toggle("hidden", !isOpen);
    mobileMenu?.classList.toggle("mobile-menu-open", isOpen);
    mobileMenuBtn?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    mobileMenu?.setAttribute("aria-modal", isOpen ? "true" : "false");
    if (isOpen) {
      mobileMenu?.removeAttribute("inert");
    } else {
      mobileMenu?.setAttribute("inert", "");
    }
    mobileMenuBtn?.querySelector(".menu-icon-open")?.classList.toggle("hidden", isOpen);
    mobileMenuBtn?.querySelector(".menu-icon-close")?.classList.toggle("hidden", !isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    if (isOpen) {
      mobileMenu?.querySelector("a, button")?.focus();
    } else {
      mobileMenuBtn?.focus();
    }
  };

  mobileMenuBtn?.addEventListener(
    "click",
    () => {
      const isOpen = mobileMenu?.classList.contains("hidden") === true;
      setMobileMenuOpen(isOpen);
    },
    { signal },
  );

  document.querySelectorAll(".lang-toggle").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const nextLanguage = resolveLanguage(button.dataset.lang ?? DEFAULT_LANGUAGE);
        if (nextLanguage === currentLanguage) {
          return;
        }
        void applyLanguage(nextLanguage);
      },
      { signal },
    );
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") {
      return;
    }
    anchor.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        navigateToHash(href);
        setMobileMenuOpen(false);
      },
      { signal },
    );
  });

  mobileMenu?.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Tab" || mobileMenu.classList.contains("hidden")) {
        return;
      }
      const focusable = mobileMenu.querySelectorAll('a[href], button:not([disabled])');
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );

  document.querySelectorAll(".btn-magnetic").forEach((button) => {
    button.addEventListener(
      "mousemove",
      (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        button.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.05)`;
      },
      { signal },
    );
    button.addEventListener(
      "mouseleave",
      () => {
        button.style.transform = "translate(0, 0) scale(1)";
      },
      { signal },
    );
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    },
    { signal },
  );

  window.addEventListener(
    "hashchange",
    () => {
      const hash = window.location.hash;
      if (!hash || hash === "#") {
        closeOpenFaqItems();
        syncHashDocumentMeta();
        return;
      }
      navigateToHash(hash, { smooth: !prefersReducedMotion(), updateUrl: false });
      syncHashDocumentMeta();
    },
    { signal },
  );

  window.addEventListener(
    "popstate",
    (event) => {
      const urlLanguage = event.state?.landingLang
        ? resolveLanguage(event.state.landingLang)
        : getInitialLanguage();
      if (urlLanguage !== currentLanguage) {
        void applyLanguage(urlLanguage, { historyMode: "replace" });
        return;
      }
      const hash = window.location.hash;
      if (!hash || hash === "#") {
        closeOpenFaqItems();
        syncHashDocumentMeta();
        return;
      }
      navigateToHash(hash, { smooth: false, updateUrl: false });
    },
    { signal },
  );

  const headerHomeLink = header?.querySelector('a[href="#"]');
  headerHomeLink?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      clearPageHash();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      setMobileMenuOpen(false);
    },
    { signal },
  );

  if (header) {
    header.classList.toggle("header-scrolled", window.scrollY > 48);
  }
  setupFaqAccordion(signal);
  setupFaqKeyboardNav(signal);
  setupFaqCopyLinks(signal, pageContent?.ui);
  setupJourneyKeyboardNav(signal);
  setupHeaderNavKeyboardNav(signal);
  setupLangSwitcherKeyboardNav(signal);
  setupProductJumpKeyboardNav(signal);
  setupOfflineBanner(signal, pageContent?.ui);
  setupAppLinkPrefetch(signal);
  setupCopyLink(signal, pageContent?.ui);
  updateActiveNav();
  updateProductJumpNav();
};

const toggleMobileCtaBar = () => {
  const bar = document.getElementById("mobile-cta-bar");
  if (!bar) {
    return;
  }
  const nearFooter = window.innerHeight + window.scrollY >= document.body.offsetHeight - 320;
  const show = window.scrollY > 520 && !nearFooter;
  bar.classList.toggle("is-visible", show);
  bar.setAttribute("aria-hidden", show ? "false" : "true");
};

const updateScrollProgress = () => {
  if (!scrollProgress) {
    return;
  }
  const scrollTop = window.pageYOffset;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) {
    scrollProgress.style.width = "0%";
    scrollProgress.dataset.active = "false";
    return;
  }
  const scrollPercent = Math.max(0, Math.min((scrollTop / docHeight) * 100, 100));
  scrollProgress.style.width = `${scrollPercent}%`;
  scrollProgress.setAttribute("aria-valuenow", String(Math.round(scrollPercent)));
  scrollProgress.dataset.active = scrollPercent > 1.5 ? "true" : "false";
};

const toggleHeaderState = () => {
  const header = document.getElementById("header");
  if (!header) {
    return;
  }
  header.classList.toggle("header-scrolled", window.scrollY > 48);
};

const toggleScrollToTop = () => {
  if (!scrollToTopBtn) {
    return;
  }
  const mobileCtaVisible = document.getElementById("mobile-cta-bar")?.classList.contains("is-visible") === true;
  const show = window.scrollY > 500 && !mobileCtaVisible;
  scrollToTopBtn.classList.toggle("is-visible", show);
  scrollToTopBtn.setAttribute("aria-hidden", show ? "false" : "true");
  scrollToTopBtn.tabIndex = show ? 0 : -1;
};

const applyLanguage = async (language, options = {}) => {
  languageSwitchAbort?.abort();
  languageSwitchAbort = new AbortController();
  const { signal } = languageSwitchAbort;

  const resolvedLanguage = resolveLanguage(language);
  const switching = pageContent !== null && currentLanguage !== resolvedLanguage;
  const preservedScrollRatio = switching ? captureScrollRatio() : null;
  if (switching) {
    landingRoot.setAttribute("aria-busy", "true");
    landingRoot.classList.add("is-lang-switching");
    document.body.classList.remove("menu-open");
  }
  currentLanguage = resolvedLanguage;
  try {
    pageContent = await loadContent(currentLanguage, signal);
    await loadLandingBuildMeta();
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }
    throw error;
  }
  renderPage(pageContent);
  landingRoot.classList.remove("is-lang-switching");
  landingRoot.setAttribute("aria-busy", "false");

  document.title = pageContent.meta.title;
  metaDescription?.setAttribute("content", pageContent.meta.description);
  metaKeywords?.setAttribute("content", pageContent.meta.keywords);
  document.documentElement.lang = currentLanguage;
  document.documentElement.dataset.landingLang = currentLanguage;
  document.querySelector('meta[name="application-name"]')?.setAttribute("content", pageContent.brand.company);
  const historyMode = options.historyMode ?? (switching ? "push" : "replace");
  syncLanguageInUrl(currentLanguage, { historyMode });
  syncSocialMeta(pageContent, currentLanguage);
  injectStructuredData(pageContent, currentLanguage);
  syncNoscriptBanner(pageContent);
  updateBuildStamp(pageContent.ui);
  if (landingBuildMeta?.version) {
    document.documentElement.dataset.landingVersion = landingBuildMeta.version;
  } else {
    delete document.documentElement.dataset.landingVersion;
  }
  document
    .getElementById("meta-author")
    ?.setAttribute("content", pageContent.brand.authors || pageContent.brand.company);

  const skipLink = document.getElementById("skip-link");
  if (skipLink && pageContent.ui?.skipToContent) {
    skipLink.textContent = pageContent.ui.skipToContent;
  }

  if (scrollProgress) {
    scrollProgress.setAttribute("role", "progressbar");
    scrollProgress.setAttribute("aria-valuemin", "0");
    scrollProgress.setAttribute("aria-valuemax", "100");
    scrollProgress.setAttribute("aria-valuenow", "0");
    scrollProgress.setAttribute("aria-label", pageContent.ui?.scrollProgressLabel ?? pageContent.ui?.scrollTop ?? "Scroll progress");
  }

  const mobileCtaLink = document.getElementById("mobile-cta-link");
  const mobileCtaAndroid = document.getElementById("mobile-cta-android");
  const mobileCtaVideo = document.getElementById("mobile-cta-video");
  if (mobileCtaAndroid) {
    const androidLabel = pageContent.ui?.mobileCtaAndroid ?? pageContent.hero?.ctaAndroid ?? "Android";
    const androidHint = pageContent.ui?.androidExternalLink ?? "";
    mobileCtaAndroid.textContent = androidLabel;
    mobileCtaAndroid.href = ANDROID_APP_URL;
    mobileCtaAndroid.setAttribute("aria-label", androidHint ? `${androidLabel} — ${androidHint}` : androidLabel);
    mobileCtaAndroid.title = androidHint;
  }
  if (mobileCtaLink) {
    const ctaText = pageContent.ui?.mobileCta ?? pageContent.nav.cta;
    const externalHint = pageContent.ui?.externalLink ?? "";
    mobileCtaLink.innerHTML = `<span>${escapeHtml(ctaText)}</span><svg class="app-external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`;
    mobileCtaLink.setAttribute("aria-label", externalHint ? `${ctaText} — ${externalHint}` : ctaText);
    mobileCtaLink.title = externalHint;
  }
  if (mobileCtaVideo) {
    if (!VIDEO_SECTION_ENABLED) {
      mobileCtaVideo.hidden = true;
    } else {
      mobileCtaVideo.hidden = false;
      const videoLabel = pageContent.ui?.mobileCtaVideo ?? pageContent.video?.eyebrow ?? "Demo";
      mobileCtaVideo.innerHTML = `${heroCtaIconSvg("demo")}<span>${escapeHtml(videoLabel)}</span>`;
      mobileCtaVideo.classList.add("mobile-cta-link-with-icon");
      const prefix = pageContent.ui?.sectionNavPrefix;
      mobileCtaVideo.setAttribute("aria-label", prefix ? `${prefix} ${videoLabel}` : videoLabel);
    }
  }

  const langAnnouncer = document.getElementById("lang-announcer");
  if (langAnnouncer && switching && pageContent.ui?.langAnnounced) {
    langAnnouncer.textContent = pageContent.ui.langAnnounced;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }

  bindInteractiveHandlers();
  setupRevealObserver();
  setupVideoInteractions();
  setupMetricCounters();
  prefetchAlternateContent(currentLanguage);
  updateScrollProgress();
  toggleHeaderState();
  toggleScrollToTop();
  toggleMobileCtaBar();
  toggleHeroScrollHint();
  updateActiveNav();
  updateProductJumpNav();
  updateJourneyActiveStep();
  if (window.location.hash && window.location.hash !== "#") {
    scrollToHashTarget();
  } else if (preservedScrollRatio !== null) {
    restoreScrollRatio(preservedScrollRatio);
  }
  syncHashDocumentMeta();
};

let scrollFramePending = false;

const runScrollUiUpdates = () => {
  updateScrollProgress();
  toggleHeaderState();
  toggleScrollToTop();
  toggleMobileCtaBar();
  toggleHeroScrollHint();
  updateActiveNav();
  updateProductJumpNav();
  updateJourneyActiveStep();
  scrollFramePending = false;
};

window.addEventListener(
  "scroll",
  () => {
    if (scrollFramePending) {
      return;
    }
    scrollFramePending = true;
    requestAnimationFrame(runScrollUiUpdates);
  },
  { passive: true },
);

scrollToTopBtn?.addEventListener("click", () => {
  clearPageHash();
  window.scrollTo({ behavior: prefersReducedMotion() ? "auto" : "smooth", top: 0 });
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }
  restorePageFromBfcache();
});

if (typeof window.matchMedia === "function") {
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => {
    syncReduceMotionDataset();
    if (!pageContent) {
      return;
    }
    setupMetricCounters();
    setupRevealObserver();
  });
}

syncReduceMotionDataset();
landingRoot.innerHTML = renderLoading({ loading: "…" });
void applyLanguage(getInitialLanguage()).catch(async () => {
  let ui = { loadError: "Failed to load landing content", retry: "Retry" };
  try {
    ui = (await loadContent(getInitialLanguage())).ui ?? ui;
  } catch {
    // Keep fallback strings when JSON is unavailable.
  }
  landingRoot.innerHTML = renderLoadError(ui);
  landingRoot.setAttribute("aria-busy", "false");
  document.getElementById("landing-retry-btn")?.addEventListener("click", () => {
    landingRoot.setAttribute("aria-busy", "true");
    landingRoot.innerHTML = renderLoading({ loading: "…" });
    void applyLanguage(getInitialLanguage());
  });
});
