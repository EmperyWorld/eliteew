package world.empery.eliteew.keycloak.binding;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Native OIDC clients that must pass binding SPI; others skip.
 *
 * <p>Invariants: empery-web and empery-mobile never enter the decision API.
 */
public final class ClientAllowlist {

  private ClientAllowlist() {}

  public static boolean isNativeClient(String clientId) {
    if (clientId == null) {
      return false;
    }
    String id = clientId.trim();
    return BindingConstants.CLIENT_DESKTOP.equals(id)
        || BindingConstants.CLIENT_FOFLINE.equals(id);
  }
}
