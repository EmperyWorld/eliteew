package world.empery.eliteew.keycloak.binding;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Shared names for the desktop/FoFline Keycloak binding SPI.
 *
 * <p>Invariants: no license id, fingerprint, email, or quarantine reason in notes/claims.
 */
public final class BindingConstants {

  public static final String PREAUTH_ID = "eliteew-binding-preauth";
  public static final String POSTAUTH_ID = "eliteew-binding-postauth";
  public static final String REFRESH_EXECUTOR_ID = "eliteew-binding-refresh";

  public static final String TICKET_PARAM = "eliteew_ticket";
  public static final String PAR_CLIENT_NOTE_PREFIX = "client_request_param_";
  public static final String NOTE_TICKET = "eliteew.binding.ticket";
  public static final String NOTE_BINDING_ID = "eliteew_binding_id";
  public static final String NOTE_BINDING_EPOCH = "eliteew_binding_epoch";
  public static final String NOTE_ACR = "acr";
  public static final String ACR_DEVICE_BOUND = "eliteew-device-bound";

  public static final String SPI_TOKEN_HEADER = "X-Desktop-Client-Binding-Spi-Token";
  public static final String ENV_API_BASE = "ELITEEW_BINDING_API_BASE_URL";
  public static final String ENV_SPI_TOKEN = "DESKTOP_CLIENT_BINDING_SPI_TOKEN";
  public static final String DEFAULT_API_BASE =
      "https://app.eliteew.ru/api/v1/desktop-client";

  public static final int HTTP_MAX_BYTES = 64 * 1024;
  public static final int CONNECT_TIMEOUT_MS = 3000;
  public static final int REQUEST_TIMEOUT_MS = 5000;
  public static final int CIRCUIT_FAILURES = 5;
  public static final long CIRCUIT_OPEN_MS = 30_000L;

  public static final String GENERIC_DENY = "Authentication could not be completed";

  public static final String CLIENT_DESKTOP = "empery-desktop";
  public static final String CLIENT_FOFLINE = "empery-fofline";

  private BindingConstants() {}
}
