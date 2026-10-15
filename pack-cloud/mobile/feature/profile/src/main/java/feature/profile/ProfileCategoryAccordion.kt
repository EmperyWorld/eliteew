/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Collapsible category panels for Profile screen — groups settings under spoilers with persisted state.
 *
 * Invariants:
 * - Category expanded state persists in `empery_mobile_profile_categories` prefs when not group-controlled.
 * - When [expandedOverride] / [onExpandedToggle] are set, only one category should be open at a time (ProfileScreen).
 * - Header is always visible; body uses AnimatedVisibility.
 *
 * Related:
 * - ProfileFeature.kt, ProfileControlCenterSections.kt
 */
package feature.profile

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.LocalMobileSurfaceStyle
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.core.ui.MobileMinimumTouchTargetDp
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

enum class ProfileCategoryId {
    UPDATES,
    ACCOUNT,
    SECURITY,
    VIDEO_CALLS,
    NOTIFICATIONS,
    APPEARANCE,
    STORAGE,
    SUPPORT,
}

object ProfileCategoryPrefs {
    private const val PREFS = "empery_mobile_profile_categories"

    private fun key(id: ProfileCategoryId): String = "cat_expanded_${id.name.lowercase()}"

    fun isExpanded(context: Context, id: ProfileCategoryId, default: Boolean): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(key(id), default)

    fun setExpanded(context: Context, id: ProfileCategoryId, expanded: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(key(id), expanded)
            .apply()
    }
}

@Composable
fun ProfileCollapsibleCategory(
    id: ProfileCategoryId,
    title: String,
    subtitle: String? = null,
    icon: ImageVector,
    defaultExpanded: Boolean = false,
    requestExpand: Boolean = false,
    onExpandConsumed: () -> Unit = {},
    /** When set, parent controls expand/collapse (single-open accordion in ProfileScreen). */
    expandedOverride: Boolean? = null,
    onExpandedToggle: ((ProfileCategoryId, Boolean) -> Unit)? = null,
    badge: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val context = LocalContext.current
    var localExpanded by rememberSaveable(id) {
        mutableStateOf(ProfileCategoryPrefs.isExpanded(context, id, defaultExpanded))
    }
    val expanded = expandedOverride ?: localExpanded
    LaunchedEffect(requestExpand) {
        if (requestExpand) {
            if (onExpandedToggle != null) {
                onExpandedToggle(id, true)
            } else {
                localExpanded = true
                ProfileCategoryPrefs.setExpanded(context, id, true)
            }
            onExpandConsumed()
        }
    }
    val surfaceStyle = LocalMobileSurfaceStyle.current
    val cardAlpha =
        when (surfaceStyle) {
            MobileSurfaceStyle.GLASS -> 0.58f
            MobileSurfaceStyle.PREMIUM -> 0.94f
            MobileSurfaceStyle.SYSTEM -> 1f
        }
    val shape = RoundedCornerShape(20.dp)
    val expandCd =
        stringResource(
            if (expanded) {
                R.string.profile_category_collapse_cd
            } else {
                R.string.profile_category_expand_cd
            },
            title,
        )
    val chrome = rememberMobileScaleChromePolicy()

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = shape,
        color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = cardAlpha),
        tonalElevation = if (surfaceStyle == MobileSurfaceStyle.GLASS) 0.dp else 2.dp,
        border =
            androidx.compose.foundation.BorderStroke(
                1.dp,
                when (surfaceStyle) {
                    MobileSurfaceStyle.GLASS -> MaterialTheme.colorScheme.outline.copy(alpha = 0.28f)
                    MobileSurfaceStyle.PREMIUM -> MaterialTheme.colorScheme.primary.copy(alpha = 0.22f)
                    MobileSurfaceStyle.SYSTEM -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)
                },
            ),
    ) {
        Column {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            val next = !expanded
                            if (onExpandedToggle != null) {
                                onExpandedToggle(id, next)
                            } else {
                                localExpanded = next
                                ProfileCategoryPrefs.setExpanded(context, id, next)
                            }
                        }
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                        .semantics { contentDescription = expandCd },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PremiumIconTile(icon = icon, contentDescription = null)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        badge?.let { PremiumBadge(text = it) }
                    }
                    if (!chrome.shouldStackChromeActions) {
                        subtitle?.let {
                            Text(
                                text = it,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                androidx.compose.material3.Icon(
                    imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(MobileMinimumTouchTargetDp),
                )
            }
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
                    )
                    content()
                }
            }
        }
    }
}

@Composable
fun ProfileEmbeddedDivider(modifier: Modifier = Modifier) {
    HorizontalDivider(
        modifier = modifier.padding(vertical = 2.dp),
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f),
    )
}
