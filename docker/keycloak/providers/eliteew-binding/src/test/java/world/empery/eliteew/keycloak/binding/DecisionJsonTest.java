package world.empery.eliteew.keycloak.binding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DecisionJsonTest {

  @Test
  void parsesAllowWithBinding() {
    DecisionJson.Decision d =
        DecisionJson.parse(
            "{\"allowed\": true, \"ticket_id\": \"tid-1\", \"binding_id\": \"bind-9\", \"authz_epoch\": 4}");
    assertTrue(d.allowed());
    assertEquals("tid-1", d.ticketId());
    assertEquals("bind-9", d.bindingId());
    assertEquals(4, d.authzEpoch());
  }

  @Test
  void malformedOrOversizedIsDeny() {
    assertFalse(DecisionJson.parse("{not-json").allowed());
    assertFalse(DecisionJson.parse(null).allowed());
    assertNull(DecisionJson.parse("{\"allowed\":false}").bindingId());
  }
}
