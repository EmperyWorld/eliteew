/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile Desktop Hub screen host (Super Roadmap desktop-001…010): scaffold, chrome, and LazyColumn wiring.
 *
 * Invariants:
 * - User-visible strings use `feature.desktop` string resources.
 * - Public [DesktopHubScreen] signature preserved for nav / TabHostNavGraph.
 * - LazyColumn item order must stay aligned with DesktopHubLazyColumnIndices / DesktopHubSectionId.
 *
 * Related:
 * - DesktopHubRepository, DesktopHubEntrySections, DesktopHubWidgetSections, DesktopHubStoreSection
 */
package feature.desktop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.DesktopWidgetTodoDto
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileIconButton
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

// desktop-002 parity checklist: documentation/product/mobile/MOBILE-ANDROID-UX-PARITY-CHECKLIST.md

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DesktopHubScreen(
    state: DesktopHubUiState,
    apiRootUrl: String,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onInstallApp: (String) -> Unit,
    onUninstallApp: (String) -> Unit,
    onCreateNote: (String) -> Unit,
    onDeleteNote: (String) -> Unit,
    onCreateTodo: (String) -> Unit,
    onToggleTodo: (DesktopWidgetTodoDto) -> Unit,
    onDeleteTodo: (String) -> Unit,
    onCreateFavorite: (title: String, url: String) -> Unit,
    onDeleteFavorite: (String) -> Unit,
    onCycleTheme: () -> Unit,
    onToggleQuietMode: () -> Unit = {},
    handoffDraftText: String = "",
    onHandoffDraftChange: (String) -> Unit = {},
    onSaveHandoffDraft: () -> Unit = {},
    onOpenEwaCompanion: () -> Unit = {},
    onOpenHandbook: () -> Unit = {},
    onOpenSocialHub: () -> Unit = {},
    onOpenFeedbackHub: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
    onOpenContentManager: () -> Unit = {},
    onOpenEwDesk: () -> Unit = {},
    onOpenProfessionalWorlds: () -> Unit = {},
    onOpenAppStore: () -> Unit = {},
    onOpenDesktopSettings: () -> Unit = {},
    onOpenStoreApp: (String) -> Unit = {},
    onOpenFavoriteUrl: (String) -> Unit = {},
    focusSectionId: DesktopHubSectionId? = null,
    onFocusSectionConsumed: () -> Unit = {},
) {
    val noteDraft = remember { mutableStateOf("") }
    val todoDraft = remember { mutableStateOf("") }
    val favoriteTitleDraft = remember { mutableStateOf("") }
    val favoriteUrlDraft = remember { mutableStateOf("") }
    val currentThemeLabel = desktopThemeDisplayLabel(state.config?.theme)
    val nextThemeLabel = desktopThemeDisplayLabel(resolveNextDesktopTheme(state.config?.theme))
    val installedCount = state.installedAppIds.size
    val pendingTodos = state.widgetTodos.count { !it.completed }
    val quietMode = state.shellState?.quiet_mode == true
    val quietModeLabel = desktopQuietModeDisplayLabel(state.shellState?.quiet_mode)
    val quietToggleCd = stringResource(R.string.desktop_toggle_quiet_mode_cd, quietModeLabel)
    val themeCycleCd =
        stringResource(
            R.string.desktop_theme_cycle_to_cd,
            currentThemeLabel,
            nextThemeLabel,
        )
    val context = LocalContext.current
    val dashLabel = stringResource(R.string.desktop_value_dash)
    val listState = rememberLazyListState()
    val windowLayout = LocalMobileWindowLayout.current
    val showSectionJumpRow = windowLayout.widthClass >= MobileWindowWidthClass.Medium

    LaunchedEffect(focusSectionId) {
        val section = focusSectionId ?: return@LaunchedEffect
        listState.animateScrollToItem(section.lazyListIndex)
        onFocusSectionConsumed()
    }

    val sectionSpacing = 16.dp
    val gridGap = 12.dp
    val chrome = rememberMobileScaleChromePolicy()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { },
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.mobileMinimumTouchTarget(),
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.desktop_hub_back),
                        )
                    }
                },
                actions = {
                    MobileIconButton(
                        onClick = onRefresh,
                        enabled = !state.isLoading,
                        contentDescription = context.getString(R.string.desktop_error_retry_cd),
                    ) {
                        if (state.isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Outlined.Refresh, contentDescription = null)
                        }
                    }
                    MobileIconButton(
                        onClick = onCycleTheme,
                        enabled = !state.isLoading,
                        contentDescription = context.getString(R.string.desktop_cycle_theme_cd),
                    ) {
                        Icon(Icons.Outlined.Palette, contentDescription = null)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent,
                    scrolledContainerColor = Color.Transparent,
                ),
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(sectionSpacing),
        ) {
            DesktopHubChromeStatsRow(
                currentThemeLabel = currentThemeLabel,
                installedCount = installedCount,
                pendingTodos = pendingTodos,
                stackChrome = chrome.shouldStackChromeActions,
                gridGap = gridGap,
            )

            if (state.isLoading) {
                PremiumLoadingCard(
                    message = stringResource(R.string.desktop_hub_refresh_loading),
                    modifier = Modifier
                        .fillMaxWidth()
                        .semantics {
                            liveRegion = LiveRegionMode.Polite
                            contentDescription = context.getString(R.string.desktop_refresh_in_progress_cd)
                        },
                )
            }

            if (!state.error.isNullOrBlank()) {
                PremiumStateCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .semantics {
                            liveRegion = LiveRegionMode.Assertive
                            isTraversalGroup = true
                        },
                    title = stringResource(R.string.desktop_error_title),
                    message = state.error,
                    icon = Icons.Outlined.Apps,
                    isError = true,
                    action = {
                        ScaledOutlinedButton(
                            onClick = onRefresh,
                            enabled = !state.isLoading,
                            label = stringResource(R.string.desktop_error_retry),
                            icon = Icons.Outlined.Refresh,
                            modifier = Modifier.semantics {
                                contentDescription = context.getString(R.string.desktop_error_retry_cd)
                            },
                        )
                    },
                )
            }

            if (showSectionJumpRow) {
                DesktopHubSectionJumpRow(
                    listState = listState,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(sectionSpacing),
            ) {
                item {
                    DesktopHubRemoteDashboardSection(state = state)
                }
                item {
                    DesktopHubShellStateSection(
                        state = state,
                        quietMode = quietMode,
                        quietToggleCd = quietToggleCd,
                        isLoading = state.isLoading,
                        onToggleQuietMode = onToggleQuietMode,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_ewa_entry_title,
                        subtitleRes = R.string.desktop_ewa_entry_hint,
                        openLabelRes = R.string.desktop_ewa_open_companion,
                        icon = Icons.Outlined.StarBorder,
                        onOpen = onOpenEwaCompanion,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_handbook_entry_title,
                        subtitleRes = R.string.desktop_handbook_entry_hint,
                        openLabelRes = R.string.desktop_handbook_open,
                        icon = Icons.Outlined.MenuBook,
                        onOpen = onOpenHandbook,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_social_hub_entry_title,
                        subtitleRes = R.string.desktop_social_hub_entry_hint,
                        openLabelRes = R.string.desktop_social_hub_open,
                        icon = Icons.Outlined.People,
                        onOpen = onOpenSocialHub,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_feedback_hub_entry_title,
                        subtitleRes = R.string.desktop_feedback_hub_entry_hint,
                        openLabelRes = R.string.desktop_feedback_hub_open,
                        icon = Icons.Outlined.ChatBubbleOutline,
                        onOpen = onOpenFeedbackHub,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_notifications_entry_title,
                        subtitleRes = R.string.desktop_notifications_entry_hint,
                        openLabelRes = R.string.desktop_notifications_open,
                        icon = Icons.Outlined.Notifications,
                        onOpen = onOpenNotifications,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_content_manager_entry_title,
                        subtitleRes = R.string.desktop_content_manager_entry_hint,
                        openLabelRes = R.string.desktop_content_manager_open,
                        icon = Icons.Outlined.FolderOpen,
                        onOpen = onOpenContentManager,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_ewdesk_entry_title,
                        subtitleRes = R.string.desktop_ewdesk_entry_hint,
                        openLabelRes = R.string.desktop_ewdesk_open,
                        icon = Icons.Outlined.Newspaper,
                        onOpen = onOpenEwDesk,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_professional_worlds_entry_title,
                        subtitleRes = R.string.desktop_professional_worlds_entry_hint,
                        openLabelRes = R.string.desktop_professional_worlds_open,
                        icon = Icons.Outlined.Work,
                        onOpen = onOpenProfessionalWorlds,
                    )
                }
                item {
                    DesktopHubHandoffSection(
                        handoffDraftText = handoffDraftText,
                        handoffDraft = state.handoffDraft,
                        onHandoffDraftChange = onHandoffDraftChange,
                        onSaveHandoffDraft = onSaveHandoffDraft,
                    )
                }
                item {
                    DesktopHubConfigSection(
                        state = state,
                        currentThemeLabel = currentThemeLabel,
                        nextThemeLabel = nextThemeLabel,
                        quietModeLabel = quietModeLabel,
                        dashLabel = dashLabel,
                        themeCycleCd = themeCycleCd,
                        isLoading = state.isLoading,
                        gridGap = gridGap,
                        onCycleTheme = onCycleTheme,
                    )
                }
                item {
                    DesktopHubNotesSection(
                        notes = state.widgetNotes,
                        isLoading = state.isLoading,
                        noteDraft = noteDraft,
                        gridGap = gridGap,
                        context = context,
                        onCreateNote = onCreateNote,
                        onDeleteNote = onDeleteNote,
                    )
                }
                item {
                    DesktopHubTodosSection(
                        todos = state.widgetTodos,
                        isLoading = state.isLoading,
                        todoDraft = todoDraft,
                        gridGap = gridGap,
                        context = context,
                        onCreateTodo = onCreateTodo,
                        onToggleTodo = onToggleTodo,
                        onDeleteTodo = onDeleteTodo,
                    )
                }
                item {
                    DesktopHubFavoritesSection(
                        favorites = state.favorites,
                        isLoading = state.isLoading,
                        favoriteTitleDraft = favoriteTitleDraft,
                        favoriteUrlDraft = favoriteUrlDraft,
                        context = context,
                        onCreateFavorite = onCreateFavorite,
                        onDeleteFavorite = onDeleteFavorite,
                        onOpenFavoriteUrl = onOpenFavoriteUrl,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_settings_entry_title,
                        subtitleRes = R.string.desktop_settings_entry_hint,
                        openLabelRes = R.string.desktop_settings_entry_open,
                        icon = Icons.Outlined.Settings,
                        onOpen = onOpenDesktopSettings,
                    )
                }
                item {
                    DesktopHubSpaEntrySection(
                        titleRes = R.string.desktop_app_store_entry_title,
                        subtitleRes = R.string.desktop_app_store_entry_hint,
                        openLabelRes = R.string.desktop_app_store_open,
                        icon = Icons.Outlined.Store,
                        onOpen = onOpenAppStore,
                    )
                }
                item {
                    DesktopHubStoreSection(
                        storeApps = state.storeApps,
                        installedAppIds = state.installedAppIds,
                        isLoading = state.isLoading,
                        apiRootUrl = apiRootUrl,
                        gridGap = gridGap,
                        stackChromeActions = chrome.shouldStackChromeActions,
                        context = context,
                        onInstallApp = onInstallApp,
                        onUninstallApp = onUninstallApp,
                        onOpenStoreApp = onOpenStoreApp,
                    )
                }
            }
        }
    }
}
