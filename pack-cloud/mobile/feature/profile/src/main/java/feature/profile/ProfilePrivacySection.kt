/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile privacy editor — discoverability and field visibility with FilterChip rows.
 *
 * Invariants:
 * - User-facing labels always visible; no nested icon-only toggle grids.
 *
 * Related:
 * - ProfileFeature.kt, ProfilePrivacyFriendsShortcut
 */
package feature.profile

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Notes
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.ProfilePrivacyDto
import world.empery.mobile.core.ui.PremiumSectionCard

private data class PrivacyVisibilityOption(
    val value: String,
    val icon: ImageVector,
)

private val VISIBILITY_OPTIONS =
    listOf(
        PrivacyVisibilityOption("everyone", Icons.Outlined.Public),
        PrivacyVisibilityOption("friends_only", Icons.Outlined.Group),
        PrivacyVisibilityOption("circle", Icons.Outlined.Hub),
        PrivacyVisibilityOption("none", Icons.Outlined.Block),
    )

@Composable
private fun visibilityLabel(value: String): String =
    when (value) {
        "friends_only" -> stringResource(R.string.profile_privacy_visibility_friends)
        "none" -> stringResource(R.string.profile_privacy_visibility_none)
        "circle" -> stringResource(R.string.profile_privacy_visibility_circle)
        else -> stringResource(R.string.profile_privacy_visibility_everyone)
    }

