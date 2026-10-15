/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends tab chrome: hero header, quick search, collapsible advanced blocks.
 *
 * Invariants:
 * - Hero uses PremiumGlassCard to match UGS/Feed shell headers.
 */
package feature.friends

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun FriendsTabHero(
    friendsCount: Int,
    incomingCount: Int,
    sentCount: Int,
    onSearch: (String) -> Unit,
    onAddFriend: () -> Unit,
    addEnabled: Boolean,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    var searchQuery by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(searchQuery) {
        val q = searchQuery.trim()
        if (q.length < 2) return@LaunchedEffect
        delay(350)
        onSearch(q)
    }
    val fieldShape = RoundedCornerShape(18.dp)
    val fieldColors =
        OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
        )
    val addFriendCd = stringResource(R.string.friends_add_cd)
    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PremiumIconTile(
                    icon = Icons.Outlined.People,
                    contentDescription = stringResource(R.string.friends_screen_title),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.friends_screen_title),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.semantics { heading() },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (!chrome.shouldStackChromeActions) {
                        Text(
                            text =
                                stringResource(
                                    R.string.friends_screen_subtitle,
                                    friendsCount,
                                    incomingCount,
                                    sentCount,
                                ),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        if (!chrome.shouldStackChromeActions) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PremiumMetricPill(
                label = stringResource(R.string.friends_section_my_friends),
                value = friendsCount.toString(),
            )
            PremiumMetricPill(
                label = stringResource(R.string.friends_section_incoming),
                value = incomingCount.toString(),
            )
            PremiumMetricPill(
                label = stringResource(R.string.friends_section_sent),
                value = sentCount.toString(),
            )
        }
        }
        if (chrome.shouldStackChromeActions) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it.take(64) },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(stringResource(R.string.friends_search_placeholder)) },
                    leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                    singleLine = true,
                    shape = fieldShape,
                    colors = fieldColors,
                )
                ScaledOutlinedButton(
                    onClick = onAddFriend,
                    enabled = addEnabled,
                    label = stringResource(R.string.friends_add),
                    icon = Icons.Outlined.PersonAdd,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics {
                                contentDescription = addFriendCd
                            },
                )
            }
        } else {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it.take(64) },
                modifier = Modifier.weight(1f),
                placeholder = { Text(stringResource(R.string.friends_search_placeholder)) },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                singleLine = true,
                shape = fieldShape,
                colors = fieldColors,
            )
            ScaledOutlinedButton(
                onClick = onAddFriend,
                enabled = addEnabled,
                label = stringResource(R.string.friends_add),
                icon = Icons.Outlined.PersonAdd,
                modifier =
                    Modifier.semantics {
                        contentDescription = addFriendCd
                    },
            )
        }
        }
        }
    }
}

@Composable
internal fun FriendsCollapsibleSectionHeader(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    badge: String? = null,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(
        modifier =
            modifier
                .clickable(onClick = onToggle),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        badge?.let { PremiumBadge(text = it) }
        IconButton(onClick = onToggle) {
            Icon(
                imageVector = if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
                contentDescription =
                    if (expanded) {
                        stringResource(R.string.friends_section_collapse_cd)
                    } else {
                        stringResource(R.string.friends_section_expand_cd)
                    },
            )
        }
    }
}
