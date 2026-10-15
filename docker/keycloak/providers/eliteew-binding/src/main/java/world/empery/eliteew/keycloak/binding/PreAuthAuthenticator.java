package world.empery.eliteew.keycloak.binding;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.http.HttpRequest;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: REQUIRED pre-auth gate: native clients need a PAR ticket before Cookie/forms.
 *
 * <p>Invariants: non-native clients skip; missing ticket or API deny → no credential form.
 */
public final class PreAuthAuthenticator implements Authenticator {

  private static final Logger LOG = Logger.getLogger(PreAuthAuthenticator.class.getName());
  private final BindingHttpClient http;

  public PreAuthAuthenticator() {
    this(BindingHttpClient.fromEnv());
  }

  PreAuthAuthenticator(BindingHttpClient http) {
    this.http = http;
  }

  @Override
  public void authenticate(AuthenticationFlowContext context) {
    String clientId = clientId(context);
    if (!ClientAllowlist.isNativeClient(clientId)) {
      context.success();
      return;
    }
    Map<String, String> clientNotes = clientNotes(context);
    String ticket = TicketExtractor.extract(clientNotes, formParams(context));
    if (ticket == null) {
      LOG.warning("[STEP] eliteew_binding_preauth_deny reason=ticket_missing");
      deny(context);
      return;
    }
    String sessionId = authSessionId(context);
    if (sessionId == null) {
      LOG.warning("[STEP] eliteew_binding_preauth_deny reason=auth_session");
      deny(context);
      return;
    }
    DecisionJson.Decision decision = http.precheck(ticket, sessionId, sessionId);
    if (decision == null || !decision.allowed()) {
      LOG.warning("[STEP] eliteew_binding_preauth_deny reason=precheck");
      deny(context);
      return;
    }
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    authSession.setClientNote(BindingConstants.NOTE_TICKET, ticket);
    if (decision.bindingId() != null) {
      authSession.setClientNote(BindingConstants.NOTE_BINDING_ID, decision.bindingId());
    }
    String dpopJkt = TicketExtractor.requestParameter(clientNotes, "dpop_jkt");
    if (dpopJkt != null && !dpopJkt.isBlank()) {
      authSession.setClientNote("eliteew_dpop_jkt", dpopJkt.trim());
    }
    context.success();
  }

  @Override
  public void action(AuthenticationFlowContext context) {
    authenticate(context);
  }

  @Override
  public boolean requiresUser() {
    return false;
  }

  @Override
  public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
    return true;
  }

  @Override
  public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}

  @Override
  public void close() {}

  static void deny(AuthenticationFlowContext context) {
    context.failure(AuthenticationFlowError.ACCESS_DENIED);
  }

  static String clientId(AuthenticationFlowContext context) {
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    if (authSession == null || authSession.getClient() == null) {
      return "";
    }
    String id = authSession.getClient().getClientId();
    return id == null ? "" : id;
  }

  static String authSessionId(AuthenticationFlowContext context) {
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    if (authSession == null) {
      return null;
    }
    if (authSession.getParentSession() != null && authSession.getParentSession().getId() != null) {
      String id = authSession.getParentSession().getId().trim();
      if (id.length() >= 8) {
        return id;
      }
    }
    String tab = authSession.getTabId();
    if (tab != null && tab.trim().length() >= 8) {
      return tab.trim();
    }
    return null;
  }

  static Map<String, String> clientNotes(AuthenticationFlowContext context) {
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    if (authSession == null || authSession.getClientNotes() == null) {
      return Map.of();
    }
    return authSession.getClientNotes();
  }

  static Map<String, String> formParams(AuthenticationFlowContext context) {
    HttpRequest request = context.getHttpRequest();
    if (request == null || request.getDecodedFormParameters() == null) {
      return Map.of();
    }
    Map<String, String> out = new HashMap<>();
    request
        .getDecodedFormParameters()
        .forEach(
            (key, values) -> {
              if (key != null && values != null && !values.isEmpty()) {
                out.put(key, values.get(0));
              }
            });
    return out;
  }
}
