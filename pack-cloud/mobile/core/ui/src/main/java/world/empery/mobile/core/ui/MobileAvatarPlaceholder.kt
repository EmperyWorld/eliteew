/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared circular avatar (initials or Coil image) for profile/friends/chat without feature coupling.
 *
 * Invariants:
 * - Relative avatar paths are resolved via [LocalMobileApiBaseUrl] before Coil load.
 * - Absolute http(s) URLs pass through unchanged.
 *
 * Related:
 * - feature.profile.ProfileAvatarPlaceholder, GafChatPartnerAvatar, FriendsFriendCard
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls

fun mobileAvatarInitials(
    displayName: String?,
    username: String? = null,
): String {
    val name = displayName?.trim().orEmpty()
    if (name.isNotEmpty()) {
        val parts = name.split(Regex("\\s+")).filter { part -> part.isNotEmpty() }
        return when {
            parts.size >= 2 ->
                "${parts[0].first().uppercaseChar()}${parts[1].first().uppercaseChar()}"
            else -> parts[0].take(2).uppercase()
        }
    }
    val user = username?.trim().orEmpty()
    if (user.isNotEmpty()) return user.take(2).uppercase()
    return "?"
}

@Composable
fun MobileAvatarPlaceholder(
    initials: String,
    imageUrl: String?,
    contentDescription: String,
    modifier: Modifier = Modifier.size(72.dp),
    onClick: (() -> Unit)? = null,
    isUploading: Boolean = false,
    cacheKeySuffix: Long = 0L,
) {
    val apiBaseUrl = LocalMobileApiBaseUrl.current
    val resolvedUrl =
        remember(imageUrl, apiBaseUrl) {
            resolveMobileAvatarUrl(apiBaseUrl = apiBaseUrl, rawUrl = imageUrl)
        }
    val hasPhotoUrl = !resolvedUrl.isNullOrBlank()
    val clickModifier =
        if (onClick != null) {
            Modifier.clickable(onClick = onClick)
        } else {
            Modifier
        }
    Box(modifier = modifier) {
        Surface(
            modifier =
                Modifier
                    .fillMaxSize()
                    .semantics { this.contentDescription = contentDescription }
                    .clip(CircleShape)
                    .then(clickModifier),
            color = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ) {
            if (hasPhotoUrl) {
                val context = LocalContext.current
                val cacheKey = "${resolvedUrl}:$cacheKeySuffix"
                val request =
                    remember(cacheKey) {
                        ImageRequest.Builder(context)
                            .data(resolvedUrl)
                            .memoryCacheKey(cacheKey)
                            .diskCacheKey(cacheKey)
                            .crossfade(true)
                            .build()
                    }
                AsyncImage(
                    model = request,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = initials,
                        style = MaterialTheme.typography.titleLarge,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        if (isUploading) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.dp)
            }
        }
    }
}

/** Absolute http(s) or API-relative avatar path → Coil-ready URL. */
fun resolveMobileAvatarUrl(
    apiBaseUrl: String,
    rawUrl: String?,
): String? {
    val trimmed = rawUrl?.trim()?.takeIf { it.isNotBlank() } ?: return null
    if (apiBaseUrl.isNotBlank()) {
        return EwDeskLinkedMediaUrls.resolveApiMediaUrl(apiBaseUrl, trimmed)
    }
    return trimmed.takeIf {
        it.startsWith("http://", ignoreCase = true) || it.startsWith("https://", ignoreCase = true)
    }
}
