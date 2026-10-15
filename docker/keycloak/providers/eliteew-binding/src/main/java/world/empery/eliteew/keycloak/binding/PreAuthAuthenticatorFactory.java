package world.empery.eliteew.keycloak.binding;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Factory for the pre-auth binding authenticator.
 */
public final class PreAuthAuthenticatorFactory implements AuthenticatorFactory {

  private static final AuthenticationExecutionModel.Requirement[] REQUIREMENTS =
      new AuthenticationExecutionModel.Requirement[] {
        AuthenticationExecutionModel.Requirement.REQUIRED,
        AuthenticationExecutionModel.Requirement.DISABLED
      };

  @Override
  public String getId() {
    return BindingConstants.PREAUTH_ID;
  }

  @Override
  public String getDisplayType() {
    return "EliteEW binding pre-auth";
  }

  @Override
  public String getReferenceCategory() {
    return "eliteew-binding";
  }

  @Override
  public boolean isConfigurable() {
    return false;
  }

  @Override
  public AuthenticationExecutionModel.Requirement[] getRequirementChoices() {
    return REQUIREMENTS;
  }

  @Override
  public boolean isUserSetupAllowed() {
    return false;
  }

  @Override
  public String getHelpText() {
    return "Requires a PAR binding ticket before Cookie or forms for empery-desktop and empery-fofline.";
  }

  @Override
  public List<ProviderConfigProperty> getConfigProperties() {
    return List.of();
  }

  @Override
  public Authenticator create(KeycloakSession session) {
    return new PreAuthAuthenticator();
  }

  @Override
  public void init(Config.Scope config) {}

  @Override
  public void postInit(KeycloakSessionFactory factory) {}

  @Override
  public void close() {}
}
