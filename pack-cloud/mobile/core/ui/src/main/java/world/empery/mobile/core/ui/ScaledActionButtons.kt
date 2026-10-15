/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Scale-aware Material buttons: text in COMPACT, icon-only in STANDARD/COMFORT when icon is set.
 *
 * Invariants:
 * - [label] is always used as contentDescription in icon-only mode.
 *
 * Related:
 * - MobileUiScale.kt, LocalMobileUiScale.kt, MobileScaleChromePolicy.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun usesIconControls(): Boolean = usesScaleAwareIconControls()

@Composable
fun ScaledChoiceButton(
    selected: Boolean,
    onClick: () -> Unit,
    enabled: Boolean,
    label: String,
    icon: ImageVector?,
    modifier: Modifier = Modifier,
    shapeRadius: Int = 14,
    forceIconOnly: Boolean = false,
) {
    val iconOnly = (usesIconControls() || forceIconOnly) && icon != null
    val shape = RoundedCornerShape(shapeRadius.dp)
    if (iconOnly) {
        if (selected) {
            Button(
                onClick = onClick,
                enabled = enabled,
                shape = shape,
                modifier = modifier.height(48.dp),
                contentPadding = PaddingValues(horizontal = 4.dp),
            ) {
                Icon(imageVector = icon!!, contentDescription = label, modifier = Modifier.size(22.dp))
            }
        } else {
            OutlinedButton(
                onClick = onClick,
                enabled = enabled,
                shape = shape,
                modifier = modifier.height(48.dp),
                contentPadding = PaddingValues(horizontal = 4.dp),
            ) {
                Icon(imageVector = icon!!, contentDescription = label, modifier = Modifier.size(22.dp))
            }
        }
    } else if (selected) {
        Button(onClick = onClick, enabled = enabled, shape = shape, modifier = modifier) {
            ScaledButtonLabel(label = label, icon = icon)
        }
    } else {
        OutlinedButton(onClick = onClick, enabled = enabled, shape = shape, modifier = modifier) {
            ScaledButtonLabel(label = label, icon = icon)
        }
    }
}

@Composable
fun ScaledOutlinedButton(
    onClick: () -> Unit,
    enabled: Boolean,
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
    shapeRadius: Int = 14,
) {
    val shape = RoundedCornerShape(shapeRadius.dp)
    val iconOnly = usesIconControls() && icon != null
    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = shape,
        modifier = if (iconOnly) modifier.height(48.dp) else modifier,
        contentPadding = if (iconOnly) PaddingValues(horizontal = 12.dp) else PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            if (!iconOnly) Spacer(modifier = Modifier.width(8.dp))
        }
        if (iconOnly && icon != null) {
            Icon(imageVector = icon, contentDescription = label, modifier = Modifier.size(22.dp))
        } else {
            ScaledButtonLabel(label = label, icon = icon, showText = true)
        }
    }
}

@Composable
fun ScaledButton(
    onClick: () -> Unit,
    enabled: Boolean,
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
    shapeRadius: Int = 16,
) {
    val shape = RoundedCornerShape(shapeRadius.dp)
    val iconOnly = usesIconControls() && icon != null
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        shape = shape,
        modifier = if (iconOnly) modifier.height(48.dp) else modifier,
        contentPadding = if (iconOnly) PaddingValues(horizontal = 12.dp) else PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            if (!iconOnly) Spacer(modifier = Modifier.width(8.dp))
        }
        if (iconOnly && icon != null) {
            Icon(imageVector = icon, contentDescription = label, modifier = Modifier.size(22.dp))
        } else {
            ScaledButtonLabel(label = label, icon = icon, showText = true)
        }
    }
}

@Composable
private fun ScaledButtonLabel(
    label: String,
    icon: ImageVector?,
    showText: Boolean = usesIconControls().not() || icon == null,
) {
    if (icon != null) {
        Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(18.dp))
        if (showText) Spacer(modifier = Modifier.width(8.dp))
    }
    if (showText) {
        Text(text = label, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun ScaledFloatingActionButton(
    onClick: () -> Unit,
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    shapeRadius: Int = 18,
) {
    val shape = RoundedCornerShape(shapeRadius.dp)
    val containerColor = MaterialTheme.colorScheme.primaryContainer
    val contentColor = MaterialTheme.colorScheme.onPrimaryContainer
    if (usesIconControls()) {
        FloatingActionButton(
            onClick = onClick,
            modifier = modifier,
            shape = shape,
            containerColor = containerColor,
            contentColor = contentColor,
        ) {
            Icon(imageVector = icon, contentDescription = label)
        }
    } else {
        ExtendedFloatingActionButton(
            onClick = onClick,
            modifier = modifier,
            shape = shape,
            containerColor = containerColor,
            contentColor = contentColor,
            icon = { Icon(imageVector = icon, contentDescription = null) },
            text = { Text(text = label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        )
    }
}
