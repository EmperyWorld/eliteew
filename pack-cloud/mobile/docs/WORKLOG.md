> **Канон scale/chrome (0.2.97+):** [`documentation/product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md`](../../../documentation/product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md).<br>
> **Канон сессии 2026-05-28 (premium UI + OTA, 0.2.6→0.2.20):** `MOBILE-ANDROID-UI-SESSION-2026-05-28.md` (historical reference; absent from this checkout). Ниже — хронологический build log.

## 2026-09-28 — Firebase Git hygiene

- Убрана tracked Firebase-конфигурация; WireGuard parser fixture больше не содержит private-key-подобное значение; paths: `app/google-services.json`, `app/src/test/java/world/empery/mobile/MobilePrivateTunnelConfigStoreTest.kt`; build: `./gradlew :app:testProdDebugUnitTest --tests world.empery.mobile.MobilePrivateTunnelConfigStoreTest --no-daemon` — BUILD SUCCESSFUL; ADB: устройств нет.

## 2026-09-03 — Content library list thumbs: honor `thumbnail_url` only

- Cause: list/songs/player probed `/thumbnail` without `thumbnail_url` → edge 404 storm; download fallback after miss hammered Seaweed.
- Fix: `allowsStoredThumbnailFetch` / `storedThumbnailAbsoluteUrl`; library + songs artwork + media tracks + favorites gate on URL; no mime probe; no `/download` fallback.
- Paths: `ContentApiContracts.kt`, `ContentLibraryPreviewSupport.kt`, `UgsSongsUi.kt`, `UgsSongsScreen.kt`, `MobileContentLibraryScreen.kt`, `MusicPlayerFavoritesRepository.kt`; docs CONTENT-* + GUIDELINES + WORKLOG.
- Сборка: `JAVA_HOME=/usr/lib/jvm/java-25-openjdk ./gradlew :feature:ugs:testDebugUnitTest --tests 'feature.ugs.ContentLibraryPreviewSupportTest' :core:network:testDebugUnitTest --tests 'world.empery.mobile.core.network.ContentApiContractsTest'` — BUILD SUCCESSFUL. ADB: не ставил.

## 2026-08-17 — UGS Songs: W7 taste/disclosure + W8 rewrite-lyrics

- W7: capabilities `taste_profile_*`; progressive «Настройки звучания»; taste banner when likes &gt; 0.
- W8: `POST music-forge/runs/{id}/rewrite-lyrics`; forge history `list_profile=full` for `music_forge_run_id`; action sheet CTA.
- Paths: `MusicForgeApiContracts.kt`, `ContentApiContracts.kt`, `MusicForgeMobileSupport.kt`, `UgsSongsScreen.kt`, `UgsSongsUi.kt`.
- Tests: `MusicForgeApiContractsTest`, `MusicForgeMobileSupportTest` (Gradle on command-center with JDK 21).

## 2026-07-22 — UGS Songs: MusicForge Mode picker (`mode_key` + capabilities)

- Cause: mobile create lag vs desktop Wave D — no `GET capabilities` / `mode_key` on Songs path.
- Fix: Retrofit `getCapabilities` + optional `mode_key` on create; Songs UI Mode chips from `modes[]` / `default_mode_key`.
- Paths: `core/network/.../MusicForgeApiContracts.kt`, `feature/ugs/MusicForgeMobileSupport.kt`, `UgsSongsScreen.kt`; canon `MUSIC-FORGE-APP.md`.
- Сборка: `./gradlew :core:network:testDebugUnitTest --tests '*MusicForgeApiContracts*' :feature:ugs:testDebugUnitTest --tests '*MusicForgeMobileSupport*' :feature:ugs:compileDebugKotlin` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-18 — UGS Songs: XL Base lyrics flag + suggest keyscale

- Cause: mobile `/lyrics` без `target_ugs_workflow=v2_base` → API не включал XL lyrics prompt/gate; keyscale брался только локально.
- Fix: `MusicLyricsRequest.target_ugs_workflow`; `MusicLyricsResponse.xl_base_valid`; `runUgsSongGeneration` шлёт `v2_base` и берёт `suggest.keyscale`.
- Paths: `core/network/.../MusicApiContracts.kt`, `feature/ugs/UgsSongsScreen.kt`; docs: `MOBILE-ANDROID-GUIDELINES.md`, `MUSIC-FORGE-APP.md`.
- Сборка: `./gradlew :core:network:compileDebugKotlin :feature:ugs:compileDebugKotlin` — BUILD SUCCESSFUL. API: `pytest tests/test_music_forge_algorithm.py` — 15 passed. ADB: не ставил.

## 2026-07-17 — OTA 0.2.195 (205): session survive OTA + azp guard + call push signed-out

- Cause: post-OTA refresh raced private-tunnel NetworkGuard on auth bootstrap; wrong-client tokens; FCM muted all traffic when `!hasSession`.
- Fix: auth bootstrap without NetworkGuard; upgrade reconcile waits for CONNECTED; `MobileAccessTokenClientGuard` (empery-mobile azp); incoming call FCM allowed signed-out.
- Tests: `MobileAccessTokenClientGuardTest`, `MobileUpgradeSessionReconcilePolicyTest`, `MobilePushDeliveryPolicyTest`.

## 2026-07-17 — OTA 0.2.194 (204): private-tunnel auto-heal + profile cache

- Cause: Secure Connection could leave VpnService without `tun0`; one-shot cold-start did not heal; Profile stayed empty while tunnel deferred (Wi‑Fi looked “online”).
- Fix: authenticated auto-heal with backoff + `shellAutoHealSuppressed` after user Stop; CONNECTED-only EliteEW online; Room profile hydrate; ringtone silent/dedupe (carry).
- Tests: `MobilePrivateTunnelRecoveryPolicyTest`, `MobilePrivateTunnelConnectivityTest`.
- Doc: `MOBILE-ANDROID-PRIVATE-TUNNEL.md` Seamless Tunnel Recovery.

## 2026-07-16 — OTA 0.2.192 (202): SSO redirect + embedded refresh

- Cause ship: Keycloak host-form redirect + native-owned embedded SPA refresh.
- `versionCode=202` / `versionName=0.2.192`; RU notes updated; history upserted by publish.
- Cycle: `mobile-apk-release-cycle.sh --yes --all` — APK/OTA prod-core parity OK; TG blocked (SSH host key change `93.77.167.208`).
- Сборка: `assembleProdRelease` via eemobile. ADB: устройств нет.

## 2026-07-16 — Keycloak SSO: redirect canonicalize + native-owned embedded refresh

- Cause: AppAuth wire redirect `scheme://oauth2redirect` vs Keycloak path-form only → `invalid_redirect_uri`; embedded SPA + native both refreshed same RT → reuse exceeded.
- Fix: `MobileOAuthRedirectUris` + pending wire redirect on exchange; `EmperyMobileNativeOidc.refreshSessionJson()` sole refresh owner for embedded SPA.
- Сборка: `./gradlew :core:auth:testDebugUnitTest --tests '*MobileOAuthRedirectUris*' --tests '*MobileSsoEnvironment*'` — BUILD SUCCESSFUL. ADB: устройств нет (install skip).

## 2026-07-16 — Hardened residual: TabHostNavGraph atomization

- Cause: `TabHostNavGraph.kt` god-file **812→157** (≤800 / ideal ≤600); public `TabHostAuthenticatedNav` + NavHost route/deeplink strings preserved.
- New siblings: `TabHostNavUgsRoutes`, `TabHostNavRootTabRoutes`, `TabHostNavFriendsRoutes`, `TabHostNavProfileRoutes`.
- Doc: perfection plan §0 — all residual >800 hosts closed.
- Сборка: `./gradlew :app:compileProdDebugKotlin :app:testProdDebugUnitTest --tests '*TabHost*' --tests '*Nav*' --tests '*MobileShell*' --tests '*MobileBackStack*' --tests '*MobileRoute*' --tests '*MobileDeepLink*'` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-16 — Hardened residual: FeedFeature atomization

- Cause: `FeedFeature.kt` god-file **910→190** (≤800 / ideal ≤600); public `EwDeskFeedScreen` API preserved for nav / TabHostNavGraph.
- New siblings: `FeedUiModels`, `FeedRepository`, `FeedChromeSections`, `FeedPostSections`.
- Doc: perfection plan §0 Hardened residual Feed slice (LOC before/after) + residual next = TabHostNavGraph ~812.
- Сборка: `./gradlew :feature:feed:compileDebugKotlin :feature:feed:testDebugUnitTest` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-16 — Hardened residual: DesktopHubFeature atomization

- Cause: `DesktopHubFeature.kt` god-file **1403→434** (≤800 / ideal ≤600); public `DesktopHubScreen` API preserved.
- New siblings: `DesktopHubUiModels`, `DesktopHubRepository`, `DesktopStoreAppSupport`, `DesktopHubChromeSections`, `DesktopHubEntrySections`, `DesktopHubWidgetSections`, `DesktopHubStoreSection`.
- Doc: perfection plan §0 Hardened residual slice (LOC before/after) + residual next = FeedFeature 910 / TabHostNavGraph 812.
- Сборка: `./gradlew :feature:desktop:compileDebugKotlin :feature:desktop:testDebugUnitTest` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-16 — W4 U3 friends shared honesty + U4 embedded SPA polish

- Cause U3: friend detail shared-content section showed fake `0 · 0` counts while loading (empty scaffold). Phases via `resolveFriendSharedContentPhase` — loading card without counts; honest empty/error/ready; timeline still hidden when no timestamps. DEBT-SH-07 Closed.
- Cause U4 (Decision §8 A): Handbook empty chat hid desktop Feedback Hub `requestOpenDesktopApp` CTA + keyboard FAQ hints on embedded; EWA empty gateway compact (`embeddedMobile` → Agentic+Media only). Native companion deferred.
- Paths: `FriendDetailTimelineSupport.kt`, `FriendDetailSharedSections.kt`, friends strings RU/EN; FE `AssistantChatMessageList.tsx`, `CompanionMasterDashboard.tsx`, empty-state/transcript bundle wiring; perfection/debt/parity/embedded UI-style docs.
- Lock: `:feature:friends:testDebugUnitTest` timeline/shared phases; Vitest handbook empty + EWA gateway embedded + contract tests.
- Сборка: `./gradlew :app:compileProdDebugKotlin :feature:friends:compileDebugKotlin` + `:feature:friends:testDebugUnitTest --tests 'feature.friends.FriendDetailTimelineSupportTest'` — BUILD SUCCESSFUL. FE: `pnpm exec biome check --write` + Vitest 4 files / 20 tests. ADB: устройств нет.

## 2026-07-16 — W4 U5 chat unread SSOT + U6 Notifications bottom tab

