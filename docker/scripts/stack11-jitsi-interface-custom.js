// EliteEW stack11 — appended to /config/interface_config.js (see docker-jitsi /etc/cont-init.d/10-config).
// Meet is JWT-only from EliteEW API; Keycloak/app password login on this site does not work.
//
// Apache-2.0 UI de-brand: hide Jitsi/8x8 watermarks and promos in the Meet chrome.
// Required attribution for the engine stays in documentation (INTERNAL-VIDEO-CALLS /
// STACK11-JITSI-11031-UPGRADE) — do not strip LICENSE from images.

/* eslint-disable no-unused-vars */
interfaceConfig.APP_NAME = 'EliteEW Meet';
interfaceConfig.NATIVE_APP_NAME = 'EliteEW Meet';
interfaceConfig.PROVIDER_NAME = 'Empery World';

// Do not show Prosody username/password form (auth.meet.eliteew.ru internal accounts only).
interfaceConfig.HIDE_LOGIN_PAGE = true;
interfaceConfig.MOBILE_APP_PROMO = false;
interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE = false;

// Watermarks / powered-by (legacy interface_config keys still honored by some builds).
interfaceConfig.SHOW_JITSI_WATERMARK = false;
interfaceConfig.SHOW_WATERMARK_FOR_GUESTS = false;
interfaceConfig.SHOW_BRAND_WATERMARK = false;
interfaceConfig.SHOW_POWERED_BY = false;
interfaceConfig.JITSI_WATERMARK_LINK = 'https://app.eliteew.ru';
interfaceConfig.BRAND_WATERMARK_LINK = 'https://app.eliteew.ru';
interfaceConfig.BRAND_WATERMARK_LINK_TARGET = '_self';

// No store / download / third-party support chrome.
interfaceConfig.HIDE_INVITE_MORE_HEADER = true;
interfaceConfig.DISPLAY_WELCOME_FOOTER = false;
interfaceConfig.DISPLAY_WELCOME_PAGE_ADDITIONAL_CARD = false;
interfaceConfig.DISPLAY_WELCOME_PAGE_CONTENT = false;
interfaceConfig.DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT = false;
interfaceConfig.GENERATE_ROOMNAMES_ON_WELCOME_PAGE = false;
interfaceConfig.MOBILE_DOWNLOAD_LINK_ANDROID = '';
interfaceConfig.MOBILE_DOWNLOAD_LINK_F_DROID = '';
interfaceConfig.MOBILE_DOWNLOAD_LINK_IOS = '';
interfaceConfig.MOBILE_DYNAMIC_LINK = {};
interfaceConfig.SUPPORT_URL = '';
interfaceConfig.POLICY_LOGO = null;
interfaceConfig.DEFAULT_LOGO_URL = '';
interfaceConfig.DEFAULT_WELCOME_PAGE_LOGO_URL = '';
