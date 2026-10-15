package world.empery.eliteew.keycloak.binding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;

class TicketExtractorTest {

  @Test
  void readsParClientNote() {
    String ticket = "t".repeat(24);
    assertEquals(
        ticket,
        TicketExtractor.extract(
            Map.of("client_request_param_eliteew_ticket", ticket), Map.of("ticket", "ignored")));
  }

  @Test
  void readsDirectClientNoteForNonParCompatibility() {
    String ticket = "d".repeat(24);
    assertEquals(
        ticket,
        TicketExtractor.extract(Map.of("eliteew_ticket", ticket), Map.of("ticket", "ignored")));
  }

  @Test
  void readsPrefixedDpopRequestParameter() {
    String dpopJkt = "j".repeat(43);
    assertEquals(
        dpopJkt,
        TicketExtractor.requestParameter(
            Map.of("client_request_param_dpop_jkt", dpopJkt), "dpop_jkt"));
  }

  @Test
  void readsFormWhenNoteMissing() {
    String ticket = "f".repeat(24);
    assertEquals(ticket, TicketExtractor.extract(Map.of(), Map.of("eliteew_ticket", ticket)));
  }

  @Test
  void ignoresGenericTicketKeyAndShortValues() {
    assertNull(TicketExtractor.extract(Map.of("ticket", "x".repeat(24)), Map.of()));
    assertNull(TicketExtractor.extract(Map.of("eliteew_ticket", "short"), Map.of()));
    assertNull(TicketExtractor.extract(Map.of(), Map.of()));
  }
}
