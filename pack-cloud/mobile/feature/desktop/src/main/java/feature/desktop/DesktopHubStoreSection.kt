/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop Hub store catalog section: app rows, icons, install/uninstall actions.
 *
 * Invariants:
 * - Same package as DesktopHubFeature; DesktopHubScreen public API unchanged.
 * - LazyColumn item order must stay aligned with DesktopHubLazyColumnIndices / DesktopHubSectionId.
 *
 * Related:
 * - DesktopHubFeature.kt, DesktopStoreAppSupport.kt
 */
package feature.desktop

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Apps
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.network.api.DesktopStoreAppDto
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.ScaledOutlinedButton

@Composable
internal fun DesktopStoreAppIcon(
    iconUrl: String?,
    apiRootUrl: String,
    appName: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val resolved =
        remember(iconUrl, apiRootUrl) {
            iconUrl?.trim()?.takeIf { it.isNotBlank() }?.let { raw ->
                EwDeskLinkedMediaUrls.rewriteMarkdownAssetDestination(raw, apiRootUrl) ?: raw
            }
        }
    Surface(
        modifier = modifier.size(44.dp),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
    ) {
        if (!resolved.isNullOrBlank()) {
            AsyncImage(
                model =
                    ImageRequest.Builder(context)
                        .data(resolved)
                        .crossfade(true)
                        .build(),
                contentDescription = appName,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                Icon(
                    imageVector = Icons.Outlined.Apps,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp),
                )
            }
        }
    }
}

@Composable
internal fun DesktopStoreSecondaryAction(
    app: DesktopStoreAppDto,
    onUninstallApp: (String) -> Unit,
    descSnippet: String?,
    context: Context,
    modifier: Modifier = Modifier,
) {
    if (app.isRemovableFromDesktop()) {
        ScaledOutlinedButton(
            onClick = { onUninstallApp(app.app_id) },
            enabled = true,
            label = stringResource(R.string.desktop_store_uninstall),
            modifier =
                modifier.semantics {
                    contentDescription = buildString {
                        append(context.getString(R.string.desktop_store_uninstall_a11y, app.name))
                        descSnippet?.let { d -> append(". ").append(d) }
                    }
                },
        )
    } else {
        val badgeRes = app.storeBadgeLabelRes()
        if (badgeRes != null) {
            val badgeLabel = stringResource(badgeRes)
            val cannotUninstallCd =
                stringResource(
                    R.string.desktop_store_cannot_uninstall_a11y,
                    app.name,
                    badgeLabel,
                )
            AssistChip(
                onClick = {},
                enabled = false,
                label = { Text(badgeLabel, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                colors =
                    AssistChipDefaults.assistChipColors(
                        disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                        disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                modifier =
                    modifier.semantics {
                        contentDescription = cannotUninstallCd
                    },
            )
        }
    }
}

@Composable
internal fun DesktopHubStoreSection(
    storeApps: List<DesktopStoreAppDto>,
    installedAppIds: Set<String>,
    isLoading: Boolean,
    apiRootUrl: String,
    gridGap: Dp,
    stackChromeActions: Boolean,
    context: Context,
    onInstallApp: (String) -> Unit,
    onUninstallApp: (String) -> Unit,
    onOpenStoreApp: (String) -> Unit,
) {
    DesktopSectionCard(
        title = stringResource(R.string.desktop_store_section_title),
        subtitle = stringResource(R.string.desktop_store_section_hint),
        icon = Icons.Outlined.Apps,
    ) {
        if (storeApps.isEmpty()) {
            Text(
                text = if (isLoading) {
                    stringResource(R.string.desktop_store_loading)
                } else {
                    stringResource(R.string.desktop_store_empty)
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            val apps = storeApps.take(16)
            apps.forEachIndexed { index, app ->
                val installed = installedAppIds.contains(app.app_id) || app.installed == true
                val description = app.description.orEmpty()
                val descSnippet = description.trim().takeIf { it.isNotBlank() }?.let {
                    hubA11ySnippet(it, maxChars = 48)
                }
                val installedSuffix =
                    if (installed) {
                        context.getString(R.string.desktop_store_app_installed)
                    } else {
                        context.getString(R.string.desktop_store_app_not_installed)
                    }
                val appSummary = buildString {
                    append(app.name)
                    descSnippet?.let { d -> append(". ").append(d) }
                    append(installedSuffix)
                }
                PremiumRowSurface(
                    modifier = Modifier
                        .semantics { isTraversalGroup = true },
                ) {
                    DesktopStoreAppIcon(
                        iconUrl = app.icon_url,
                        apiRootUrl = apiRootUrl,
                        appName = app.name,
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .semantics(mergeDescendants = true) {
                                contentDescription = appSummary
                            },
                    ) {
                        Text(
                            app.name,
                            style = MaterialTheme.typography.titleSmall,
                        )
                        if (description.isNotBlank()) {
                            Text(
                                description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = if (stackChromeActions) 2 else 3,
                            )
                        }
                    }
                    val actionContent: @Composable () -> Unit = {
                        when {
                            !installed -> {
                                ScaledOutlinedButton(
                                    onClick = { onInstallApp(app.app_id) },
                                    enabled = !isLoading,
                                    label = stringResource(R.string.desktop_store_install),
                                    modifier = Modifier.semantics {
                                        contentDescription = buildString {
                                            append(context.getString(R.string.desktop_store_install_a11y, app.name))
                                            descSnippet?.let { d -> append(". ").append(d) }
                                        }
                                    },
                                )
                            }
                            else -> {
                                if (stackChromeActions) {
                                    Column(verticalArrangement = Arrangement.spacedBy(gridGap)) {
                                        ScaledOutlinedButton(
                                            onClick = { onOpenStoreApp(app.app_id) },
                                            enabled = true,
                                            label = stringResource(R.string.desktop_action_open),
                                            modifier = Modifier.semantics {
                                                contentDescription =
                                                    context.getString(R.string.desktop_store_open_a11y, app.name)
                                            },
                                        )
                                        DesktopStoreSecondaryAction(
                                            app = app,
                                            onUninstallApp = onUninstallApp,
                                            descSnippet = descSnippet,
                                            context = context,
                                        )
                                    }
                                } else {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(gridGap),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        ScaledOutlinedButton(
                                            onClick = { onOpenStoreApp(app.app_id) },
                                            enabled = true,
                                            label = stringResource(R.string.desktop_action_open),
                                            modifier = Modifier.semantics {
                                                contentDescription =
                                                    context.getString(R.string.desktop_store_open_a11y, app.name)
                                            },
                                        )
                                        DesktopStoreSecondaryAction(
                                            app = app,
                                            onUninstallApp = onUninstallApp,
                                            descSnippet = descSnippet,
                                            context = context,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    actionContent()
                }
                if (index < apps.lastIndex) {
                    HorizontalDivider(modifier = Modifier.padding(top = gridGap))
                }
            }
        }
    }
}
