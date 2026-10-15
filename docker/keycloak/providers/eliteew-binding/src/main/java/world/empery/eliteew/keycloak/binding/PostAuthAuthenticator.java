package world.empery.eliteew.keycloak.binding;

import java.util.Map;
import java.util.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: REQUIRED post-auth bind: commit sub to the prechecked ticket before issuing a code.
 *
 * <p>Invariants: Cookie SSO does not skip this step; session notes never carry license/device ids.
 */
public final class PostAuthAuthenticator implements Authenticator {

  private static final Logger LOG = Logger.getLogger(PostAuthAuthenticator.class.getName());
  private final BindingHttpClient http;

  public PostAuthAuthenticator() {
    this(BindingHttpClient.fromEnv());
  }

  PostAuthAuthenticator(BindingHttpClient http) {
    this.http = http;
  }

  @Override
  public void authenticate(AuthenticationFlowContext context) {
    String clientId = PreAuthAuthenticator.clientId(context);
    if (!ClientAllowlist.isNativeClient(clientId)) {
      context.success();
      return;
    }
    UserModel user = context.getUser();
    if (user == null || user.getId() == null || user.getId().trim().length() < 8) {
      LOG.warning("[STEP] eliteew_binding_postauth_deny reason=user");
      context.failure(AuthenticationFlowError.ACCESS_DENIED);
      return;
    }
    AuthenticationSessionModel authSession = context.getAuthenticationSession();
    String ticket =
        authSession == null ? null : authSession.getClientNote(BindingConstants.NOTE_TICKET);
    if (ticket == null || ticket.isBlank()) {
      ticket = TicketExtractor.extract(PreAuthAuthenticator.clientNotes(context), Map.of());
    }
    if (ticket == null) {
      LOG.warning("[STEP] eliteew_binding_postauth_deny reason=ticket_missing");
      context.failure(AuthenticationFlowError.ACCESS_DENIED);
      return;
    }
    String email = user.getEmail();
    boolean verified = user.isEmailVerified();
    String idempotency = PreAuthAuthenticator.authSessionId(context);
    DecisionJson.Decision decision =
        http.commit(ticket, user.getId().trim(), email, verified, idempotency);
    if (decision == null
        || !decision.allowed()
        || decision.bindingId() == null
        || decision.authzEpoch() == null) {
      LOG.warning("[STEP] eliteew_binding_postauth_deny reason=commit");
      context.failure(AuthenticationFlowError.ACCESS_DENIED);
      return;
    }
    authSession.setUserSessionNote(BindingConstants.NOTE_BINDING_ID, decision.bindingId());
    authSession.setUserSessionNote(
        BindingConstants.NOTE_BINDING_EPOCH, String.valueOf(decision.authzEpoch()));
    authSession.setUserSessionNote(BindingConstants.NOTE_ACR, BindingConstants.ACR_DEVICE_BOUND);
    String dpopJkt = authSession.getClientNote("eliteew_dpop_jkt");
    if (dpopJkt != null && !dpopJkt.isBlank()) {
      authSession.setUserSessionNote("eliteew_dpop_jkt", dpopJkt.trim());
    }
    context.success();
  }

  @Override
  public void action(AuthenticationFlowContext context) {
    authenticate(context);
  }

  @Override
  public boolean requiresUser() {
    return true;
  }

  @Override
  public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
    return true;
  }

  @Override
  public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}

  @Override
  public void close() {}
}