- Cause U5: list header chip used `count { unread > 0 }` while tab badge used `sumOf { unread }` — drift. SSOT `totalChatUnreadCount` in `feature/chat/ChatUnreadAggregation.kt`; ChatFeature/ChatListPane/TabHostChrome derived.
- Cause U6: Decision §8 — Notifications first-class bottom/rail tab (`RootTab.Notifications`); deeplink `tab=notifications` opens tab directly; unread badge SSOT on Notifications tab; Feed bell remains shortcut with same count.
- Paths: `MobileRouteRegistry`, `MobileShellNavigation`, `MobileBackStackPolicy`, `TabHostNavGraph`/`TabHostChrome`, `NotificationFeature` (hide back/context strip on tab), strings RU/EN, debt/parity/perfection/push registry.
- Lock: `ChatUnreadAggregationTest`; `MobileRouteRegistry*` / `MobileShell*` / `MobileBackStack*` / `MobileDeepLink*` / `*Notification*` / `*Chat*` unit tests.
- Сборка: `./gradlew :app:compileProdDebugKotlin :feature:chat:compileDebugKotlin :feature:notifications:compileDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobileShell*' --tests '*MobileDeepLink*' --tests '*Chat*' --tests '*Notification*'` + `:feature:chat:testDebugUnitTest --tests '*ChatUnread*'` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-16 — W4 U2 Social Hub nested action-center

- Cause: DEBT-SH-01 / perfection U2 — operator (A) nested route, not inline-only; dedicated `friends/action-center` with hub primary CTA + deeplink/push extras.
- Routes: `friends/action-center`; URI `/nav/friends/action-center`, `?nested=action-center`, `focus=action_center`; FCM `EXTRA_FRIENDS_NESTED_ROUTE`.
- Paths: `FriendsDeepLinkSupport.kt`, `FriendsRelationshipActionCenterScreen.kt`, `FriendsActionCenterEntryCard.kt`, `TabHostNavGraph.kt`, `MobileDeepLinks`/`Router`/`PushNavigation`/`SessionNavigationBridge`/`MobileRouteRegistry`/`MobileBackStackPolicy`, debt/parity/perfection/push registry docs.
- Сборка: `./gradlew :app:compileProdDebugKotlin :feature:friends:compileDebugKotlin` + `:app:testProdDebugUnitTest --tests '*Friends*' --tests '*MobileDeepLink*' --tests '*MobileShell*'` + `:feature:friends:testDebugUnitTest` — BUILD SUCCESSFUL. ADB: устройств нет.

## 2026-07-16 — W1 slice #9 Profile C4 atomization

- Cause: god `ProfileTabViewModel` (2038) + `ProfileFeature` (2001) blocked safe Profile/OTA/security changes; split into composition controllers + UI section files; public API stays on ProfileTabViewModel / ProfileScreen wiring.
- New (app): `profile/ProfileSessionBag`, `ProfileOtaUpdateController`, `ProfileTrustedDeviceController` + Support, `ProfilePrivateTunnelController`, `ProfileSupportDiagnosticsController`, `ProfileIdentityController`; host `ProfileTabViewModel` **2038→230**.
- New (feature): `ProfileUiModels`, `ProfileSecuritySections`, `ProfileHeroSections`, `ProfileRepositoryAndAvatar`; `ProfileFeature` **2001→752**.
- Lock: `ProfileTrustedDeviceSupportTest` (tunnel metadata); existing `*Profile*` / `*MobileShell*` / `:feature:profile:testDebugUnitTest`.
- Сборка: `./gradlew :app:compileProdDebugKotlin :feature:profile:compileDebugKotlin` + `:app:testProdDebugUnitTest --tests '*Profile*' --tests '*MobileShell*'` + `:feature:profile:testDebugUnitTest` — BUILD SUCCESSFUL. ADB: устройств нет.
- W1 residual Profile closed; perfection plan §0 W1 → Done.

## 2026-07-16 — W1 slice #8 MainViewModel ≤600

- Cause: remaining fat in `MainViewModel` (realtime event host, FG/BG lifecycle, hosts, logout, deeplink store, UI models) extracted into composition helpers; public API stays on MainViewModel.
- New: `RealtimeSessionHost` (367), `MainViewModelSessionHosts` (217), `ShellDeeplinkStore` (52), `LogoutSessionFacade` (76), `MobileShellUiModels` (48).
- Paths: `MainViewModel.kt` 933→**588** (ideal ≤600 Done), perfection plan §0 W1 slice #8.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*Chat*' --tests '*MobileShell*' --tests '*MobilePrivateTunnel*' --tests '*SsoLoginLaunchShell*' --tests '*BiometricAuthCoordinator*' --tests '*MobileDeepLink*'` — BUILD SUCCESSFUL. ADB: устройств нет.
- Residual: ProfileTabViewModel still open; W1 otherwise Activity+MainViewModel arch targets met.

## 2026-07-16 — W1 slice #7 ChatSessionController composition

- Cause: split god `ChatSessionController` (1921) into composition pieces each ≤800; facade keeps public API for MainViewModel/Activity.
- New: `ChatSessionBag` (231), `ChatInboxSession` (791), `ChatSendPendingController` (331), `ChatAttachmentIo` (352), `ChatRealtimeReduce` (306); facade `ChatSessionController` 1921→171.
- Paths: `pack-cloud/mobile/app/.../chat/*.kt`, perfection plan §0 W1 slice #7 LOC table.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*Chat*' --tests '*MobileShell*' --tests '*MobilePrivateTunnel*' --tests '*SsoLoginLaunchShell*' --tests '*BiometricAuthCoordinator*'` — BUILD SUCCESSFUL. ADB: устройств нет.
- Residual: MainViewModel 933 (ideal ≤600); ProfileTabViewModel still open.

## 2026-07-16 — W1 slice #6 MainViewModel composition atomization

- Cause: extracted chat/SSO/biometric/perimeter from god `MainViewModel` into owned controllers; MainViewModel remains public API host with thin delegates (Activity/shell call sites stable; no deeplink/route contract change).
- New: `chat/ChatSessionController.kt` (1921), `session/SsoAuthSessionController.kt` (240), `security/BiometricUnlockSessionFacade.kt` (142), `shell/PerimeterTunnelSessionFacade.kt` (150).
- Paths: `MainViewModel.kt` 2904→933, perfection plan §0 W1 slice #6 LOC table.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobileShell*' --tests '*MobilePrivateTunnel*' --tests '*BiometricAuthCoordinator*' --tests '*SsoLoginLaunchShell*' --tests '*MobileDeepLink*' --tests '*Chat*'` — BUILD SUCCESSFUL. ADB: no device.
- Next: split `ChatSessionController` (still &gt;800) toward ≤800; MainViewModel ideal ≤600.

## 2026-07-16 — W1 slice #5 MobileRoot + permission shell extract

- Extracted `MobileRoot` + logout dialog → `shell/MobileRootScaffoldHost.kt` (674); permission launchers/dialogs/banners → `shell/MobilePermissionShell.kt` (269); OAuth/deeplink stay in `MainActivity`.
- Lock: `MobilePermissionShellTest` (`resolveCoreAppPermissionPrompt`); deferred prompts while private-tunnel bootstrap blocked (same as pre-split).
- Paths: `MainActivity.kt`, `shell/MobileRootScaffoldHost.kt`, `shell/MobilePermissionShell.kt`, perfection plan §0 LOC table.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobileShell*' --tests '*MobileDeepLink*' --tests '*SsoLoginLaunchShell*' --tests '*MobilePrivateTunnel*' --tests '*BiometricAuthCoordinator*' --tests '*MobilePermissionShell*'` — BUILD SUCCESSFUL. MainActivity 1329→557 LOC. ADB: no device.

## 2026-07-16 — W1 slice #4 TabHost split + GAF overlay host

- Split god `TabHostCoordinator` (~1437) into `TabHostCoordinator` facade (68), `TabHostChrome` (579), `TabHostNavGraph` (767), `TabHostNavSupport` (124); routes/deeplinks unchanged.
- Extracted GAF Meet overlays from `MainActivity` → `shell/GafVideoCallOverlayHost.kt` (213); `GafVideoCallCoordinator` untouched.
- Paths: `shell/TabHost*.kt`, `shell/GafVideoCallOverlayHost.kt`, `MainActivity.kt`, perfection plan §0 LOC table.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobileShell*' --tests '*MobileDeepLink*' --tests '*MobileBackStack*' --tests '*SsoLoginLaunchShell*' --tests '*MobilePrivateTunnel*'` — BUILD SUCCESSFUL. MainActivity 1441→1329 LOC. ADB: no device.

## 2026-07-16 — W1 slice #3 TabHostCoordinator extract

- Extracted tab hosting from `MainActivity`: `shellNavigation` apply + deeplink fan-out, bottom/rail chrome, NavHost routes, EW hub menu/media overlays → `shell/TabHostCoordinator.kt` (`TabHostShellNavigationEffect`, `rememberTabHostChromeState`, `TabHostAuthenticatedNav`, chrome helpers).
- AuthSessionGate / TunnelShellBridge / permission launchers / GAF overlays stay Activity-owned; deeplink contracts unchanged.
- Paths: `pack-cloud/mobile/app/src/main/java/world/empery/mobile/shell/TabHostCoordinator.kt`, `MainActivity.kt`, perfection plan W1 tracker.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobileShell*' --tests '*MobileDeepLink*' --tests '*MobileBackStack*' --tests '*SsoLoginLaunchShell*'` — BUILD SUCCESSFUL. MainActivity 2517→1441 LOC.

## 2026-07-16 — W1 slice #2 TunnelShellBridge extract

- Extracted private-tunnel cold-start / connectivity / status banners from `MainActivity` into `shell/TunnelShellBridge.kt` (`rememberTunnelShellBridge` + `TunnelShellConnectivityBanners`); VPN permission launchers stay Activity-owned.
- Paths: `pack-cloud/mobile/app/src/main/java/world/empery/mobile/shell/TunnelShellBridge.kt`, `MainActivity.kt`, perfection plan W1 tracker.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*MobilePrivateTunnel*' --tests '*MobileSyncStorm*'` — BUILD SUCCESSFUL.

## 2026-07-16 — W2 release signingConfigs wiring

- Conditional `signingConfigs.release` from env / `local.properties` (`MOBILE_RELEASE_*` / `mobile.android.release.*`); CI still uses debug via `-Pmobile.android.ci=true`; without keystore → no signingConfig override.
- Paths: `pack-cloud/mobile/app/build.gradle.kts`, `pack-cloud/mobile/docs/SIGNING-PLAN.md`, perfection plan W2 Partial.
- Сборка: `./gradlew :app:tasks --group signing` + `:app:signingReport` — BUILD SUCCESSFUL (no keystore on host).

## 2026-07-16 — Dedup auth gate screens from MainActivity

- Removed duplicate `BiometricUnlockScreen` / `LoginRequiredScreen` from `MainActivity.kt` (canonical copies in `shell/AuthSessionGate.kt`); `OfflineBanner` / `RefreshableRoute` kept.
- Paths: `pack-cloud/mobile/app/src/main/java/world/empery/mobile/MainActivity.kt`.
- Сборка: `./gradlew :app:compileProdDebugKotlin` + `:app:testProdDebugUnitTest --tests '*SsoLoginLaunchShell*' --tests '*BiometricAuthCoordinator*'` — BUILD SUCCESSFUL.

## 2026-07-16 — W4 U1 EWDesk feed pull-to-refresh (lock + docs)

