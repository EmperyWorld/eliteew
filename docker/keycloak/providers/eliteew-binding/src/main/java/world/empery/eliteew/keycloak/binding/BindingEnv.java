package world.empery.eliteew.keycloak.binding;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Read SPI env without logging secrets.
 */
public final class BindingEnv {

  private BindingEnv() {}

  public static String apiBaseUrl() {
    String raw = System.getenv(BindingConstants.ENV_API_BASE);
    if (raw == null || raw.isBlank()) {
      return BindingConstants.DEFAULT_API_BASE;
    }
    return trimSlash(raw.trim());
  }

  public static String spiToken() {
    String raw = System.getenv(BindingConstants.ENV_SPI_TOKEN);
    return raw == null ? "" : raw.trim();
  }

  static String trimSlash(String url) {
    int end = url.length();
    while (end > 0 && url.charAt(end - 1) == '/') {
      end--;
    }
    return url.substring(0, end);
  }
}
