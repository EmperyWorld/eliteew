/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared partner avatar for GAF chat list, header, and message bubbles.
 *
 * Invariants:
 * - System accounts prefer configured avatar_url; app icon is fallback only when URL is absent.
 * - Unread badge is optional and does not change avatar resolution logic.
 *
 * Related:
 * - ChatFeature.kt, ChatRepository.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import feature.profile.ProfileAvatarPlaceholder
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.storage.ProfileEntity
import world.empery.mobile.core.ui.LocalMobileApiBaseUrl

@Composable
fun GafChatPartnerAvatar(
    partnerName: String?,
    partnerAvatarUrl: String?,
    isSystemAccount: Boolean,
    modifier: Modifier = Modifier,
    unreadCount: Int = 0,
    systemFallbackIconSize: Dp = 28.dp,
    avatarContentDescription: String? = null,
) {
    val context = LocalContext.current
    val apiBaseUrl = LocalMobileApiBaseUrl.current
    val resolvedAvatarUrl =
        remember(partnerAvatarUrl, apiBaseUrl) {
            if (apiBaseUrl.isNotBlank()) {
                EwDeskLinkedMediaUrls.resolveApiMediaUrl(apiBaseUrl, partnerAvatarUrl)
            } else {
                partnerAvatarUrl?.trim()?.takeIf { it.isNotBlank() }
            }
        }
    val resolvedDescription =
        avatarContentDescription
            ?: if (isSystemAccount) {
                context.getString(R.string.chat_system_account_cd)
            } else {
                partnerName.orEmpty()
            }
    val avatar: @Composable () -> Unit = {
        when {
            isSystemAccount && resolvedAvatarUrl.isNullOrBlank() -> {
                Surface(
                    modifier = modifier,
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        SubcomposeAsyncImage(
                            model = context.applicationInfo.icon,
                            contentDescription = resolvedDescription,
                            modifier = Modifier.size(systemFallbackIconSize),
                        )
                    }
                }
            }
            isSystemAccount && !resolvedAvatarUrl.isNullOrBlank() -> {
                SubcomposeAsyncImage(
                    model =
                        ImageRequest.Builder(context)
                            .data(resolvedAvatarUrl)
                            .crossfade(true)
                            .build(),
                    contentDescription = resolvedDescription,
                    modifier = modifier,
                    loading = {
                        ProfileAvatarPlaceholder(
                            entity =
                                ProfileEntity(
                                    id = "",
                                    email = null,
                                    username = null,
                                    fullName = partnerName,
                                    avatarUrl = null,
                                    updatedAtEpochMs = 0L,
                                ),
                            modifier = modifier,
                        )
                    },
                    error = {
                        Surface(
                            modifier = modifier,
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                SubcomposeAsyncImage(
                                    model = context.applicationInfo.icon,
                                    contentDescription = resolvedDescription,
                                    modifier = Modifier.size(systemFallbackIconSize),
                                )
                            }
                        }
                    },
                )
            }
            else -> {
                ProfileAvatarPlaceholder(
                    entity =
                        ProfileEntity(
                            id = "",
                            email = null,
                            username = null,
                            fullName = partnerName,
                            avatarUrl = partnerAvatarUrl,
                            updatedAtEpochMs = 0L,
                        ),
                    modifier = modifier,
                    apiBaseUrl = apiBaseUrl,
                )
            }
        }
    }
    if (unreadCount > 0) {
        BadgedBox(
            badge = {
                Badge(
                    modifier =
                        Modifier.semantics(mergeDescendants = true) {
                            contentDescription = context.getString(R.string.chat_unread_cd, unreadCount)
                        },
                ) {
                    Text(text = if (unreadCount > 99) "99+" else unreadCount.toString())
                }
            },
        ) {
            avatar()
        }
    } else {
        avatar()
    }
}