- Cause already in shell: Feed tab `RefreshableRoute` + `feedVm::refresh` (same path as stale/error retry); no FeedFeature API change.
- Lock: `FeedPullRefreshAuditTest`; DEBT-X-01 / parity B2 / plan U1 marked Mitigated/Done.
- Paths: `app/src/test/.../FeedPullRefreshAuditTest.kt`, `documentation/product/mobile/MOBILE-ANDROID-*-{DEBT-REGISTER,PRODUCT-PERFECTION-PLAN,FEATURE-PARITY-MATRIX,UX-PARITY-CHECKLIST}.md`.
- Сборка: `./gradlew :app:compileProdDebugKotlin --no-daemon -q` + `:app:testProdDebugUnitTest --tests '*FeedPullRefreshAuditTest*'` — BUILD SUCCESSFUL.

## 2026-07-15 — OTA 0.2.182 (192) Chat interface polish

- Prod release + OTA: `0.2.182` (192), sha256 `19d540331795e806e36f383c79e9726bb9ad007ee45b7c88695194d534500eb3`; prod-core OTA and API meta parity OK.
- Includes Elite list softening, empty/composer copy polish; ships theme/friends avatar fixes from `6b426d99`.
- Paths: `feature/chat/*`, `app/build.gradle.kts`, `docs/RELEASE-NOTES-*`, `local/binaries/empery-mobile.*`.
- Сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --prod-core --smoke` — BUILD SUCCESSFUL (~2m).

## 2026-07-15 — OTA 0.2.181 (191) Friends DDD + interface-audit remediation

- Prod release + OTA: `0.2.181` (191), sha256 `d5f23e36298124e47896abf70ed0680ae6e567b602a2a261bf3f065aff93dab7`; prod-core OTA and API meta parity OK.
- Includes Friends DDD SSOT + audit P0–P2 (biometric StayLocked, feed copy/stale, Friends IA, notifications filter-empty).
- Paths: `app/build.gradle.kts`, `docs/RELEASE-NOTES-*.ru.*`, `local/binaries/empery-mobile.*`.
- Сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --prod-core --smoke` — BUILD SUCCESSFUL (~2m).
- **ADB:** устройств нет.

## 2026-07-15 — OTA 0.2.180 (190) Chat Identity & Audio Prestige

- Prod release + OTA: `0.2.180` (190); premium-contextual Elite chat + deep ringtone/soft-tap + stream fade; prod-core OTA and API meta parity OK.
- Paths: `app/build.gradle.kts`, `docs/RELEASE-NOTES-*.ru.*`, `local/binaries/empery-mobile.*`.
- Сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --prod-core --smoke` — BUILD SUCCESSFUL.
- **ADB:** устройств нет.

## 2026-07-15 — Chat Identity & Audio Prestige

- Elite chat is premium-contextual: 28dp partner avatar, bold sender name, medium body, 0.5dp group dividers (alpha 0.1), and a vertical thread-line — still no bubbles.
- Ringtone/notification replaced with deep soft dual-tone + soft-tap OGG (~6 KB / ~4.5 KB); notification channels bumped to `empery_*_v4`.
- Media stream handoff (Wi-Fi ↔ cellular) fades volume out/in around ExoPlayer re-prepare to avoid pops.
- Paths: `feature/chat/ChatVisualStrategy.kt`, `ChatMessageRow.kt`, `ChatMessageVisualChrome.kt`, `ChatMessageTimeline.kt`, `core/media/EmperyMediaPlaybackFade.kt`, `EmperyMediaPlayerController.kt`, `app/res/raw/*.ogg`, `EmperyNotificationSoundChannels.kt`, tests.
- Сборка: `./gradlew :feature:chat:testDebugUnitTest :core:media:testDebugUnitTest :app:testProdDebugUnitTest --tests 'world.empery.mobile.push.EmperyNotificationSoundChannelsTest' --no-daemon` — BUILD SUCCESSFUL.

## 2026-07-15 — OTA 0.2.179 (189) identity/social re-engineering

- Prod release build + OTA publish + prod-core deploy: `0.2.179` (189), sha256 `5bf36c0e7385…`; prod-core OTA and API meta parity OK.
- Paths: `app/build.gradle.kts`, `docs/RELEASE-NOTES-user.ru.txt`, `docs/RELEASE-NOTES-history.ru.json`, `local/binaries/empery-mobile.*`.
- Сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --prod-core --smoke` — BUILD SUCCESSFUL (~2m).
- **ADB:** устройств нет.

## 2026-07-15 — All-flavor CI gate (identity/social wave closeout)

- CI-equivalent Gradle proof for `stage`/`prod`/`tunnelBeta`: unit tests, lint (debug + prodRelease), and debug APK assembly — BUILD SUCCESSFUL.
- Paths: `.github/workflows/mobile-android-ci.yml`, handbook §11 CI, device smoke template flavors.
- Сборка: `./gradlew :app:testStageDebugUnitTest :app:testProdDebugUnitTest :app:testTunnelBetaDebugUnitTest :app:lintStageDebug :app:lintProdDebug :app:lintTunnelBetaDebug :app:lintProdRelease :app:assembleStageDebug :app:assembleProdDebug :app:assembleTunnelBetaDebug --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** устройств нет.

## 2026-07-15 — Biometric fail-safe coordinator

- Optional biometric privacy gate now has one Activity-owned prompt, single-flight generation protection, typed terminal outcomes, and safe teardown; any non-success resumes only an existing SSO session, without PIN/device credential, token mutation, or reauthentication.
- Paths: `app/.../security/{BiometricAuthCoordinator,AppBiometricUnlockGate,AppBiometricUnlockPolicy,SafeAuthResult}.kt`, `MainActivity.kt`, `MainViewModel.kt`, RU/EN strings, JUnit/Robolectric tests.
- Сборка: `./gradlew :app:testProdDebugUnitTest --tests 'world.empery.mobile.security.AppBiometricUnlockPolicyTest' --tests 'world.empery.mobile.security.BiometricAuthCoordinatorTest' --tests 'world.empery.mobile.security.BiometricAuthCoordinatorRobolectricTest' --no-daemon` — BUILD SUCCESSFUL.

## 2026-07-15 — Premium structural GAF Chat

- `ChatFeature.kt` reduced from 3138 to 466 lines; list, thread, timeline, row, attachment, composer, and motion policy now have focused production owners below 800 LOC.
- Elite structural timeline is the unset/unknown default: sender/body hierarchy, 0.5dp dividers, zero-elevation message/reply/composer chrome, and system/profile reduce-motion support; explicit Standard remains available.
- Paths: `feature/chat/src/main/java/feature/chat/Chat*.kt`, `core/ui/.../{ChatVisualStyle,LocalChatVisualStyle}.kt`, RU/EN strings, strategy and Robolectric Compose tests.
- Сборка: `./gradlew :feature:chat:testDebugUnitTest :feature:chat:compileDebugKotlin --no-daemon` — BUILD SUCCESSFUL.

## 2026-07-15 — Friends DDD and profile decoupling

- Friends now follows `DefaultFriendsRepository` → focused domain use cases → feature-owned `FriendsTabViewModel` → split UI; app retains only composition/factory wiring and root FQNs remain compatibility aliases.
- Profile privacy circles use core `FriendCirclesProvider`; background sync, offline warmup, incoming-call, and video-call paths use focused Friends use cases. Room schema, auth, tokens, and tunnel behavior are unchanged.
- Paths: `core/{network,storage}` Friends boundaries, `feature/friends/{data,domain,presentation}`, `feature/profile/ProfileFeature.kt`, app composition/call sites, unit/Robolectric integration tests.
- Сборка: `./gradlew :feature:friends:testDebugUnitTest :feature:friends:compileDebugKotlin :feature:profile:testDebugUnitTest :feature:profile:compileDebugKotlin --no-daemon` и targeted app test/compile — BUILD SUCCESSFUL.

## 2026-07-14 — Security & Stability Lockdown

- Removed `dev` / `tg` product flavors; retained `stage`, `prod`, `tunnelBeta`. CI → `lintProdDebug` / `testProdDebugUnitTest`.
- `SecureTokenStore` fail-closed: no RAM phantom session; `SecurityStorageException` → AuthRepository force logout on save failure; empty recreate after corruption; Robolectric uses MODE_PRIVATE prefs only.
- Tunnel Logcat: endpoint/DNS/address only under `BuildConfig.DEBUG`; release uses redacted lifecycle lines.
- Room `exportSchema=true` + `core/storage/schemas/` (kapt `room.schemaLocation`; v9 JSON checked in).
- Paths: `app/build.gradle.kts`, `SecureTokenStore`, `AuthRepository`, `MobilePrivateTunnelManager`, `MobileDatabase`, CI/README/handbook.
- Сборка: `./gradlew :core:auth:testDebugUnitTest :core:storage:testDebugUnitTest :app:testProdDebugUnitTest :app:compileProdDebugKotlin -Pmobile.android.ci=true --no-daemon` — BUILD SUCCESSFUL.

## 2026-07-14 — Sync Storm Suppression

- `MobileSyncStormGuard` (AtomicLong): 15s heavy debounce; staggered follow-up after 5s post-CHAT.
- Resume: CONNECTED → immediate CHAT; +5s LIGHT (`staggeredFollowUp`); MainActivity delays `refreshAllTabs` 5s in private mode.
- Paths: `sync/MobileSyncStormGuard.kt`, `BackgroundSyncWorker`, `MobileSyncScheduler`, `MobilePrivateTunnelRecoveryCoordinator`, `tabs/TabViewModelRefresh`, `MainActivity`, unit tests, canon docs.
- Сборка: `./gradlew :app:testProdDebugUnitTest --tests 'world.empery.mobile.MobileSyncStormGuard*' --tests 'world.empery.mobile.MobilePrivateTunnel*' :app:compileProdDebugKotlin -Pmobile.android.ci=true --no-daemon`.

## 2026-07-14 — Seamless Tunnel Recovery

- Hard cutover: session OkHttp `cancelAll` + `evictAll` on leave-CONNECTED / RETRYING (`MobilePrivateTunnelRecoveryCoordinator`); auth bootstrap client excluded.
- Sync flush: `BackgroundSyncWorker` tunnel defer → bounded `Result.retry()`; CONNECTED → FCM + force LIGHT sync; immediate WM backoff 15s exponential.
- UI: shell `secure_connection_reestablishing_banner` for CONNECTING / WAITING_EDGE / RETRYING (suppresses Offline chrome overlap).
- Paths: `tunnel/MobilePrivateTunnelRecovery{Policy,Coordinator,HttpCutover}.kt`, `di/AppContainer.kt`, `MobileApp.kt`, `sync/{BackgroundSyncWorker,MobileSyncScheduler}.kt`, `MainActivity.kt`, strings, unit tests, canon docs.
- Сборка: `./gradlew :app:testProdDebugUnitTest --tests 'world.empery.mobile.MobilePrivateTunnel*' :app:compileProdDebugKotlin -Pmobile.android.ci=true --no-daemon`.

## 2026-07-14 — Iron-Link User Connection Lifecycle

- C1: `UnauthorizedRetryInterceptor` + `AccessTokenRefreshResult` — transient refresh (IO/timeout) no longer calls `onTerminalAuthFailure`; session kept + OfflineBanner via `transientAuthNetworkDeferral`.
- C2: FCM data-only always posts local notification (`displayNotificationFromDataOnly`); no background `startActivity` reliance.
- C3: Shell `RealtimeStatusBanner` for socket Disconnected/Reconnecting/Connecting.
- C4: `SecureTokenStore` process-local memory fallback when EncryptedSharedPreferences unavailable.
- C5: `IdempotentGetRetryInterceptor` (GET, up to 2 retries) wired in `NetworkFactory`.
- Paths: `core/network/AuthAwareHttp.kt`, `IdempotentGetRetryInterceptor.kt`, `NetworkFactory.kt`, `core/auth/{AuthRepository,SecureTokenStore}.kt`, `app/.../push/MobileFirebaseMessagingService.kt`, `MainViewModel.kt`, `MainActivity.kt`, strings, unit tests.
- Сборка: `./gradlew :core:network:testDebugUnitTest --tests 'world.empery.mobile.core.network.Unauthorized*' --tests 'world.empery.mobile.core.network.Idempotent*' --tests 'world.empery.mobile.core.network.NetworkFactoryAuth*' :core:auth:testDebugUnitTest :app:compileProdDebugKotlin --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** устройств нет.

## 2026-07-14 — Secure Connection Waves 2–4 (traffic-ready / MTU / rotate-wg)

- Status gate: `WAITING_EDGE` + `RETRYING`; fail-closed until `CONNECTED`; edge TCP probe after `setState(UP)`; bounded reconnect; `MTU` in WG config; `rotate-wg` client path.
- Paths: `app/.../tunnel/MobilePrivateTunnel{Manager,UserCopy,StartupGate}.kt`, `trusteddevice/MobileTrustedDeviceKeyStore.kt`, `tabs/ProfileTabViewModel.kt`, `feature/profile/{ProfileFeature.kt,strings}`, `core/network/.../MobileAppApiContracts.kt`, unit tests.
- Сборка: `./gradlew :core:network:testDebugUnitTest --tests MobileAppApiContractsTest :feature:profile:compileDebugKotlin :app:compileProdDebugKotlin :app:testProdDebugUnitTest --tests 'world.empery.mobile.MobilePrivateTunnel*' --tests 'world.empery.mobile.MobileTrustedDeviceKeyStoreTest' -Pmobile.android.ci=true --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** не проверялось.

## 2026-06-30 — DesktopApiContracts unclosed KDoc (compile unblock)

- `DesktopApiContracts.kt`: закрыты KDoc-блоки (`*/`) над `DesktopShellStateDto` и `DesktopShellStatePatchBody` — без них Kotlin считал остаток файла комментарием и падал с `Unclosed comment` на EOF (~строка 301).
- Paths: `core/network/.../DesktopApiContracts.kt`.
- Сборка: `./gradlew :core:network:compileDebugKotlin :feature:profile:testDebugUnitTest --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** не проверялось.

