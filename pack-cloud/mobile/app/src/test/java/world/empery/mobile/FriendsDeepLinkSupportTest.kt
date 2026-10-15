package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FriendsDeepLinkSupportTest {
    @Test
    fun coerceFriendsNestedRoute_actionCenterAliases() {
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, coerceFriendsNestedRoute("action-center"))
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, coerceFriendsNestedRoute("action_center"))
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, coerceFriendsNestedRoute("relationship_action_center"))
        assertEquals(FRIENDS_ACTION_CENTER_ROUTE, coerceFriendsNestedRoute(FRIENDS_ACTION_CENTER_ROUTE))
    }

    @Test
    fun coerceFriendsNestedRoute_unknownOrBlankReturnsNull() {
        assertNull(coerceFriendsNestedRoute(""))
        assertNull(coerceFriendsNestedRoute(null))
        assertNull(coerceFriendsNestedRoute("request"))
        assertNull(coerceFriendsNestedRoute("friends/unknown"))
    }
}
