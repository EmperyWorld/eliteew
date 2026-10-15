/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Track identity for the in-app Empery media player (UGS songs, EWDesk audio, etc.).
 */
package world.empery.mobile.core.media

data class EmperyMediaTrack(
    val id: String,
    val title: String,
    val uri: String,
    val mimeType: String? = null,
    val subtitle: String? = null,
    val artworkUrl: String? = null,
)