## 2026-06-30 — T17 Friends referral invite (feature/friends)

- DEBT-X-06: `friends_referral_*` RU strings in `values/strings.xml`; EN mirror in `values-en/strings.xml`; `FriendsReferralInviteSection` compiles with `MobileScaleChromePolicy`; API via `FriendsRepository.loadReferralInvite()` → `GET friends/referral`.
- Paths: `feature/friends/src/main/res/values/strings.xml`, `values-en/strings.xml`.
- Сборка: `./gradlew :feature:friends:compileDebugKotlin :feature:friends:testDebugUnitTest --tests 'feature.friends.FriendsReferral*' --tests 'feature.friends.FriendsOfflineRefresh*' --no-daemon` — BUILD SUCCESSFUL.
- `:app:testProdDebugUnitTest --tests MobileDeepLinkRouterTest` — blocked by unrelated `MainActivity` SSO compile (`prepareSsoLoginLaunchIntent`).
- **ADB:** не проверялось.

## 2026-06-30 — Gradle compile unblock (T16/T03/T11b)

- `MainViewModel.consumePendingEmbeddedSpaDeepLink`: заменён `MutableStateFlow.getAndUpdate` (нет в текущей coroutines) на read-and-clear по образцу `consumeDeeplinkRecoveryFlag`.
- Paths: `app/.../MainViewModel.kt`.
- Сборка: `./gradlew :app:compileProdDebugKotlin :core:network:compileDebugKotlin --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** не проверялось.

## 2026-06-30 — T02 Desktop Hub (feature/desktop)

- DEBT-AND-02/06: fixed deeplink lazy-column indices (`DesktopHubLazyColumnIndices`); RU theme labels; config PATCH theme cycle + shell quiet-mode PATCH; Medium+ section quick-jump chips; `LocalMobileWindowLayout` width gate.
- Paths: `feature/desktop/{DesktopHubFeature,DesktopHubLogic,DesktopHubDeepLinkSupport}.kt`, `DesktopHubTabViewModel.kt`, `strings.xml`.
- Сборка: `./gradlew :feature:desktop:testDebugUnitTest --tests 'feature.desktop.DesktopHub*'` — BUILD SUCCESSFUL.
- **ADB:** устройств не проверялось.

## 2026-06-30 — T01 Social Hub / Friends (feature/friends)

- DEBT-SH-01: expanded `FriendsRelationshipActionCenterSection` — KPI overview, inbox signals, stale-contact heuristics (30d/7d), grouped attention friends; scale via `rememberMobileScaleChromePolicy()` + `LocalMobileWindowLayout`.
- DEBT-SH-07: `FriendDetailScreen` timeline + shared-context + `GET social-hub/friends/{id}/shared-content`; `FriendsTabViewModel.loadFriendSharedContent`.
- Paths: `feature/friends/{FriendsRelationshipActionCenterSection,FriendDetailScreen,FriendDetailSharedSections,FriendDetailTimelineSupport,FriendsRelationshipActionCenterSupport}.kt`, `FriendsFeature.kt`, `FriendsTabViewModel.kt`, `strings.xml`.
- Сборка: `./gradlew :feature:friends:testDebugUnitTest --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** устройств нет.

## 2026-06-30 — T06 EWDesk Feed (feature/feed)

- Richer EWDesk post cards: shared `FeedMarkdownBody`, scale-aware hero aspect (4:3 / 16:9), read-time meta, unified `FeedUriHandler` for desktop-open links → store app ids (`GAFChatApp`, `UGSHubApp`, …).
- Full post screen: hero video/image/audio + Markdown body; internal link routing fixes nested paths (`EliteEwShellSettings/performance` → root component id).
- Paths: `feature/feed/{FeedFeature,FeedMarkdownRender,FeedUriHandler,FeedInternalLinkRouting,FeedFullPostScreen,EwDeskFeedHeroMedia}.kt`, tests `FeedMarkdownRenderTest`, `FeedInternalLinkRoutingTest`.
- Сборка: `./gradlew :feature:feed:testDebugUnitTest --no-daemon` — BUILD SUCCESSFUL.
- **ADB:** устройств нет.

## 2026-06-30 — T07 Notification Center (feature/notifications)

- Nested Notification Center: in-feature `MobileActiveContextStrip` (EWDesk/Profile parent copy), scale-aware header/filter chips/list rows; deeplink focus via `NotificationDeepLinkSupport.resolveNotificationDeepLinkFocus` + scroll index with group headers.
- Paths: `feature/notifications/NotificationFeature.kt`, `NotificationDeepLinkSupport.kt`, `strings.xml`; docs: parity matrix §5, DEBT-AND-04 residual.
- Сборка: `./gradlew :feature:notifications:testDebugUnitTest --no-daemon`.
- **ADB:** устройств нет.

## 2026-06-30 — T10 UGS Songs / Music XL scale + non-blocking generation

- **UGS Songs (XL Base):** форма «Создать» — `MobileScaleChromePolicy` (COMFORT/large font: `FlowRow` для языка/голоса, `labelMedium` chips, pipeline pill скрывается при stacking); генерация и загрузка списка на `Dispatchers.IO`; `PremiumLoadingCard` во время XL pipeline; playback через `EmperyMediaPlayerHolder`.
- Paths: `feature/ugs/UgsSongsScreen.kt`, `feature/ugs/UgsSongsUi.kt`, `feature/ugs/MusicXlPipelineSupport.kt`, `feature/ugs/src/test/java/feature/ugs/MusicXlPipelineSupportTest.kt`; docs §6 parity в `documentation/product/mobile/MOBILE-ANDROID-FEATURE-PARITY-MATRIX.md`, `MOBILE-ANDROID-GUIDELINES.md`, `MOBILE-ANDROID-SCALE-CHROME-POLICY.md`.
- Сборка: `./gradlew :feature:ugs:compileDebugKotlin`, `./gradlew :feature:ugs:testDebugUnitTest` — OK (assemble не запускался).

## 2026-06-30 — OTA 0.2.172 (182): SSO session replace + push after logout

- **Login loop:** mobile SSO callback now handles `session_replace_confirmation_required` (dialog «Заменить активную сессию?» + `X-SSO-Replace-Confirm` on retry), clearer errors for `session_replaced`.
- **Push while logged out:** `DELETE profile/mobile-push-token` on logout; FCM handler skips UI when `hasSession()` is false.
- Paths: `AuthRepository.kt`, `MainViewModel.kt`, `MainActivity.kt`, `MobileFirebaseMessagingService.kt`, `ProfileApiContracts.kt`, `ProfileFeature.kt`.
- OTA publish prod-core parity OK after `assembleProdRelease`.
- **ADB:** устройств нет.

## 2026-06-30 — OTA 0.2.171 (181): AI-чат — переключатель «Веб-поиск»

- UGS AI-чат (`UgsAiChatDetailScreen`): `FilterChip` «Веб-поиск» над composer; в `POST …/stream` уходит `use_web_search` + `use_tools` (solo contract).
- Контракт: `DesktopAiStreamBody` в `core/network/.../DesktopAiChatApiContracts.kt`; тест сериализации в `DesktopAiChatApiContractsTest`.
- Bump `versionCode=181` / `versionName=0.2.171`; release notes `docs/RELEASE-NOTES-user.ru.txt`.
- OTA: `mobile-apk-release-cycle.sh --yes --publish --prod-core --smoke --skip-lint` (после `assembleProdRelease`); prod-core parity OK.
- APK SHA-256 `de9f17b6f86c24c3df588202906a39c5bc60a2e4473996b231fe0b1ab57c30dd`; paths: `UgsAiChatDetailScreen.kt`, `DesktopAiChatApiContracts.kt`, `feature/ugs/.../strings.xml`.
- **ADB:** устройств нет.

## 2026-06-22 — OTA 0.2.170 (180) prod-core channel

- Bump `versionCode=180` / `versionName=0.2.170`; release notes `docs/RELEASE-NOTES-user.ru.txt`.
- Full cycle: `eemobile --yes --all --skip-lint` — assembleProdRelease, publish, prod-core OTA `:29180`, dev-bind frontend sync, TG deploy-sync, smoke parity OK.
- APK SHA-256 `1a3edc287a9fa9b697295f7beec63a190126d674c89cc33d991efc6640dc0b3`; paths: `app/build.gradle.kts`, `local/binaries/empery-mobile.manifest.json`.
- **ADB:** не проверялось.

## 2026-06-21 — EW hub sheet scroll + embedded WebView stability

