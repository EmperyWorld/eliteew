package world.empery.eliteew.keycloak.binding;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.services.clientpolicy.executor.ClientPolicyExecutorProvider;
import org.keycloak.services.clientpolicy.executor.ClientPolicyExecutorProviderFactory;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Factory for the TOKEN_REFRESH binding executor.
 */
public final class RefreshPolicyExecutorFactory implements ClientPolicyExecutorProviderFactory {

  @Override
  public String getId() {
    return BindingConstants.REFRESH_EXECUTOR_ID;
  }

  @Override
  public ClientPolicyExecutorProvider create(KeycloakSession session) {
    return new RefreshPolicyExecutor(session);
  }

  @Override
  public void init(Config.Scope config) {}

  @Override
  public void postInit(KeycloakSessionFactory factory) {}

  @Override
  public void close() {}

  @Override
  public boolean isSupported(Config.Scope config) {
    return true;
  }

  @Override
  public List<ProviderConfigProperty> getConfigProperties() {
    return List.of();
  }

  @Override
  public String getHelpText() {
    return "Calls EliteEW refresh-decision for empery-desktop and empery-fofline.";
  }
}
