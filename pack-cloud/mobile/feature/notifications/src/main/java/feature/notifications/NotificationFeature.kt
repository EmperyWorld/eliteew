/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notification Center UI: optional context strip, grouped inbox, scale-aware rows, deeplink focus.
 *
 * Invariants:
 * - User-visible strings come from `feature.notifications` string resources.
 * - Detail sheet shows sanitized payload only (no raw HTML/control chars).
 * - Bottom-tab host hides context strip and back (`showContextStrip`/`showBackNavigation`).
 *
 * Related:
 * - NotificationDeepLinkSupport.kt, NotificationLogic.kt, NotificationsTabViewModel
 */
package feature.notifications

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.storage.NotificationEntity
import world.empery.mobile.core.ui.MobileActiveContextStrip
import world.empery.mobile.core.ui.MobileEmptyState
import world.empery.mobile.core.ui.MobileErrorState
import world.empery.mobile.core.ui.MobileIconButton
import world.empery.mobile.core.ui.MobileLoadingSkeleton
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

data class NotificationCenterUiState(
    val items: List<NotificationEntity> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val filter: NotificationFilter = NotificationFilter.ALL,
    val focusedNotificationId: String? = null,
    val detailItem: NotificationEntity? = null,
    val showUndoMarkAllRead: Boolean = false,
)

private sealed interface NotificationLazyEntry {
    data class GroupHeader(val groupKey: String, val title: String, val subtitle: String) : NotificationLazyEntry
    data class NotificationRow(val entity: NotificationEntity) : NotificationLazyEntry
}

private fun parseCreatedInstant(createdAt: String?): Instant? {
    if (createdAt.isNullOrBlank()) return null
    val normalized = createdAt.trim().replace(' ', 'T')
    return try {
        Instant.parse(normalized)
    } catch (_: Exception) {
        try {
            Instant.parse("${normalized}Z")
        } catch (_: Exception) {
            null
        }
    }
}

private fun formatRelativeTimestamp(
    context: Context,
    createdAt: String?,
    zone: ZoneId,
    now: Instant,
): String {
    val instant = parseCreatedInstant(createdAt)
    if (instant == null) {
        return if (createdAt.isNullOrBlank()) {
            context.getString(R.string.notifications_time_unknown)
        } else {
            createdAt
        }
    }
    val zNow = now.atZone(zone)
    val zThen = instant.atZone(zone)
    val minutes = ChronoUnit.MINUTES.between(instant, now).coerceAtLeast(0)
    val hours = ChronoUnit.HOURS.between(instant, now).coerceAtLeast(0)
    val days = ChronoUnit.DAYS.between(zThen.toLocalDate(), zNow.toLocalDate())
    return when {
        minutes < 1 -> context.getString(R.string.notifications_time_just_now)
        minutes < 60 -> context.getString(R.string.notifications_time_minutes_ago, minutes.toInt())
        hours < 24 && days == 0L -> context.getString(R.string.notifications_time_hours_ago, hours.toInt())
        days == 1L -> {
            val time = DateTimeFormatter.ofPattern("HH:mm").format(zThen)
            context.getString(R.string.notifications_time_yesterday, time)
        }
        days == 0L -> DateTimeFormatter.ofPattern("HH:mm").format(zThen)
        else -> {
            val fmt = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.SHORT, FormatStyle.SHORT)
            zThen.format(fmt)
        }
    }
}

private fun sourceLabel(context: Context, source: String?): String =
    when {
        source.isNullOrBlank() || source == "_unknown" -> context.getString(R.string.notifications_source_unknown)
        else -> source
    }

private fun severityLabel(context: Context, severity: NotificationSeverity): String =
    when (severity) {
        NotificationSeverity.ERROR -> context.getString(R.string.notifications_severity_error)
        NotificationSeverity.WARNING -> context.getString(R.string.notifications_severity_warning)
        NotificationSeverity.INFO -> context.getString(R.string.notifications_severity_info)
        NotificationSeverity.SUCCESS -> context.getString(R.string.notifications_severity_success)
        NotificationSeverity.UNKNOWN -> context.getString(R.string.notifications_severity_unknown)
    }

private fun filterLabel(context: Context, filter: NotificationFilter): String =
    when (filter) {
        NotificationFilter.ALL -> context.getString(R.string.notifications_filter_all)
        NotificationFilter.UNREAD -> context.getString(R.string.notifications_filter_unread)
        NotificationFilter.FRIENDS -> context.getString(R.string.notifications_filter_friends)
        NotificationFilter.CHAT -> context.getString(R.string.notifications_filter_chat)
        NotificationFilter.SYSTEM -> context.getString(R.string.notifications_filter_system)
        NotificationFilter.UGS -> context.getString(R.string.notifications_filter_ugs)
        NotificationFilter.DESKTOP -> context.getString(R.string.notifications_filter_desktop)
    }

