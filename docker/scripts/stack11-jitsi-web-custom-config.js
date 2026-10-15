// EliteEW stack11 — appended to /config/config.js on jitsi-web container start.
// Copy: bash docker/scripts/apply-stack11-jitsi-web-custom-config.sh
//
// Apache-2.0 UI de-brand: neutralize Jitsi/8x8 promo endpoints in the Meet client config.
// Engine attribution remains in documentation — do not strip LICENSE from images.
//
// Bridge: official Docker fallback when client colibri-ws does not open (Tauri/WebKit):
// ENABLE_SCTP=1 + openBridgeChannel=datachannel / preferSctp (handbook devops-guide-docker).
// Colibri-ws proxy kept on server for browsers that use it; client prefers SCTP first.
// Media: public ICE via Meet WG UDP-native path — MEET-MEDIA-UDP-NATIVE-PATH.md.

// Signaling: prefer websocket, keep BOSH fallback for Android WebView cases where
// /xmpp-websocket occasionally returns HTTP 200 instead of 101 Upgrade.
config.websocket = 'wss://meet.eliteew.ru/xmpp-websocket';
config.bosh = 'https://meet.eliteew.ru/http-bind';

// WHITEBOARD_ENABLED=0 on container; also disable client bundle (excalidraw ~190KB per join).
config.whiteboard = config.whiteboard || {};
config.whiteboard.enabled = false;

// Trial 2026-08-15: SCTP datachannel first (ICE then DTLS/SCTP). Was 'websocket' + preferSctp:false.
config.openBridgeChannel = 'datachannel';

config.bridgeChannel = {
    preferSctp: true,
};

config.p2p = config.p2p || {};
config.p2p.enabled = false;

// EliteEW opens a dedicated call window with JWT; never show prejoin/welcome/recent-meeting prompts.
config.prejoinPageEnabled = false;
config.prejoinConfig = config.prejoinConfig || {};
config.prejoinConfig.enabled = false;
config.enableWelcomePage = false;
config.welcomePage = config.welcomePage || {};
config.welcomePage.disabled = true;
config.disableDeepLinking = true;
config.enableClosePage = false;

// STUN/TURN: coturn listens on Yandex VM (158.x). stack12 VPN DNS maps meet.eliteew.ru → LAN;
// useStunTurn=true fetches TURN via XMPP extdisco to dead meet.eliteew.ru:3478 on punisher —
// ICE gather stalls ~2m35s, zero candidates trickle over colibri-ws (JVB PT2M35S expire).
config.useStunTurn = false;
config.iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

config.webrtcConfig = config.webrtcConfig || {};
// Do not pre-gather: pool=10 delayed trickle on some Chrome/Android builds in this stack.
config.webrtcConfig.iceCandidatePoolSize = 0;

// VP8 first: better Quest / mixed-browser bridges than H264-only simulcast paths.
config.codecPreferenceOrder = ['VP8', 'VP9', 'H264', 'AV1'];
config.videoQuality = config.videoQuality || {};
config.videoQuality.codecPreferenceOrder = ['VP8', 'VP9', 'H264', 'AV1'];
config.videoQuality.enableAdaptiveMode = true;

// Public path: RTP via Yandex VM UDP→TCP→SSH relay (high jitter). Keep bitrates conservative;
// allow simulcast + layer suspension so BWE can drop quality instead of buffering.
config.enableLayerSuspension = true;
// Tunnel path (UDP→TCP→SSH): one video layer — меньше пакетов и джиттер.
config.disableSimulcast = true;
config.channelLastN = 1;
config.resolution = 180;
config.constraints = config.constraints || {};
config.constraints.video = config.constraints.video || {};
config.constraints.video.height = { ideal: 180, max: 240, min: 144 };
config.constraints.video.frameRate = { ideal: 10, max: 15, min: 5 };
config.videoQuality.vp8 = config.videoQuality.vp8 || {};
config.videoQuality.vp8.maxBitratesVideo = {
    low: 60000,
    standard: 120000,
    high: 180000,
};
config.videoQuality.vp9 = config.videoQuality.vp9 || {};
config.videoQuality.vp9.maxBitratesVideo = {
    low: 60000,
    standard: 120000,
    high: 180000,
};
config.startBitrate = '120';
config.minBitrateForVideo = 50000;
config.videoQuality.maxbitrates = { video: { VP8: 180000, H264: 180000 } };

// EliteEW: rooms open only with API JWT (?jwt=). Keycloak password login on meet is not supported.
config.enableUserRolesBasedOnToken = true;
config.requireDisplayName = false;

config.startWithAudioMuted = false;
config.startWithVideoMuted = false;
config.startAudioMuted = 0;
config.startVideoMuted = 0;

// Embedded GAF calls: fewer background polls/reactions.
config.disablePolls = true;
config.disableReactions = true;

// No Gravatar: API JWT often has email but omits OAuth-protected EliteEW avatars;
// Jitsi would otherwise hash email → gravatar.com (noise 404s in the Meet iframe).
config.gravatar = config.gravatar || {};
config.gravatar.disabled = true;

// --- EliteEW UI de-brand / no third-party Meet chrome (Apache-2.0 allowed) ---
config.disableDeepLinking = true;
config.analytics = {};
config.dynamicBrandingUrl = undefined;
config.brandingDataUrl = undefined;
config.inviteServiceUrl = undefined;
config.peopleSearchUrl = undefined;
config.dialInNumbersUrl = undefined;
config.dialInConfCodeUrl = undefined;
config.dialOutAuthUrl = undefined;
config.dialOutRegionUrl = undefined;
config.jaasActuatorUrl = undefined;
config.jaasTokenUrl = undefined;
config.jaasConferenceCreatorUrl = undefined;
config.jaasFeedbackMetadataURL = undefined;
config.webhookProxyUrl = undefined;
config.billingCounterUrl = undefined;
config.recordingSharingUrl = undefined;
config.sipInviteUrl = undefined;
config.chromeExtensionBanner = undefined;
config.salesforceUrl = undefined;
config.microsoftApiApplicationClientID = undefined;
config.googleApiApplicationClientID = undefined;
config.faceLandmarks = config.faceLandmarks || {};
config.faceLandmarks.enableFaceCentering = false;
config.faceLandmarks.enableFaceDetection = false;