- EW quick-pick sheet (`MobileShellEwHubMenuSheet`): `verticalScroll` + `heightIn(88% screen)` — нижние пункты (Музыка, AI) больше не обрезаются на маленьких экранах.
- Embedded SPA WebView: `onRenderProcessGone` → error overlay вместо «тихого» белого экрана; `clearCache(true)` только на «Повторить», не при каждом открытии.
- Professional Worlds mobile nav rail: `overflow-x-auto` вместо `overflow-hidden` на sidebar panel.
- Paths: `app/.../shell/MobileShellEwHub.kt`, `feature/desktop/EmperyMobileEmbeddedSpaWebViewActivity.kt`, `shared/web/frontend/.../professionalWorldsLayoutTokens.ts`.
- Сборка: `./gradlew :app:assembleProdDebug :feature:desktop:compileDebugKotlin --no-daemon`; **ADB:** `adb install -r app/build/outputs/apk/prod/debug/app-prod-debug.apk` на `AMUCCP2B14215411`.


- Профиль → Оформление: одна карточка `ProfileAppearanceSection` (стиль, яркость, масштаб, фон, комфорт); Профиль → Уведомления/Обновления упрощены ранее в этой волне.
- OTA `release_notes`: канон `docs/RELEASE-NOTES-user.ru.txt`, правило `.cursor/rules/mobile-android-release-notes.mdc`, publish читает RU user copy.
- OTA prod-core: **0.2.112 (122)** — SHA-256 `6bdf2c6bca1401c6f8947b0a22bca38dd71e239878a40a42f4d7d8981b7ffba1`; `./gradlew :feature:profile:compileDebugKotlin :app:assembleProdRelease -Pmobile.android.ci=true`; `mobile-apk-release-cycle.sh --yes --publish --prod-core --smoke`.

## 2026-06-17 — OTA 0.2.99 (109) flagship mobile release

- Backend/API reliability: Friends/Social Hub notifications now trigger best-effort data-only FCM fallback when no live mobile Socket.IO session exists; stale Android FCM tokens are pruned on permanent FCM failures; `DELETE profile/mobile-push-token` unregisters current-user tokens; OTA overview/manifest exposes `published_at`, `release_notes`, and `min_supported_version_code`.
- Mobile UX: Feed education cards auto-hide when locally known milestones are complete; Friends gained a Social Hub Command Center; Profile uses real OTA release notes and min-supported urgency; UGS errors use shared `MobileErrorState`; hot LazyRows gained content types.
- OTA prod-core: **0.2.99 (109)** — APK SHA-256 `595b1fbe90feea1a7003213c0e520a1781d9dcc53dc09a5181daf4400fb7a665`; release notes in manifest; deploy via `bash docker/scripts/deploy-prod-core-mobile.sh --yes --ota`; prod-core manifest, public `/mobile-app/`, unauth download `401`, and public API health smoke OK.
- Checks: Ruff format/check; stack0 API focused tests `24 passed`; Android core + feature unit tests; `./gradlew :app:lintDevDebug :app:lintProdRelease :app:testDevDebugUnitTest :app:assembleDevDebug --no-daemon`; `bash scripts/validate-version-bump.sh && ./gradlew :app:lintProdRelease :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`; `adb devices` shows no devices, so Maestro smoke blocked.

## 2026-06-17 — OTA 0.2.98 (108) professional UI + context polish

- Feed education rail moved to localized production copy and shared `PremiumGlassCard` chrome; paths: `app/src/main/java/world/empery/mobile/MainActivity.kt`, `app/src/main/java/world/empery/mobile/education/MobileEducationCardsStub.kt`, `app/src/main/res/values*/strings.xml`.
- Nested Notifications / UGS tools / Desktop Hub now show `MobileActiveContextStrip` so users keep parent context when they are inside stacked routes; Friends and Chat empty states use shared `MobileEmptyState`; Friends request/friend rows gained keyed `animateItem()` motion. Paths: `MainActivity.kt`, `feature/friends/.../FriendsFeature.kt`, `feature/chat/.../ChatFeature.kt`.
- OTA prod-core: **0.2.98 (108)** — APK SHA-256 `8b183d9df22b8d719e649e460a6aee4c5d5a71b7d9842fc67e352cc82dc05845`; deploy via `bash docker/scripts/deploy-prod-core-mobile.sh --yes --ota`; prod-core manifest and public `/mobile-app/` smoke OK.
- Сборка/проверки: `./gradlew :core:ui:testDebugUnitTest :feature:feed:testDebugUnitTest :feature:chat:testDebugUnitTest :feature:friends:testDebugUnitTest :feature:desktop:testDebugUnitTest :feature:ugs:testDebugUnitTest :feature:profile:testDebugUnitTest :feature:notifications:testDebugUnitTest :app:testDevDebugUnitTest --no-daemon`; `./gradlew :app:lintDevDebug :app:lintProdRelease :app:assembleDevDebug --no-daemon`; `bash scripts/validate-version-bump.sh && ./gradlew :app:lintProdRelease :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`; `git diff --check`. **ADB: устройств нет; Maestro smoke blocked.**

## 2026-06-17 — auth/session hardening + durable chat outbox + education cards

- Mobile SSO callback no longer accepts token exchange without persisted local session; logout sends refresh token in JSON body; paths: `app/src/main/java/world/empery/mobile/{MainViewModel.kt,MobileAuthSessionPolicy.kt}`, `core/auth/.../AuthRepository.kt`, `core/network/.../AuthApiContracts.kt`; сборка: `./gradlew :core:network:testDebugUnitTest :core:auth:testDebugUnitTest :core:storage:testDebugUnitTest :core:ui:testDebugUnitTest :feature:feed:testDebugUnitTest :feature:chat:testDebugUnitTest :feature:friends:testDebugUnitTest :app:testDevDebugUnitTest --no-daemon`, `./gradlew :app:assembleDevDebug :app:lintDevDebug --no-daemon`. **ADB: устройств нет.**
- Chat pending sends are persisted in Room (`chat_pending_sends`, DB v7) and restored as retry-able bubbles after process restart; paths: `core/storage/.../MobileDatabase.kt`, `feature/chat/.../ChatRepository.kt`, `app/.../MainViewModel.kt`; сборка: same commands above.
- Feed shows dismissible first-session education cards backed by `MobileFeatureShellPreferences`; client-only Friends referral stub removed until backend invite contract exists; paths: `app/.../MainActivity.kt`, `app/.../education/MobileEducationCardsStub.kt`, `feature/feed/.../FeedFeature.kt`, `feature/friends/.../FriendsReferralInviteStub.kt`; сборка: same commands above.

## 2026-06-14 — OTA 0.2.97 (107) scale/chrome polish across main tabs

- Единая политика `MobileScaleChromePolicy` (COMPACT/STANDARD/COMFORT + system font): icon-only actions, subtitle hiding, touch-target compensation, wrapped filter chips.
- **EWDesk:** убраны `PremiumHeroHeader` и header refresh; только notifications icon + filters + posts; pull-to-refresh через shell.
- **Desktop Hub:** один `TopAppBar` (без duplicate hero); scale-aware store rows (`DesktopStoreSecondaryAction`).
- **Chat / UGS / Friends / Profile / Notifications:** compact headers, ellipsis, quick actions скрыты при large scale.
- Shared: `PremiumSectionCard`, `PremiumHeroHeader`, `ScaledActionButtons`, `MobileTouchTarget`.
- Канон: [`MOBILE-ANDROID-SCALE-CHROME-POLICY.md`](../../../documentation/product/mobile/MOBILE-ANDROID-SCALE-CHROME-POLICY.md); session: `documentation/worklog/session-summaries/2026-06-14-1449-mobile-ui-polish-all-scales.md`.
- OTA prod-core: **0.2.97 (107)** — SHA-256 `53d78b5a9b928c8df6e01954942070407bc7a7898f57b8af79eb041185c02ece`.
- Сборка: `./gradlew :core:ui:testDebugUnitTest :feature:feed:testDebugUnitTest :feature:chat:testDebugUnitTest :feature:desktop:testDebugUnitTest :feature:ugs:testDebugUnitTest :feature:friends:testDebugUnitTest :feature:profile:testDebugUnitTest :feature:notifications:testDebugUnitTest :app:assembleProdRelease`; `bash docker/scripts/mobile-apk-release-cycle.sh --yes --skip-lint --build --publish --prod-core --smoke`. **ADB: не проверялось.**

## 2026-06-14 — GAF / unified content upload timeout (300s)

- Вложения GAF и avatar больше не обрываются OkHttp 30s: `contentUploadRetrofit` (300s) для `UnifiedContentApi` и `ProfileApi`; paths: `app/.../di/AppContainer.kt`; сборка: `./gradlew :app:compileDevDebugKotlin`. **ADB: не проверялось.**


- Push/deeplink `tab=desktop` / `tab=ugs` + `nested=desktop` + query `section`/`desktop_section`/`hub_section` (aliases `store`, `notes`, `todos`, …) открывает Desktop Hub и прокручивает к секции; FCM/NotificationHelper extras `EXTRA_DESKTOP_HUB_SECTION`; `DesktopHubDeepLinkSupport.resolveDesktopHubSectionFromKey()` + `DesktopHubScreen` LazyList scroll; `SessionNavigationBridge` сохраняет все поля `ShellNavigationIntent` (profile/friends/chat/desktop section); OTA publish+smoke — SHA-256 `da7e66d05033ccd80238146eff8954c26c6a880fff84f2ac6e913963730fbd77`; paths: `DesktopHubDeepLinkSupport.kt`, `DesktopHubFeature.kt`, `DesktopHubTabViewModel.kt`, `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `SessionNavigationBridge.kt`, `MainActivity.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:desktop:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.61 (71) UGS nested deeplink + Social Hub overview tap

- Push/deeplink `tab=ugs` + query `nested`/`route`/`ugs_route` (aliases `chat`, `desktop`, `songs`, …) открывает вкладку AI и nested NavHost (`ugs/chat`, `ugs/desktop`, …); legacy `tab=desktop` по-прежнему → `ugs/desktop`; FCM/NotificationHelper extras `EXTRA_UGS_NESTED_ROUTE`; `UgsDeepLinkSupport.coerceUgsNestedRoute()`; tap на overview KPI **Mobile Social Hub** раскрывает inbox при свёрнутом списке и наличии items (`FriendsTabViewModel.expandSocialHubInbox`); OTA publish+smoke — SHA-256 `decbb6612f8e5735940189b1da2018ce0c921b65d4d98a992d80e681ab12f4c2`; paths: `UgsDeepLinkSupport.kt`, `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `MainActivity.kt`, `FriendsTabViewModel.kt`, `FriendsFeature.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:friends:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.60 (70) Social Hub inbox deeplink + Friends attention badge

- Push/deeplink `tab=friends` + `focus=social_hub` + `inbox_item_id` раскрывает Social Hub inbox и подсвечивает строку; inbox item может резолвиться в request/friend detail через `targetFocus()`; badge на вкладке **Друзья** = входящие заявки + inbox actions (`friendsAttentionCount`); FCM/NotificationHelper extras `EXTRA_SOCIAL_HUB_INBOX_ITEM_ID`; OTA publish+smoke — SHA-256 `c9a994c9ca41fa5c99cc22e6c5b27041727f362aded26cf4337b586e15ecbf95`; paths: `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `FriendsTabViewModel.kt`, `FriendsRoadmapSupport.kt`, `FriendsSocialHubSections.kt`, `MobileShellNavigation.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `MainActivity.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:friends:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.59 (69) EWDesk unread badge + Notification Center tab highlight

- Bottom nav / rail: badge на вкладке **EWDesk** при непрочитанных уведомлениях (`feedUnreadNotificationsCount`, `MobileShellNavigation`); nested route `notifications` подсвечивает Feed tab (`isShellTabSelected`); a11y `tab_feed_unread_cd`; OTA publish+smoke — SHA-256 `a700125980fc17f0a6e8d284d82e2df2c79305fc890d21a44a08cdf317562a5d`; paths: `MobileShellNavigation.kt`, `MainActivity.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.58 (68) Friends incoming badge + Profile section deeplink

