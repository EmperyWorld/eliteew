package world.empery.eliteew.keycloak.binding;

import java.util.logging.Logger;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.representations.idm.ClientPolicyExecutorConfigurationRepresentation;
import org.keycloak.services.clientpolicy.ClientPolicyContext;
import org.keycloak.services.clientpolicy.ClientPolicyEvent;
import org.keycloak.services.clientpolicy.ClientPolicyException;
import org.keycloak.services.clientpolicy.executor.ClientPolicyExecutorProvider;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: TOKEN_REFRESH executor: native clients need a live EliteEW binding decision.
 *
 * <p>Invariants: missing notes on native clients fail closed; web/mobile skip.
 */
public final class RefreshPolicyExecutor
    implements ClientPolicyExecutorProvider<ClientPolicyExecutorConfigurationRepresentation> {

  private static final Logger LOG = Logger.getLogger(RefreshPolicyExecutor.class.getName());
  private final KeycloakSession session;
  private final BindingHttpClient http;

  public RefreshPolicyExecutor(KeycloakSession session) {
    this(session, BindingHttpClient.fromEnv());
  }

  RefreshPolicyExecutor(KeycloakSession session, BindingHttpClient http) {
    this.session = session;
    this.http = http;
  }

  @Override
  public String getProviderId() {
    return BindingConstants.REFRESH_EXECUTOR_ID;
  }

  @Override
  public void executeOnEvent(ClientPolicyContext context) throws ClientPolicyException {
    if (context == null || context.getEvent() != ClientPolicyEvent.TOKEN_REFRESH) {
      return;
    }
    KeycloakContext kc = session.getContext();
    ClientModel client = kc.getClient();
    String clientId = client == null ? "" : client.getClientId();
    if (!ClientAllowlist.isNativeClient(clientId)) {
      return;
    }
    UserSessionModel userSession = kc.getUserSession();
    UserModel user = userSession == null ? null : userSession.getUser();
    if (user == null) {
      user = kc.getUser();
    }
    String sub = user == null || user.getId() == null ? "" : user.getId().trim();
    String bindingId = note(userSession, BindingConstants.NOTE_BINDING_ID);
    String epochRaw = note(userSession, BindingConstants.NOTE_BINDING_EPOCH);
    String dpopJkt = note(userSession, "eliteew_dpop_jkt");
    int epoch;
    try {
      epoch = Integer.parseInt(epochRaw);
    } catch (NumberFormatException ex) {
      epoch = -1;
    }
    if (sub.length() < 8 || bindingId.length() < 8 || dpopJkt.length() < 8 || epoch < 1) {
      LOG.fine("[STEP] eliteew_binding_refresh_deny reason=session_notes");
      throw deny();
    }
    DecisionJson.Decision decision =
        http.refreshDecision(bindingId, sub, clientId, dpopJkt, epoch, bindingId);
    if (decision == null || !decision.allowed()) {
      LOG.fine("[STEP] eliteew_binding_refresh_deny reason=decision");
      throw deny();
    }
  }

  @Override
  public void close() {}

  private static String note(UserSessionModel userSession, String name) {
    if (userSession == null || name == null) {
      return "";
    }
    String value = userSession.getNote(name);
    return value == null ? "" : value.trim();
  }

  private static ClientPolicyException deny() throws ClientPolicyException {
    return new ClientPolicyException("access_denied", BindingConstants.GENERIC_DENY);
  }
}