private fun flattenForLazyList(context: Context, groups: List<InboxGroup>): List<NotificationLazyEntry> = buildList {
    for (group in groups) {
        val source = sourceLabel(context, group.sourceKey)
        val severity = severityLabel(context, group.severity)
        add(
            NotificationLazyEntry.GroupHeader(
                groupKey = group.groupKey,
                title = source,
                subtitle = severity,
            ),
        )
        for (n in group.items) {
            add(NotificationLazyEntry.NotificationRow(n))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun NotificationCenterScreen(
    state: NotificationCenterUiState,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
    onFilterChange: (NotificationFilter) -> Unit = {},
    onItemClick: (NotificationEntity) -> Unit = {},
    onMarkAllRead: () -> Unit = {},
    onUndoMarkAllRead: () -> Unit = {},
    onDismissDetail: () -> Unit = {},
    onDetailCta: (NotificationCta) -> Unit = {},
    onFocusConsumed: () -> Unit = {},
    entrySurface: NotificationCenterEntrySurface = NotificationCenterEntrySurface.EW_DESK,
    showContextStrip: Boolean = true,
    showBackNavigation: Boolean = true,
) {
    val context = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    val zone = remember { ZoneId.systemDefault() }
    val now = remember(state.items, state.isLoading) { Instant.now() }
    val filtered = remember(state.items, state.filter) { filterNotifications(state.items, state.filter) }
    val groups = remember(filtered) { groupInboxBySourceAndSeverity(filtered) }
    val lazyEntries = remember(groups, context) { flattenForLazyList(context, groups) }
    val unreadCount = remember(state.items) { state.items.count { it.readAt.isNullOrBlank() } }
    val listState = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }
    val backCd = stringResource(R.string.notifications_back_cd)
    val refreshCd = if (state.isLoading) stringResource(R.string.notifications_refresh_cd_loading) else stringResource(R.string.notifications_refresh_cd)
    val undoLabel = stringResource(R.string.notifications_undo_mark_read)
    val markedLabel = stringResource(R.string.notifications_marked_all_read)
    val contextStripLabel =
        when (entrySurface) {
            NotificationCenterEntrySurface.EW_DESK -> stringResource(R.string.notifications_context_ewdesk_label)
            NotificationCenterEntrySurface.PROFILE -> stringResource(R.string.notifications_context_profile_label)
        }
    val contextStripDetail =
        when (entrySurface) {
            NotificationCenterEntrySurface.EW_DESK -> stringResource(R.string.notifications_context_ewdesk_detail)
            NotificationCenterEntrySurface.PROFILE -> stringResource(R.string.notifications_context_profile_detail)
        }
    val contextStripCd = stringResource(R.string.notifications_context_strip_cd, contextStripLabel)
    val deeplinkFocusCd = stringResource(R.string.notifications_deeplink_focus_cd)

    LaunchedEffect(state.showUndoMarkAllRead) {
        if (state.showUndoMarkAllRead) {
            val result = snackbarHostState.showSnackbar(message = markedLabel, actionLabel = undoLabel)
            if (result == SnackbarResult.ActionPerformed) {
                onUndoMarkAllRead()
            }
        }
    }

    LaunchedEffect(state.focusedNotificationId, lazyEntries.size, state.filter) {
        val focusId = state.focusedNotificationId ?: return@LaunchedEffect
        val scrollIndex = findNotificationListScrollIndex(groups, focusId)
        if (scrollIndex != null && scrollIndex >= 0) {
            listState.animateScrollToItem(scrollIndex)
            onFocusConsumed()
        }
    }

    val detail = state.detailItem
    if (detail != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = onDismissDetail, sheetState = sheetState) {
            NotificationDetailSheet(
                entity = detail,
                zone = zone,
                now = now,
                onDismiss = onDismissDetail,
                onCta = onDetailCta,
            )
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (showContextStrip) {
            MobileActiveContextStrip(
                label = contextStripLabel,
                detail = contextStripDetail,
                icon = Icons.Filled.Notifications,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                        .semantics { contentDescription = contextStripCd },
            )
        }
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            NotificationCenterHeader(
                unreadCount = unreadCount,
                filteredCount = filtered.size,
                isLoading = state.isLoading,
                unreadActionsVisible = unreadCount > 0,
                backCd = backCd,
                refreshCd = refreshCd,
                showBackNavigation = showBackNavigation,
                onBack = onBack,
                onRefresh = onRefresh,
                onMarkAllRead = onMarkAllRead,
            )

            NotificationFilterChipRow(
                selected = state.filter,
                enabled = !state.isLoading,
                useWrappedLayout = chrome.useWrappedFilterChips,
                onFilterChange = onFilterChange,
            )

        if (state.isLoading && state.items.isNotEmpty()) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        state.error?.let { err ->
            MobileErrorState(
                title = stringResource(R.string.notifications_error_title),
                message = stringResource(R.string.notifications_error, err),
                retryLabel = stringResource(R.string.notifications_retry),
                onRetry = onRefresh,
                retryEnabled = !state.isLoading,
                diagnostics = err.take(120),
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                contentDescription = context.getString(R.string.notifications_error_cd, err),
            )
        }

        Box(modifier = Modifier.fillMaxSize()) {
            when {
                state.isLoading && state.items.isEmpty() -> {
                    MobileLoadingSkeleton(
                        message = stringResource(R.string.notifications_loading_cd),
                        contentDescription = context.getString(R.string.notifications_loading_cd),
                    )
                }
                filtered.isEmpty() && state.error == null -> {
                    val filterActive = state.filter != NotificationFilter.ALL
                    val hasItems = state.items.isNotEmpty()
                    MobileEmptyState(
                        title =
                            stringResource(
                                if (filterActive && hasItems) {
                                    R.string.notifications_filter_empty_title
                                } else {
                                    R.string.notifications_empty_title
                                },
                            ),
                        message =
                            stringResource(
                                if (filterActive && hasItems) {
                                    R.string.notifications_filter_empty_body
                                } else {
                                    R.string.notifications_empty_body
                                },
                            ),
                        icon = Icons.Filled.Notifications,
                        contentDescription =
                            context.getString(
                                if (filterActive && hasItems) {
                                    R.string.notifications_filter_empty_cd
                                } else {
                                    R.string.notifications_empty_cd
                                },
                            ),
                    )
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 88.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(lazyEntries, key = {
                            when (it) {
                                is NotificationLazyEntry.GroupHeader -> "hdr-${it.groupKey}"
                                is NotificationLazyEntry.NotificationRow -> it.entity.id
                            }
                        }) { entry ->
                            when (entry) {
                                is NotificationLazyEntry.GroupHeader -> {
                                    Column(modifier = Modifier.animateItem().fillMaxWidth().padding(vertical = 4.dp)) {
                                        Text(entry.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                                        Text(entry.subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                                is NotificationLazyEntry.NotificationRow -> {
                                    NotificationListRow(
                                        modifier =
                                            Modifier
                                                .animateItem()
                                                .semantics {
                                                    if (state.focusedNotificationId == entry.entity.id) {
                                                        stateDescription = deeplinkFocusCd
                                                    }
                                                },
                                        item = entry.entity,
                                        zone = zone,
                                        now = now,
                                        highlighted = state.focusedNotificationId == entry.entity.id,
                                        onClick = { onItemClick(entry.entity) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
            SnackbarHost(hostState = snackbarHostState, modifier = Modifier.align(Alignment.BottomCenter))
        }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NotificationCenterHeader(
    unreadCount: Int,
    filteredCount: Int,
    isLoading: Boolean,
    unreadActionsVisible: Boolean,
    backCd: String,
    refreshCd: String,
    showBackNavigation: Boolean = true,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onMarkAllRead: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (showBackNavigation) {
                IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = backCd }) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            } else {
                Spacer(modifier = Modifier.size(48.dp))
            }
            MobileIconButton(
                onClick = onRefresh,
                enabled = !isLoading,
                contentDescription = refreshCd,
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                } else {
                    Icon(
                        Icons.Outlined.Refresh,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text =
                    buildString {
                        append(stringResource(R.string.notifications_filter_all))
                        append(": ")
                        append(filteredCount)
                        if (unreadCount > 0) {
                            append(" · ")
                            append(stringResource(R.string.notifications_unread_count, unreadCount))
                        }
                    },
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (unreadActionsVisible) {
                TextButton(onClick = onMarkAllRead, enabled = !isLoading) {
                    Text(stringResource(R.string.notifications_mark_all_read))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NotificationFilterChipRow(
    selected: NotificationFilter,
    enabled: Boolean,
    useWrappedLayout: Boolean,
    onFilterChange: (NotificationFilter) -> Unit,
) {
    val context = LocalContext.current
    val chip: @Composable (NotificationFilter) -> Unit = { filter ->
        FilterChip(
            selected = selected == filter,
            onClick = { onFilterChange(filter) },
            enabled = enabled,
            label = {
                Text(
                    filterLabel(context, filter),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            },
        )
    }
    if (useWrappedLayout) {
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            NotificationFilter.entries.forEach { filter ->
                chip(filter)
            }
        }
    } else {
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(NotificationFilter.entries, key = { it.name }) { filter ->
                chip(filter)
            }
        }
    }
}

@Composable
private fun NotificationDetailSheet(
    entity: NotificationEntity,
    zone: ZoneId,
    now: Instant,
    onDismiss: () -> Unit,
    onCta: (NotificationCta) -> Unit,
) {
    val context = LocalContext.current
    val payload = remember(entity) { sanitizeNotificationPayload(entity) }
    val relative = formatRelativeTimestamp(context, payload.createdAtRaw, zone, now)
    val cta = remember(entity) { resolveNotificationCta(entity) }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.notifications_detail_title), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(payload.title, style = MaterialTheme.typography.titleMedium)
        if (payload.message.isNotBlank()) {
            Text(payload.message, style = MaterialTheme.typography.bodyMedium)
        }
        Text(stringResource(R.string.notifications_detail_meta, payload.source, payload.type, relative), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                Text(stringResource(R.string.notifications_detail_close))
            }
            when (cta) {
                NotificationCta.MarkRead -> Button(onClick = { onCta(NotificationCta.MarkRead) }, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.notifications_detail_mark_read))
                }
                NotificationCta.OpenFriends -> Button(onClick = { onCta(NotificationCta.OpenFriends) }, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.notifications_detail_open_friends))
                }
                NotificationCta.OpenChat -> Button(onClick = { onCta(NotificationCta.OpenChat) }, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.notifications_detail_open_chat))
                }
                NotificationCta.OpenUgs -> Button(onClick = { onCta(NotificationCta.OpenUgs) }, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.notifications_detail_open_ugs))
                }
                NotificationCta.OpenDesktop -> Button(onClick = { onCta(NotificationCta.OpenDesktop) }, modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.notifications_detail_open_desktop))
                }
                null -> Unit
            }
        }
    }
}

@Composable
private fun NotificationListRow(
    modifier: Modifier = Modifier,
    item: NotificationEntity,
    zone: ZoneId,
    now: Instant,
    highlighted: Boolean,
    onClick: () -> Unit,
) {
    val context = LocalContext.current
    val unread = item.readAt.isNullOrBlank()
    val relative = formatRelativeTimestamp(context, item.createdAt, zone, now)
    val source = sourceLabel(context, item.source)
    val titleText = item.title?.takeIf { it.isNotBlank() } ?: stringResource(R.string.notifications_row_no_title)
    val chrome = rememberMobileScaleChromePolicy()

    PremiumRowSurface(
        modifier = modifier
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = "$titleText. $relative. $source"
                stateDescription = if (unread) context.getString(R.string.notifications_row_unread) else context.getString(R.string.notifications_row_read)
            },
        containerColor =
            if (unread) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.84f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.9f)
            },
        borderColor =
            when {
                highlighted -> MaterialTheme.colorScheme.tertiary
                unread -> MaterialTheme.colorScheme.primary.copy(alpha = 0.32f)
                else -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f)
            },
        tonalElevation = if (highlighted) 6.dp else if (unread) 3.dp else 2.dp,
        verticalAlignment = Alignment.Top,
    ) {
        val dotSize = if (chrome.shouldStackChromeActions) 10.dp else 8.dp
        if (unread) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp).size(dotSize),
            ) {}
        } else {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
                modifier = Modifier.padding(top = 8.dp).size(dotSize),
            ) {}
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Text(
                    titleText,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                    maxLines = if (chrome.shouldStackChromeActions) 2 else 3,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!chrome.useIconOnlyActions) {
                    PremiumBadge(
                        text =
                            if (unread) {
                                stringResource(R.string.notifications_row_new_badge)
                            } else {
                                stringResource(R.string.notifications_row_read)
                            },
                    )
                }
            }
            item.message?.takeIf { it.isNotBlank() }?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = chrome.maxBodyPreviewLines,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (chrome.shouldStackChromeActions) {
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        relative,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        source,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        relative,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        source,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 140.dp),
                    )
                }
            }
        }
    }
}