- Bottom nav / rail: badge на вкладке **Друзья** при входящих заявках (`friendsIncomingCount`, `MobileShellNavigation` BadgedBox, a11y `tab_friends_incoming_cd`); push/deeplink `tab=profile` + `section=` (aliases `updates`/`ota`/`update` и др.) раскрывает категорию Profile и для Updates вызывает `checkForUpdatesIfStale()`; URI `/nav/profile?section=…`; FCM/NotificationHelper extras `EXTRA_PROFILE_SECTION`; OTA publish+smoke — SHA-256 `652263b48bcfdf5e47439999b472565e259023e8693b0f6411202a71265783cd`; paths: `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `MainActivity.kt`, `MobileShellNavigation.kt`, `ProfileDeepLinkSupport.kt`, `ProfileFeature.kt`, `ProfileCategoryAccordion.kt`, `ProfileTabViewModel.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:profile:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.57 (67) GAF chat deeplink focus

- Push/deeplink `tab=chat` + `chat_id` открывает вкладку Чаты и конкретный тред (`ShellNavigationIntent.chatId`, FCM/NotificationHelper extras, `MainActivity` → `refreshChats` + `openChat`); URI `/nav/chat?chat_id=…`; OTA publish+smoke OK — SHA-256 `4d943abee38fad4cc66e7e31bd5d1ae22a23491eab305b75acf26a1b75a8535a`; paths: `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `MainActivity.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.56 (66) notification focus deeplink + circle rename + Social Hub KPI

- Push/deeplink `tab=notifications` + `notification_id` открывает Notification Center с фокусом на элементе (`ShellNavigationIntent.notificationId`, FCM/NotificationHelper extras, `NotificationsTabViewModel.handleDeepLink`); Social Hub overview KPI дополнен счётчиком inbox actions; переименование списков друзей через `PATCH friends/circles/{id}` + диалог в `FriendsCircleManagementSection`; удалён мёртвый `aggregatedTabError` из `MainViewModel`; OTA publish+smoke OK — SHA-256 `29ae7e9b57c4f546a3a005b43a5d2b74f37ba680da2042e1533423295d7c7473`; paths: `MobileDeepLinks.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `NotificationsTabViewModel.kt`, `FriendsSocialHubSections.kt`, `FriendsFeature.kt`, `FriendsTabViewModel.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:friends:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.55 (65) notifications deeplink + Friends privacy preview card

- Push/deeplink `tab=notifications` открывает Notification Center (feed → nested `notifications`) через `MobileBackStackPolicy.applyShellNavigationIntent`; на экране **Друзья** — inline-карточка предпросмотра приватности (`FriendsPrivacyPreviewCard`) с загрузкой при refresh; OTA publish+smoke OK — SHA-256 `ea2a6e9883b4e7c79488ac72515d5df37de3337b4c1112ae2379116f6b1566a7`; paths: `MobileBackStackPolicy.kt`, `MainActivity.kt`, `FriendsSocialHubSections.kt`, `FriendsFeature.kt`, `FriendsTabViewModel.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :feature:friends:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-08 — OTA 0.2.54 (64) Social Hub inbox deeplink + GAF chats/lite

- Wave 9 P2 quick wins: `tab=inbox` → Friends с `friendsFocus=incoming` (FCM, NotificationHelper, `MobileDeepLinkRouter`); список GAF Chat через `GET gaf-chat/chats/lite` вместо полного `/chats`; OTA publish+smoke OK — SHA-256 `950f2c87be18b8d560809078c8af72547f4813ba555b92f5c7d525ba949e8f8f`; paths: `MobileDeepLinks.kt`, `MobileDeepLinkRouter.kt`, `MobileFirebaseMessagingService.kt`, `NotificationHelper.kt`, `FriendsTabViewModel.kt`, `GafChatApiContracts.kt`, `ChatRepository.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:testDevDebugUnitTest :core:network:testDebugUnitTest :feature:friends:testDebugUnitTest`, `./gradlew -Pmobile.android.ci=true :app:assembleProdRelease`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`. **ADB: устройств нет.**

## 2026-06-06 — OTA 0.2.53 (63) chat wide-screen + lint fix

- OTA **0.2.53 (63)**: chat list full-bleed на широком экране (master-detail pane caps); lint `UnspecifiedRegisterReceiverFlag` — `ContextCompat.registerReceiver` для hand-embed; full cycle `mobile-apk-release-cycle.sh --yes --build --publish --stack0 --tg --smoke`; SHA-256 `f71f22722aff463a222c2167ac657464bad71841dd96a242baf2d1db6f0e6e77`; TG deploy-sync done; `/mobile-app/` HTTP 200. Paths: `feature/chat/ChatFeature.kt`, `MainActivity.kt`, `app/build.gradle.kts`.

## 2026-06-06 — Chat wide-screen full-bleed list

- Исправлен баг: на широком окне (≥600dp) список чатов обрывался ~420dp, хотя нижняя навигация и фон тянулись на всю ширину; убраны фиксированные `widthIn` на pane master-detail, список на всю ширину пока чат не открыт; paths: `feature/chat/ChatFeature.kt`, `documentation/product/mobile/MOBILE-ANDROID-ADAPTIVE-LAYOUT.md`; сборка: `./gradlew :feature:chat:compileDebugKotlin`, `./gradlew :app:assembleDevDebug`. **ADB: устройств нет.**

## 2026-06-04 — Large-screen UI scale + OTA 0.2.47

- Отдельный масштаб для планшета/Quest (`MobileLargeScreenUiScale`, Profile → Оформление); phone scale на телефоне без изменений; OTA **0.2.47 (57)**.

## 2026-06-04 — OTA UX simplification + deploy 0.2.46

- Profile → Обновления: убраны pills «на телефоне/сервере», SHA-256, размер APK, «проверка через»; при актуальной версии только «Проверить обновления»; «Установить» только после скачивания доступного обновления (пульсация); paths: `ProfileOtaUpdateSection.kt`, `MobileAppUpdateMessages.kt`, `ProfileRoadmapSupport.kt`, `ProfileTabViewModel.kt`; OTA **0.2.46 (56)** publish+TG+stack0 — SHA-256 `682108daa06dbb157e6dfbc2f40aea371c747abb04c2c2acc59529f420013bf1`.

## 2026-06-04 — Quest SSO WebView + OTA 0.2.45

- Quest/Horizon: in-app Keycloak через `EmperySsoWebViewActivity` (без `com.oculus.browser` panel); paths: `core/auth/{MobileSsoEnvironment,MobileSsoAuthLauncher,EmperySsoWebViewActivity}.kt`, `MobileSsoAuthLauncher` diagnostic log; OTA **0.2.45 (55)** full cycle `mobile-apk-release-cycle.sh --yes --all` — SHA-256 `ad331f37ca9f329381e3672136af70fc2f55ccba77cc3865754f6ecb84de80c7`; TG `deploy-sync done`; stack0-frontend recreate; `/mobile-app/` HTTP 200.

## 2026-06-04 — In-app Keycloak SSO (AppAuth Custom Tabs)

- SSO login больше не открывает внешний браузер: AppAuth + Chrome Custom Tab напрямую на Keycloak (`empery-mobile`, PKCE); обмен code → tokens по-прежнему через `POST /api/v1/auth/sso/callback`; удалён `SsoBrowserPickerDialog`; paths: `core/auth/{MobileKeycloakOidcEndpoints,MobileOidcRuntimeConfig,MobileSsoAuthFactory,OidcAuthManager}.kt`, `app/{AppRuntimeConfig,MainActivity,MainViewModel,di/AppContainer}.kt`, `app/build.gradle.kts`; сборка: `./gradlew :core:auth:testDebugUnitTest :app:testDevDebugUnitTest :app:assembleDevDebug`. **ADB: устройств нет.**
- Prod sideload на Quest 3S (`340YC10GBV124T`): `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true`, `adb install -r app/build/outputs/apk/prod/release/app-prod-release.apk` — Success; SHA-256 `2056f47efe3933de1ca9d51291796928788c0e1e8bca366993e23eafded5bdbe`, APK ~18 MiB, package `world.empery.mobile` v0.2.44 (54).

## 2026-06-04 — GAF chat composer spaces + UI polish + OTA 0.2.44

- GAF chat: local Compose draft + debounced prefs persist (пробелы в composer); UI polish (пузыри, шапка 36dp, FilledIconButton send, dock/composer как UGS); OTA **0.2.44 (54)** full cycle `eemobile --yes --all` — SHA-256 `48579b58ca603020e7bca77e79298cf4ab5b96b2186ef44575b569e9db4c1bd8`; paths: `feature/chat/ChatFeature.kt`, `feature/chat/build.gradle.kts`, `MainViewModel.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all`. **Dev-сборки не использовались.**

## 2026-06-02 — CRASH-04 verify + prod assemble + local OTA publish

- OTA deploy for stability hotfix: bumped `app/build.gradle.kts` to `0.2.43 (53)`, fixed `values-en` missing translations for deeplink/sync banners, then ran `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke`; release manifest now `0.2.43 (53)` with APK SHA-256 `9aa82afa5dc4...`; `mobile-release-stack.sh smoke/status` passed.
- Mobile auth/realtime stability hotfix: bootstrap auth client now bypasses auth interceptors (`NetworkFactory` + `AppContainer`), realtime auth failures use controlled refresh+reconnect before terminal logout, backend Socket.IO reject returns machine-readable reason/action, and support bundle includes session/token-expiry context; paths: `app/src/main/java/world/empery/mobile/MainViewModel.kt`, `app/src/main/java/world/empery/mobile/di/AppContainer.kt`, `core/network/src/main/java/world/empery/mobile/core/network/NetworkFactory.kt`, `core/auth/src/main/java/world/empery/mobile/core/auth/AuthErrorParser.kt`, `feature/profile/src/main/java/feature/profile/ProfileRoadmapSupport.kt`, `shared/api/{services/keycloak_service.py,routers/auth_refresh.py,routers/auth_keycloak.py,routers/socketio_handler.py}`; verification/build: `./gradlew :core:auth:testDebugUnitTest :core:network:testDebugUnitTest`, `./gradlew :app:compileDevDebugKotlin`, `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true`, `bash docker/scripts/mobile-release-stack.sh smoke`.
- CRASH-04 (UGS Hub energy badge `IllegalFormatConversionException`) already fixed in tree `0.2.42 (52)` via `formatUgsEnergyCredits` + `%1$s`; golden prompt target `EWCoderOrchestrator/app/` was wrong — client is `pack-cloud/mobile/`; paths: `feature/ugs/src/main/java/feature/ugs/UgsHubFeature.kt`, `feature/ugs/src/test/java/feature/ugs/UgsEnergyCreditsFormatTest.kt`; сборка: `./gradlew :feature:ugs:testDebugUnitTest --tests feature.ugs.UgsEnergyCreditsFormatTest`, `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true`; local publish: `bash docker/scripts/serve-mobile-apk-tunnel.sh publish` (SHA-256 `43446c98…`); full stack OTA/TG blocked here (no podman/7z) — operator: `eemobile --yes --all` on prod host.

