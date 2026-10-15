/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OTA update block for Profile — one primary action: check when up to date, one-click update otherwise.
 *
 * Invariants:
 * - When an installable update exists, only «Обновить» is shown; install launches automatically after download.
 * - SHA-256 never shown in UI; install only when APK is verified on disk.
 *
 * Related:
 * - ProfileFeature.kt, MobileAppUpdateRepository.kt, canShowOtaInstallButton
 */
package feature.profile

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import java.io.File
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton

@Composable
fun ProfileOtaUpdateSection(
    update: AppUpdateUiState,
    onCheckForUpdates: () -> Unit,
    onOneClickUpdate: () -> Unit,
    onRequestInstall: (File) -> Boolean,
    onInstallAborted: () -> Unit,
    onCancelDownload: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val showUpdateAction = update.updateAvailable && update.apkAvailable
    val showUnpublishedBanner = update.updateAvailable && !update.apkAvailable && !update.isChecking
    val primaryBusy = update.isChecking || update.isDownloading

    LaunchedEffect(update.installRequestNonce) {
        if (update.installRequestNonce == 0L) return@LaunchedEffect
        if (!canShowOtaInstallButton(update)) {
            onInstallAborted()
            return@LaunchedEffect
        }
        val apkPath = update.downloadedApkPath ?: run {
            onInstallAborted()
            return@LaunchedEffect
        }
        val file = File(apkPath)
        if (!file.exists()) {
            Toast.makeText(
                context,
                MobileAppUpdateMessages.apkFileMissing(context),
                Toast.LENGTH_LONG,
            ).show()
            onInstallAborted()
            return@LaunchedEffect
        }
        val expectedSha =
            update.apkSha256?.trim()?.lowercase()
                ?: MobileAppUpdatePrefs.readExpectedSha256(context)
        if (
            !MobileAppUpdateHash.matchesExpected(
                MobileAppUpdateHash.sha256Hex(file),
                expectedSha,
            )
        ) {
            Toast.makeText(
                context,
                context.getString(R.string.profile_updates_hash_mismatch),
                Toast.LENGTH_LONG,
            ).show()
            onInstallAborted()
            return@LaunchedEffect
        }
        val launched = onRequestInstall(file)
        if (!launched) {
            Toast.makeText(
                context,
                MobileAppUpdateMessages.installLaunchFailed(context),
                Toast.LENGTH_LONG,
            ).show()
            onInstallAborted()
        }
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (update.isChecking && !update.isDownloading) {
            AppUpdateBanner(
                title = stringResource(R.string.profile_updates_checking_title),
                message = stringResource(R.string.profile_updates_checking_hint),
                icon = Icons.Outlined.Refresh,
            )
        }

        when (update.updateUrgency) {
            OtaUpdateUrgency.CRITICAL ->
                AppUpdateBanner(
                    title = stringResource(R.string.profile_updates_urgency_critical),
                    message = update.releaseNotes,
                    icon = Icons.Outlined.SystemUpdate,
                    isError = true,
                )
            OtaUpdateUrgency.RECOMMENDED ->
                AppUpdateBanner(
                    title = stringResource(R.string.profile_updates_urgency_recommended),
                    message = update.releaseNotes,
                    icon = Icons.Outlined.SystemUpdate,
                )
            OtaUpdateUrgency.OPTIONAL ->
                update.releaseNotes?.let { notes ->
                    AppUpdateBanner(
                        title = stringResource(R.string.profile_updates_release_notes),
                        message = notes,
                        icon = Icons.Outlined.Info,
                    )
                }
            else -> Unit
        }

        if (showUnpublishedBanner) {
            AppUpdateBanner(
                title = stringResource(R.string.profile_updates_banner_unpublished_title),
                message = stringResource(R.string.profile_updates_banner_unpublished_hint),
                icon = Icons.Outlined.SystemUpdate,
                isError = true,
            )
        }
        if (showUpdateAction) {
            AppUpdateBanner(
                title = stringResource(R.string.profile_updates_banner_title),
                message = update.serverVersionName?.let { version ->
                    stringResource(R.string.profile_updates_banner_version, version)
                },
                icon = Icons.Outlined.SystemUpdate,
            )
        } else if (
            !update.isChecking &&
            update.serverVersionCode != null &&
            !update.updateAvailable
        ) {
            val installedVersionLabel =
                update.installedVersionName.takeIf { it.isNotBlank() }
                    ?: update.installedVersionCode.takeIf { it > 0 }?.toString()
            AppUpdateBanner(
                title = stringResource(R.string.profile_updates_up_to_date),
                message =
                    installedVersionLabel?.let { version ->
                        stringResource(R.string.profile_updates_current_version, version)
                    },
                icon = Icons.Outlined.CheckCircle,
                isSuccess = true,
            )
        }

        val showUpToDateStatus =
            !update.isChecking &&
                update.serverVersionCode != null &&
                !update.updateAvailable
        update.statusMessage?.takeUnless { showUpToDateStatus }?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        update.error?.let { err ->
            Text(
                text = err,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        }
        if (update.sha256Verification == ApkSha256VerificationState.FAILED) {
            Text(
                stringResource(R.string.profile_updates_sha_failed),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelSmall,
            )
        }

        if (!MobileApkInstaller.canInstallPackages(context) && canShowOtaInstallButton(update)) {
            AppUpdateBanner(
                title = stringResource(R.string.profile_updates_unknown_sources_title),
                message = stringResource(R.string.profile_updates_unknown_sources_body),
                icon = Icons.Outlined.SystemUpdate,
                isError = true,
            )
        }
        if (update.isDownloading) {
            val progress = update.downloadProgress
            PremiumRowSurface(
                containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.24f),
                borderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (progress != null) {
                        LinearProgressIndicator(
                            progress = { progress.coerceIn(0f, 1f) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text(
                            text = stringResource(
                                R.string.profile_updates_download_progress,
                                (progress.coerceIn(0f, 1f) * 100f).toInt(),
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }

        ScaledButton(
            onClick = if (showUpdateAction) onOneClickUpdate else onCheckForUpdates,
            enabled = if (showUpdateAction) !primaryBusy else !update.isChecking,
            label =
                stringResource(
                    if (showUpdateAction) {
                        R.string.profile_updates_update
                    } else {
                        R.string.profile_updates_check
                    },
                ),
            icon =
                if (showUpdateAction) {
                    Icons.Outlined.SystemUpdate
                } else {
                    Icons.Outlined.Refresh
                },
            loading = primaryBusy,
            modifier = Modifier.fillMaxWidth(),
        )
        if (update.isDownloading) {
            ScaledOutlinedButton(
                onClick = onCancelDownload,
                enabled = true,
                label = stringResource(R.string.profile_updates_cancel_download),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
