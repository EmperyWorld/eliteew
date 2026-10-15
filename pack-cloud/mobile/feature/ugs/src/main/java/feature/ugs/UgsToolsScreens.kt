/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS placeholder tool screens for tools that route from the hub but are not yet full native flows.
 *
 * Invariants:
 * - Preserve transparent scaffold/top-bar behavior for UGS nested routes.
 * - User-visible strings use `feature.ugs` string resources or caller-provided localized text.
 *
 * Related:
 * - UgsHubFeature
 */
package feature.ugs

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumStateCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsToolStubScreen(title: String, description: String, onBack: () -> Unit) {
    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.ugs_nav_back))
                    }
                },
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        scrolledContainerColor = Color.Transparent,
                    ),
            )
        },
    ) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center,
        ) {
            PremiumStateCard(
                modifier = Modifier.fillMaxSize(0.92f),
                title = title,
                message = description,
                icon = Icons.AutoMirrored.Filled.ArrowBack,
                action = {
                    Text(
                        text = stringResource(R.string.ugs_tool_stub_wip),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                    )
                },
            )
        }
    }
}

@Composable
fun UgsAiChatScreen(onBack: () -> Unit) {
    UgsToolStubScreen(stringResource(R.string.ugs_tool_ai_chat), stringResource(R.string.ugs_ai_chat_top_subtitle), onBack)
}

@Composable
fun UgsSongsScreen(onBack: () -> Unit) {
    UgsToolStubScreen(stringResource(R.string.ugs_tool_songs), stringResource(R.string.ugs_songs_top_subtitle), onBack)
}
