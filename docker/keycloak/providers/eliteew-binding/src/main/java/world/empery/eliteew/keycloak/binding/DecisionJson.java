package world.empery.eliteew.keycloak.binding;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Bounded parse of EliteEW binding decision JSON without extra libraries.
 *
 * <p>Invariants: unknown/malformed JSON is treated as deny.
 */
public final class DecisionJson {

  public record Decision(
      boolean allowed, String ticketId, String bindingId, Integer authzEpoch, String keycloakSub) {}

  private DecisionJson() {}

  public static Decision parse(String json) {
    if (json == null || json.isBlank() || json.length() > BindingConstants.HTTP_MAX_BYTES) {
      return new Decision(false, null, null, null, null);
    }
    boolean allowed = hasTrue(json, "allowed");
    return new Decision(
        allowed,
        stringField(json, "ticket_id"),
        stringField(json, "binding_id"),
        intField(json, "authz_epoch"),
        stringField(json, "keycloak_sub"));
  }

  static boolean hasTrue(String json, String key) {
    String needle = "\"" + key + "\"";
    int idx = json.indexOf(needle);
    if (idx < 0) {
      return false;
    }
    int colon = json.indexOf(':', idx + needle.length());
    if (colon < 0) {
      return false;
    }
    String rest = json.substring(colon + 1).trim();
    return rest.startsWith("true");
  }

  static String stringField(String json, String key) {
    String needle = "\"" + key + "\"";
    int idx = json.indexOf(needle);
    if (idx < 0) {
      return null;
    }
    int colon = json.indexOf(':', idx + needle.length());
    if (colon < 0) {
      return null;
    }
    String rest = json.substring(colon + 1).trim();
    if (rest.startsWith("null")) {
      return null;
    }
    if (!rest.startsWith("\"")) {
      return null;
    }
    StringBuilder out = new StringBuilder();
    boolean escape = false;
    for (int i = 1; i < rest.length(); i++) {
      char c = rest.charAt(i);
      if (escape) {
        out.append(c);
        escape = false;
        continue;
      }
      if (c == '\\') {
        escape = true;
        continue;
      }
      if (c == '"') {
        String value = out.toString().trim();
        return value.isEmpty() ? null : value;
      }
      out.append(c);
    }
    return null;
  }

  static Integer intField(String json, String key) {
    String needle = "\"" + key + "\"";
    int idx = json.indexOf(needle);
    if (idx < 0) {
      return null;
    }
    int colon = json.indexOf(':', idx + needle.length());
    if (colon < 0) {
      return null;
    }
    String rest = json.substring(colon + 1).trim();
    if (rest.startsWith("null")) {
      return null;
    }
    int end = 0;
    while (end < rest.length() && (Character.isDigit(rest.charAt(end)) || rest.charAt(end) == '-')) {
      end++;
    }
    if (end == 0) {
      return null;
    }
    try {
      return Integer.valueOf(rest.substring(0, end));
    } catch (NumberFormatException ex) {
      return null;
    }
  }
}