## 2026-05-29 — profile/chat UX polish

- Mobile Social Hub parity: Friends adds an overview action card, Retrofit declares circle create/update/delete plus Social Hub inbox/privacy-preview DTOs, and Profile shows a local privacy visibility preview; paths: `core/network/src/main/java/world/empery/mobile/core/network/api/FriendsApiContracts.kt`, `feature/friends/src/main/java/feature/friends/FriendsFeature.kt`, `feature/profile/src/main/java/feature/profile/ProfileFeature.kt`, `feature/friends/src/test/java/feature/friends/FriendsFeatureMappingTest.kt`; сборка: `./gradlew :core:network:testDebugUnitTest :feature:friends:testDebugUnitTest :feature:profile:compileDebugKotlin`.
- Friends Lite circle membership: `/friends/overview` circle memberships now stay in the live friends UI model, rows show circle badges and the screen has an all/circle filter without Room schema changes; paths: `feature/friends/src/main/java/feature/friends/FriendsFeature.kt`, `feature/friends/src/main/res/values*/strings.xml`, `feature/friends/src/test/java/feature/friends/FriendsFeatureMappingTest.kt`; сборка: `./gradlew :feature:friends:testDebugUnitTest :feature:friends:compileDebugKotlin`, `./gradlew :app:assembleDevDebug`.
- Profile notification toggle move (not published to OTA in this step): moved the push notifications toggle out of Notification Center into Profile as an inline bell action beside refresh/access/logout; Notification Center now focuses on list/refresh only. Paths: `feature/profile/src/main/java/feature/profile/ProfileFeature.kt`, `feature/profile/src/main/res/values*/strings.xml`, `feature/notifications/src/main/java/feature/notifications/NotificationFeature.kt`, `app/src/main/java/world/empery/mobile/MainActivity.kt`; сборка: `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`.
- Profile + GAF Chat UX polish (not published to OTA in this step): Profile inline actions switched to icon-only refresh/logout/access, logout now confirms with yes/no, access opens `https://access.eliteew.ru/`; GAF chat list hides permanent new-chat text field behind a plus action; GAF thread header is compact and composer follows the IME while root bottom nav hides during typing. Paths: `feature/profile/src/main/java/feature/profile/ProfileFeature.kt`, `feature/profile/src/main/res/values*/strings.xml`, `feature/chat/src/main/java/feature/chat/ChatFeature.kt`, `feature/chat/src/main/res/values*/strings.xml`, `app/src/main/java/world/empery/mobile/MainActivity.kt`; сборка: `./gradlew :feature:profile:compileDebugKotlin :feature:chat:compileDebugKotlin :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`.

## 2026-05-28 — release quality gate