@Composable
private fun PrivacySubheading(text: String, hint: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
        hint?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ProfilePrivacyPreviewSummary(
    avatarVisibility: String,
    fullNameVisibility: String,
    bioVisibility: String,
    contactsCount: Int,
    hasCircleError: Boolean,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color =
            if (hasCircleError) {
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.55f)
            },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                text = stringResource(R.string.profile_privacy_preview_title),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            ProfilePrivacyPreviewRow(
                icon = Icons.Outlined.AccountCircle,
                fieldLabel = stringResource(R.string.profile_privacy_avatar),
                visibility = visibilityLabel(avatarVisibility),
            )
            ProfilePrivacyPreviewRow(
                icon = Icons.Outlined.Badge,
                fieldLabel = stringResource(R.string.profile_privacy_full_name),
                visibility = visibilityLabel(fullNameVisibility),
            )
            ProfilePrivacyPreviewRow(
                icon = Icons.Outlined.Notes,
                fieldLabel = stringResource(R.string.profile_privacy_bio),
                visibility = visibilityLabel(bioVisibility),
            )
            Text(
                text = stringResource(R.string.profile_privacy_preview_contacts, contactsCount),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ProfilePrivacyPreviewRow(
    icon: ImageVector,
    fieldLabel: String,
    visibility: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = fieldLabel,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = visibility,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ProfilePrivacyFieldVisibilityRow(
    title: String,
    value: String,
    selectedCircleId: String?,
    circles: List<FriendCircleItemDto>,
    isSaving: Boolean,
    privacyLoaded: Boolean,
    onChange: (String) -> Unit,
    onCircleChange: (String?) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PrivacySubheading(title)
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            VISIBILITY_OPTIONS.forEach { option ->
                val optionEnabled =
                    !isSaving && privacyLoaded && (option.value != "circle" || circles.isNotEmpty())
                FilterChip(
                    selected = value == option.value,
                    onClick = {
                        onChange(option.value)
                        if (option.value == "circle" && selectedCircleId == null) {
                            onCircleChange(circles.firstOrNull()?.id)
                        }
                    },
                    enabled = optionEnabled,
                    label = { Text(visibilityLabel(option.value)) },
                    leadingIcon = {
                        Icon(
                            imageVector = option.icon,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                )
            }
        }
        if (value == "circle") {
            if (circles.isEmpty()) {
                Text(
                    text = stringResource(R.string.profile_privacy_circle_empty),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    circles.forEach { circle ->
                        FilterChip(
                            selected = selectedCircleId == circle.id,
                            onClick = { onCircleChange(circle.id) },
                            enabled = !isSaving && privacyLoaded,
                            label = {
                                Text(
                                    text = circle.name,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProfilePrivacySection(
    privacy: ProfilePrivacyDto?,
    circles: List<FriendCircleItemDto>,
    isSaving: Boolean,
    error: String?,
    onSave: (String, String, String?, String, String?, String, String?) -> Unit,
) {
    var discoverability by remember(privacy?.discoverability) {
        mutableStateOf(privacy?.discoverability ?: "public")
    }
    var avatarVisibility by remember(privacy?.avatar_visibility) {
        mutableStateOf(privacy?.avatar_visibility ?: "everyone")
    }
    var avatarCircleId by remember(privacy?.avatar_circle_id) {
        mutableStateOf(privacy?.avatar_circle_id)
    }
    var fullNameVisibility by remember(privacy?.full_name_visibility) {
        mutableStateOf(privacy?.full_name_visibility ?: "everyone")
    }
    var fullNameCircleId by remember(privacy?.full_name_circle_id) {
        mutableStateOf(privacy?.full_name_circle_id)
    }
    var bioVisibility by remember(privacy?.bio_visibility) {
        mutableStateOf(privacy?.bio_visibility ?: "everyone")
    }
    var bioCircleId by remember(privacy?.bio_circle_id) {
        mutableStateOf(privacy?.bio_circle_id)
    }
    val hasCircleError =
        listOf(avatarVisibility, fullNameVisibility, bioVisibility).any { it == "circle" } &&
            circles.isEmpty()
    val hasChanges =
        privacy != null &&
            (
                discoverability != privacy.discoverability ||
                    avatarVisibility != privacy.avatar_visibility ||
                    avatarCircleId != privacy.avatar_circle_id ||
                    fullNameVisibility != privacy.full_name_visibility ||
                    fullNameCircleId != privacy.full_name_circle_id ||
                    bioVisibility != privacy.bio_visibility ||
                    bioCircleId != privacy.bio_circle_id
            )

    PremiumSectionCard(
        title = stringResource(R.string.profile_privacy_section),
        subtitle = stringResource(R.string.profile_privacy_hint),
        icon = Icons.Outlined.Badge,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (privacy == null) {
                Text(
                    text = stringResource(R.string.profile_privacy_loading),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            error?.let { err ->
                Text(
                    text = stringResource(R.string.profile_privacy_error, err),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            PrivacySubheading(
                text = stringResource(R.string.profile_privacy_help_discover_title),
                hint =
                    if (discoverability == "hidden") {
                        stringResource(R.string.profile_privacy_discover_hidden_hint)
                    } else {
                        stringResource(R.string.profile_privacy_discover_public_hint)
                    },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = discoverability == "public",
                    onClick = { discoverability = "public" },
                    enabled = !isSaving && privacy != null,
                    label = { Text(stringResource(R.string.profile_privacy_discover_public)) },
                    leadingIcon = {
                        Icon(Icons.Outlined.PersonSearch, contentDescription = null, modifier = Modifier.size(18.dp))
                    },
                )
                FilterChip(
                    selected = discoverability == "hidden",
                    onClick = { discoverability = "hidden" },
                    enabled = !isSaving && privacy != null,
                    label = { Text(stringResource(R.string.profile_privacy_discover_hidden)) },
                    leadingIcon = {
                        Icon(Icons.Outlined.VisibilityOff, contentDescription = null, modifier = Modifier.size(18.dp))
                    },
                )
            }

            ProfilePrivacyPreviewSummary(
                avatarVisibility = avatarVisibility,
                fullNameVisibility = fullNameVisibility,
                bioVisibility = bioVisibility,
                contactsCount = circles.sumOf { it.members_count },
                hasCircleError = hasCircleError,
            )

            PrivacySubheading(
                text = stringResource(R.string.profile_privacy_fields_heading),
                hint = stringResource(R.string.profile_privacy_fields_hint),
            )
            ProfilePrivacyFieldVisibilityRow(
                title = stringResource(R.string.profile_privacy_avatar),
                value = avatarVisibility,
                selectedCircleId = avatarCircleId,
                circles = circles,
                isSaving = isSaving,
                privacyLoaded = privacy != null,
                onChange = { avatarVisibility = it },
                onCircleChange = { avatarCircleId = it },
            )
            ProfilePrivacyFieldVisibilityRow(
                title = stringResource(R.string.profile_privacy_full_name),
                value = fullNameVisibility,
                selectedCircleId = fullNameCircleId,
                circles = circles,
                isSaving = isSaving,
                privacyLoaded = privacy != null,
                onChange = { fullNameVisibility = it },
                onCircleChange = { fullNameCircleId = it },
            )
            ProfilePrivacyFieldVisibilityRow(
                title = stringResource(R.string.profile_privacy_bio),
                value = bioVisibility,
                selectedCircleId = bioCircleId,
                circles = circles,
                isSaving = isSaving,
                privacyLoaded = privacy != null,
                onChange = { bioVisibility = it },
                onCircleChange = { bioCircleId = it },
            )

            Button(
                onClick = {
                    onSave(
                        discoverability,
                        avatarVisibility,
                        avatarCircleId.takeIf { avatarVisibility == "circle" },
                        fullNameVisibility,
                        fullNameCircleId.takeIf { fullNameVisibility == "circle" },
                        bioVisibility,
                        bioCircleId.takeIf { bioVisibility == "circle" },
                    )
                },
                enabled = hasChanges && !isSaving && !hasCircleError,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(stringResource(R.string.profile_privacy_save))
            }
        }
    }
}
