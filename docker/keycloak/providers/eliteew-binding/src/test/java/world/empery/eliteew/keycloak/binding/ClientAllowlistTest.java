package world.empery.eliteew.keycloak.binding;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ClientAllowlistTest {

  @Test
  void nativeClientsOnly() {
    assertTrue(ClientAllowlist.isNativeClient("empery-desktop"));
    assertTrue(ClientAllowlist.isNativeClient("empery-fofline"));
    assertFalse(ClientAllowlist.isNativeClient("empery-web"));
    assertFalse(ClientAllowlist.isNativeClient("empery-mobile"));
    assertFalse(ClientAllowlist.isNativeClient("empery-api"));
    assertFalse(ClientAllowlist.isNativeClient(""));
    assertFalse(ClientAllowlist.isNativeClient(null));
  }
}
