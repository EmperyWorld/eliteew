// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Feed tab entry card for full desktop EWDesk embedded WebView.
// Related:
// - FeedFeature.kt, EwDeskLaunch.kt, MobileEwDeskPage.tsx
// ---
package feature.feed

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import world.empery.mobile.core.ui.PremiumSectionCard

@Composable
internal fun FeedFullEwDeskEntryCard(
    onOpenFullEwDesk: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        title = stringResource(R.string.feed_full_ewdesk_title),
        subtitle = stringResource(R.string.feed_full_ewdesk_subtitle),
        icon = Icons.Outlined.Newspaper,
        modifier = modifier,
    ) {
        TextButton(onClick = onOpenFullEwDesk, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.feed_full_ewdesk_open))
        }
    }
}