- UGS Songs icon actions + topic validation: raised prod OTA version to `0.2.23 (33)`, replaced text Play/Download/Delete buttons with icon-only actions, made Delete red with inline soft confirmation, changed generation CTA to green `Создать песню`, and added local topic validation against empty/profane/obfuscated/prohibited input; paths: `feature/ugs/src/main/java/feature/ugs/UgsSongsScreen.kt`, `feature/ugs/src/main/java/feature/ugs/UgsSongTopicPolicy.kt`, `feature/ugs/src/test/java/feature/ugs/UgsSongTopicPolicyTest.kt`, `feature/ugs/src/main/res/values*/strings.xml`, `feature/ugs/build.gradle.kts`, `app/build.gradle.kts`; сборка: `./gradlew :feature:ugs:testDebugUnitTest`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke`.
- UGS Songs timeout fix: raised prod OTA version to `0.2.22 (32)`, moved UGS protected content download to a 180s authenticated Retrofit client so MP3 downloads do not fail on slow mobile networks at the generic 30s call cap; paths: `app/src/main/java/world/empery/mobile/di/AppContainer.kt`, `app/build.gradle.kts`; сборка: `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true --no-daemon`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --publish --smoke`.
- UGS Songs playback: raised prod OTA version to `0.2.21 (31)`, added explicit Play in song history (authenticated MP3 download → local `ACTION_VIEW`) and made Download save without auto-opening; paths: `feature/ugs/src/main/java/feature/ugs/UgsSongsScreen.kt`, `feature/ugs/src/main/res/values*/strings.xml`, `app/build.gradle.kts`; сборка: `./gradlew :feature:ugs:compileDebugKotlin --no-daemon`, `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke`.
- Mobile release scripts now validate local/OTA manifest integrity before successful smoke; paths: `docker/scripts/mobile-apk-release-cycle.sh`, `docker/scripts/serve-mobile-apk-tunnel.sh`, `docker/scripts/mobile-release-stack.sh`; сборка: `./gradlew clean :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`.
- OTA deploy: prod release `0.2.6 (16)` published to `local/binaries/empery-mobile.apk` and `stack-mobile-release`; SHA-256 `721ac5204742fef1b9fd8fcdcfa02d384e36753bad6544d3dc30d7e28c131c75`; сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke`.
- Warning cleanup: removed redundant app manifest `tools:replace` and made connectivity debounce `FlowPreview` opt-in explicit; paths: `app/src/main/AndroidManifest.xml`, `app/src/main/java/world/empery/mobile/connectivity/ConnectivityObserver.kt`; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`.
- Deep link reliability: legacy `desktop` push/deeplink now preserves nested `ugs/desktop` through `SessionNavigationBridge` and `MainViewModel`; paths: `app/src/main/java/world/empery/mobile/shell/SessionNavigationBridge.kt`, `app/src/main/java/world/empery/mobile/MainViewModel.kt`, `app/src/test/java/world/empery/mobile/shell/SessionNavigationBridgeTest.kt`; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`.
- OTA deploy: deep link reliability fix published as prod release `0.2.6 (16)`; SHA-256 `79be428b97f21d4704445922e1016b3ac80064196f0e904cb352a16715ca2468`; сборка: `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke`.
- Premium UI wave: added shared `core/ui` premium/glass Compose primitives and applied them to app shell, Feed, Notifications, Chat, Friends, Profile/OTA, UGS and Desktop Hub; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; OTA SHA-256 `f6c5be2bfb5d13f7a196ffacff50e70bb6eb84985c45468ee746c564a7e103f2`.
- Premium UI wave 2: extended `core/ui` with section/loading cards and polished Chat thread/composer, UGS AI detail/generator screens, Desktop Hub sections, Feed post cards, Friends error states and Profile settings sections; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; OTA SHA-256 `6e8ee6554c8fc75e9edcddabb7cd8e8263074f3b7a8cc6e666ebf0f2fc8ea1c8`.
- Premium UI wave 3: added shared row surfaces and polished Chat search results, Friends rows, Desktop Hub rows, UGS Hub tool cards, UGS AI chat list and generator result/history cards; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; prod OTA SHA-256 `cbab645834879fc92fe0d8581497fb588c98e16cce40c51b62306f88fc999b94`.
- Premium UI wave 4: made row surfaces configurable for banners, polished Notification Center rows, UGS Hub metric pills, Feed image error placeholders, Profile OTA banners and GAF active-call return bar; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`.
- Premium UI wave 5: polished bottom navigation chrome with glow divider, UGS AI hero picker cards and EWDesk feed audio media rows; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; prod OTA SHA-256 `a399c559c89d46f3694cb89365b3bb0c080a08c710e957c48376bffe52541366`.
- Premium UI wave 6 + version bump: raised Android version to `0.2.7 (17)`, polished shell/offline/snackbar/login states, Friends/Notifications loading, Chat/UGS list cards and Feed cards; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; prod OTA SHA-256 `9fe160cf32b0c8d6b622bb6d21e2942117c5a4efb0969c1d8bb30dcacb49e99b`.
- Premium UI wave 7 + OTA Podman restart: raised Android version to `0.2.8 (18)`, polished Desktop Hub refresh, Feed initial loading, Profile OTA download progress and UGS generator loading states; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`; prod OTA SHA-256 `397ec74591b1eed85888efad96f18ee6d7b79ec1e2ad51c44dc65cf3ae4ff444`; `stack-mobile-release` restarted via Podman and smoke/status passed.
- OTA overview stale fix: `GET /api/v1/mobile-app/overview` excluded from generic Redis response cache so Profile → Updates reads live `0.2.8 (18)` metadata after publish; API restarted and `/api/health` passed; focused test `uv run pytest tests/test_response_cache_exclusions.py -q`.
- Visible Premium UI redesign: raised Android version to `0.2.9 (19)`, added shared spotlight cards and applied them to Feed, UGS Hub, Profile → Updates and Chat list; Feed post titles now use stronger hierarchy; release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke` passed; prod OTA SHA-256 `806e88160b18120c0f48f9db736b157473139e36a01d642f9b07ce7b88698039`; `stack-mobile-release` restarted and smoke/status passed.
- Visible Premium UI completion: raised Android version to `0.2.10 (20)`, finished bottom navigation selected-tile chrome, UGS AI list/detail spotlight surfaces and Chat thread premium composer dock/wider bubbles; focused compile + release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke` passed; prod OTA SHA-256 `c8cece81b66214302f472fe9336fd493ac82d30f2a36007f4b13881b88763cfd`; `stack-mobile-release` restarted and smoke/status passed.
- Remaining-screen Premium UI pass: raised Android version to `0.2.11 (21)`, added spotlight hero/action surfaces to Friends, Notifications, Desktop Hub and UGS Images/Songs/Presentations; focused compile + release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --build --publish --smoke` passed; prod OTA SHA-256 `085c1f19a1edb0673e966c4d3e0eddb925b4ac30537a1c981703c3504b22c209`; `stack-mobile-release` restarted and smoke/status passed.
- Full-deploy Premium UI pass: raised Android version to `0.2.12 (22)`, polished Profile main loading/identity spotlight, EWDesk feed card elevation/radius/glow and UGS Songs/Presentations spotlight CTAs; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `a44ef26c90441f07a4383029d8f54b924337408102aed54cc7fefbe49759ffc4`; `stack-mobile-release` smoke/status passed.
- Quick-launch/list Premium UI pass: raised Android version to `0.2.13 (23)`, enlarged UGS Hub tool CTA cards with descriptions/arrow affordances and strengthened Friends/Notifications list rows, avatars and status badges; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `b87750de6709bd0879ff1b60dde4cbcec4499f87478ef386ab4406fbf5dd87b7`; `stack-mobile-release` smoke/status passed.
- Profile/UGS UI completion pass: raised Android version to `0.2.14 (24)`, replaced old Profile appearance/scale chips with premium choice tiles, enlarged wallpaper previews, polished push setting row and added glow separation to UGS generator history sections; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `831b10b59030c66786c66be3a8bf87e4fe25896b4310e0571cf8a118c7195f28`; `stack-mobile-release` smoke/status passed.
- Compact Premium header correction: raised Android version to `0.2.15 (25)`, reduced shared `PremiumSpotlightCard` height, padding, icon and title scale so section headers no longer consume half the screen; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `01940e58afedb36c8825e7d49dd4901deef6e2da65fbe88bc14d81eb80e214c2`; `stack-mobile-release` smoke/status passed.
- Duplicate top header removal: raised Android version to `0.2.16 (26)`, stopped shared `PremiumSpotlightCard` from rendering duplicated section title/body/icon/metric blocks while preserving useful caller actions; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `e9b210e31330e0e1f465b0b590a477c1fc95da2657a58c94c28b463d7903b43f`; `stack-mobile-release` smoke/status passed.
- UGS AI section UI regression fix: raised Android version to `0.2.17 (27)`, removed broken `PremiumSpotlightCard` shells from UGS Hub/generators/AI chat screens, normalized compact tool cards (icon + title + subtitle) and fixed shared action slot alignment; focused compile passed; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all` updated OTA, `/mobile-app/` frontend/stack0 and TG archive/sync; prod OTA SHA-256 `93cb3259ee321d50c65c83cb26ccd5dac46ddf151ac72b42560ac35c66fe03fc`; `stack-mobile-release` smoke/status passed.
- List/badge/profile polish pass: raised Android version to `0.2.18 (28)`, normalized chat list rows (unread badge on avatar only + tab badge sum), compact friends/AI/notification empty states, profile identity block without duplicate header/id, push toggle moved to notification center, instant wallpaper apply; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all`; prod OTA SHA-256 `bf015d289c32fd349ff61c159e321a0ac100aa68ca46803c24da554c5876a972`.
- UGS Hub tool icon uniformity: raised Android version to `0.2.19 (29)`, removed featured card styling from AI Chat/Images/Desktop Hub so all tool tiles use the same `PremiumIconTile` as Songs/Presentations; scaled icon glyph inside tile by container size; full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all`; prod OTA SHA-256 `af1c9b6349d53875aba68d5581ff7b84119bd8833cea49c1b2996ef3015bd8c5`.
- Mobile songs XL Base only: raised Android version to `0.2.20 (30)`, removed Turbo pipeline picker from UgsSongsScreen; generation always uses XL Base (`v2_base`); full release gate `bash docker/scripts/mobile-apk-release-cycle.sh --yes --all`; prod OTA SHA-256 `ae8166d830ee451bb3e7d33e9470536c6bcd9a9be46236194ea4830a5af597cb`.

## 2026-05-27 — Background sync + connection service (v0.1.4 / code 5)

- EmperyConnectionService, MobileSyncScheduler, FCM sync/calls, socket stays up in background.
- Published to local/binaries for in-app update (no adb).

## 2026-05-27 — In-app APK updates

- Profile → Обновления: check/download/install via `/mobile-app/*`.
- API overview: `version_code`, `version_name` from publish sidecar.

# MobileAndroid — журнал работ

Краткие записи после успешной Gradle-сборки по задачам в Cursor. Формат и исключения: `.cursor/rules/android-mobile-post-build-documentation.mdc`.

---

## 2026-05-28

- **Release quality gate:** GitHub Actions `mobile-android-ci`, strict OTA manifest smoke and publish/status validation; paths: `.github/workflows/mobile-android-ci.yml`, `docker/scripts/mobile-apk-release-cycle.sh`, `docker/scripts/serve-mobile-apk-tunnel.sh`; сборка: `./gradlew :app:lintDevDebug :app:testDevDebugUnitTest :app:assembleProdDebug --no-daemon`.

## 2026-05-27

- **App shell i18n:** MainViewModel/push/auth/tab errors; UGS AI hero nameRes/descRes.
- **UGS + Desktop Hub i18n:** `values-en` UGS; Desktop Hub `strings.xml` RU/EN + `DesktopHubFeature.kt` wiring.
- **Friends + Chat i18n:** `values-en` Friends; Chat `strings.xml` RU/EN, `ChatFeature.kt`/`ChatModels.kt` без hardcoded RU.
- **EWDesk feed i18n:** `FeedFeature.kt`, `EwDeskFeedHeroMedia.kt`, `feature/feed/.../strings.xml` (RU+EN).
- **UI wave 0.2.3:** OTA i18n (`MobileAppUpdateMessages`), notifications back+i18n, shell strings/a11y.

- Push/deeplink: legacy tab `desktop` → вкладка `ugs` + вложенный маршрут `ugs/desktop`; FCM extra и `scheme:/nav/desktop` открывают Desktop Hub. Файлы: `app/.../MobileDeepLinks.kt`, `MainActivity.kt`, `MainViewModel.kt`; тест `MobileDeepLinksTest`.
- UGS Hub: карточка «Рабочий стол» → `ugs/desktop`; экран `DesktopHubScreen` с кнопкой «Назад»; данные грузятся lazy при входе (убран `refreshDesktopHub` из `refreshAll`). Пути: `feature/ugs/UgsHubFeature.kt`, `feature/desktop/DesktopHubFeature.kt`.
- Friends: conditional GET `If-None-Match` для `GET /friends/overview` (304 → кэш Room + последние incoming). `HttpEtagSupport.kt`, `FriendsApiContracts.kt`, `FriendsFeature.kt`.
- Desktop Hub: conditional GET для `config`, `shell-state`, `installed` — `ConditionalGet.kt`, `DesktopApiContracts.kt`, ETag-кэш в `DesktopHubRepository` (`feature/desktop/DesktopHubFeature.kt`).
- Notification Center: delta `GET /profile/notification-center/delta?since=` при известном `lastUpdatedAt` (`ProfileApiContracts.kt`, `NotificationFeature.kt`).
- ViewModel split (частично): tab ViewModels в `app/.../tabs/` (`FeedTabViewModel`, `NotificationsTabViewModel`, …); чат + GAF остаются в `MainViewModel`; после ошибочного удаления chat-методов — восстановление из jadx (см. `documentation/worklog/session-summaries/2026-05-27-0813-mobileandroid-mainvm-chat-gaf-recovery.md`).
- Сборка: `./gradlew :app:assembleDevDebug :app:testDevDebugUnitTest :core:network:testDebugUnitTest`.

## 2026-05-17

- Раздел AI (UGS Hub): экран в стиле профиля — `LazyColumn`, секции `UgsSectionCard`, шапка с обновлением, карточки инструментов, метрики энергии/статистики, провайдеры в одной секции; строки в `feature/ugs/.../values/strings.xml`. Сборка: `./gradlew :feature:ugs:compileDebugKotlin`, `./gradlew :app:assembleDevDebug`.
- AI: убраны провайдеры из UI и запрос `getProvidersStatus` из `refreshSnapshot`; hero-карточка с градиентом; нижняя навигация — `Surface` со скруглением сверху, бордер, `NavigationBarItemDefaults` (filled/outlined иконки по выбранности; лента **Newspaper**/**Forum**, друзья **Group**, профиль **Person**, AI **AutoAwesome**). Пути: `feature/ugs/.../UgsHubFeature.kt`, `app/.../MainActivity.kt`. Сборка: `./gradlew :app:assembleDevDebug`.
- AI-чат: список и диалог героев (`UgsAiChatListScreen`), экран переписки (`UgsAiChatDetailScreen`) — оформление в стиле хаба; строки в `feature/ugs/.../values/strings.xml`; правила `.mdc` — после сборки при `adb devices`=`device` выполнять `adb install -r` dev APK. Сборка/установка: `./gradlew :app:assembleDevDebug`, `adb install -r app/build/outputs/apk/dev/debug/app-dev-debug.apk`.
- AI-чат выбор: нижний лист (`ModalBottomSheet`) для персонажей, поиск по списку чатов, счётчик «Диалоги», обновление в AppBar, CTA в пустом состоянии, подзаголовок в шапке. Файлы: `UgsAiChatListScreen.kt`, `strings.xml`.
- AI-чат UI: переписка — градиент фона, пустое состояние, refresh в AppBar, баннер ошибки отправки, индикатор набора (`TypingDots`), аватар героя у сообщений ассистента; список чатов — затемнение и подпись при `solo_slot_active == false`. Файлы: `UgsAiChatDetailScreen.kt`, `UgsAiChatListScreen.kt`, `strings.xml`.
- AI-чат: перед созданием чата — `AlertDialog` с информированием об ИИ (ограничения, риски, конфиденциальность), кнопки «Создать чат» / «Отмена»; фон переписки — многослойный вертикальный и радиальные градиенты. Файлы: `UgsAiChatListScreen.kt`, `UgsAiChatDetailScreen.kt`, `strings.xml`. Сборка: `./gradlew :feature:ugs:compileDebugKotlin`.
- AI-чат клавиатура: у `MainActivity` в манифесте `android:windowSoftInputMode="adjustResize"` (убирает «зазор» от сочетания adjustPan + `imePadding`); нижняя панель — `windowInsetsPadding(navigationBars ∪ ime)`, док с скруглением сверху, лёгкий ореол у низа переписки. Файлы: `app/.../AndroidManifest.xml`, `UgsAiChatDetailScreen.kt`. Сборка/установка: `./gradlew :app:assembleDevDebug`, `adb install -r …/app-dev-debug.apk`.
- AI-чат фон и IME: список/переписка — `Scaffold(containerColor = Transparent)`, убран локальный многослойный градиент (виден общий `MobileThemeGradientLayer`/обои как на UGS-хабе); поле ввода — **только** `WindowInsets.ime` (без `navigationBars`: область NavHost уже над нижней вкладкой, системный bar учтён у корневой навигации — лишний отступ давал зазор над клавиатурой). Файлы: `UgsAiChatListScreen.kt`, `UgsAiChatDetailScreen.kt`.
- AI-чат: шапки списка/переписки и нижний лист выбора героя — полупрозрачные (`TopAppBar`/`ModalBottomSheet`), чтобы совпадать с глобальным фоном. На маршрутах `ugs/chat*` при открытой клавиатуре (`WindowInsets.ime.getBottom > 0`) нижняя навигация `MainActivity` **скрывается**, чтобы композер стоял сразу над IME (иначе между полем и клавиатурой остаётся высота панели вкладок). Файлы: `MainActivity.kt`, `UgsAiChatListScreen.kt`, `UgsAiChatDetailScreen.kt`.
- Документация: **`product/mobile/ANDROID-UGS-AI-CHAT-IME-AND-NAV.md`** — подробное описание IME, вложенного Scaffold, таблица среды с `adb` (HUAWEI GOA-LX9, Android 12 / API 31, и т.д.). Ссылки добавлены в `documentation/INDEX.md`, `ANDROID-DEVELOPER-HANDBOOK.md` §16, `pack-cloud/mobile/README.md`.

## 2026-05-27 — prod release build + publish (adb install blocked)

- `./gradlew :app:assembleProdRelease -Pmobile.android.ci=true` — OK (`app-prod-release.apk`, 114 MiB, `world.empery.mobile` v0.1.3 / code 4).
- `bash docker/scripts/serve-mobile-apk-tunnel.sh publish` — sidecar + API mount verified.
- `adb devices` empty on host; WiFi candidates `.36`/`.67` refuse `:5555`. Install pending operator ADB pairing/USB.

## 2026-07-15 — Stealth Premium (Waves A+B)

- Biometric unlock with 60s background grace (UI gate; SecureTokenStore untouched).
- Softened message/ringtone OGGs + notification channels v3.
- SplashScreen (black); soft NIC Socket.IO handover; tunnel socket pause/resume with HTTP hard cutover.
- **Superseded 2026-07-15:** Obsidian auto-force on tunnel CONNECTED removed — Profile appearance owns theme.

