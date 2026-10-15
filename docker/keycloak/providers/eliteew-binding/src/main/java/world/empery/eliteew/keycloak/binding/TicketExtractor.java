package world.empery.eliteew.keycloak.binding;

import java.util.Map;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Read the binding ticket from PAR/auth-session notes, never from product Start URL.
 *
 * <p>Invariants: query-string product params are ignored; generic {@code ticket} key is ignored.
 */
public final class TicketExtractor {

  private TicketExtractor() {}

  public static String extract(Map<String, String> clientNotes, Map<String, String> formParams) {
    String fromNote = first(clientNotes, BindingConstants.NOTE_TICKET);
    if (fromNote != null) {
      return fromNote;
    }
    fromNote = requestParameter(clientNotes, BindingConstants.TICKET_PARAM);
    if (fromNote != null) {
      return fromNote;
    }
    return first(formParams, BindingConstants.TICKET_PARAM);
  }

  static String requestParameter(Map<String, String> clientNotes, String name) {
    return first(clientNotes, name, BindingConstants.PAR_CLIENT_NOTE_PREFIX + name);
  }

  private static String first(Map<String, String> map, String... keys) {
    if (map == null) {
      return null;
    }
    for (String key : keys) {
      String raw = map.get(key);
      if (raw != null) {
        String trimmed = raw.trim();
        if (trimmed.length() >= 16 && trimmed.length() <= 512) {
          return trimmed;
        }
      }
    }
    return null;
  }
}
