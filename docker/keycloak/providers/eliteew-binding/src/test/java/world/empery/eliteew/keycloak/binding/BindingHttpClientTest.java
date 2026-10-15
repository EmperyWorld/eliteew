package world.empery.eliteew.keycloak.binding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BindingHttpClientTest {

  private HttpServer server;

  @AfterEach
  void stop() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void productionClientUsesHttp11ForUvicornDecisionService() {
    assertEquals(HttpClient.Version.HTTP_1_1, BindingHttpClient.buildHttpClient().version());
  }

  @Test
  void emptySpiTokenIsFailClosedWithoutHttp() throws Exception {
    AtomicInteger hits = new AtomicInteger();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/auth/internal/precheck",
        exchange -> {
          hits.incrementAndGet();
          exchange.sendResponseHeaders(200, 0);
          exchange.close();
        });
    server.start();
    BindingHttpClient client = newClient("");
    DecisionJson.Decision d = client.precheck("t".repeat(24), "auth-session-1", null);
    assertFalse(d.allowed());
    assertEquals(0, hits.get());
  }

  @Test
  void allowMapsFromDecisionJson() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/auth/internal/precheck",
        exchange -> {
          assertEquals(
              "spi-secret", exchange.getRequestHeaders().getFirst("X-Desktop-Client-Binding-Spi-Token"));
          byte[] body =
              "{\"allowed\":true,\"ticket_id\":\"tid\",\"binding_id\":\"bid\"}"
                  .getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    server.start();
    BindingHttpClient client = newClient("spi-secret");
    DecisionJson.Decision d = client.precheck("t".repeat(24), "auth-session-1", "idem-1");
    assertTrue(d.allowed());
    assertEquals("bid", d.bindingId());
  }

  @Test
  void http403AndOversizedBodyAreDeny() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/auth/internal/commit",
        exchange -> {
          exchange.sendResponseHeaders(403, 0);
          exchange.close();
        });
    server.createContext(
        "/auth/internal/refresh-decision",
        exchange -> {
          byte[] huge = new byte[BindingConstants.HTTP_MAX_BYTES + 8];
          exchange.sendResponseHeaders(200, huge.length);
          exchange.getResponseBody().write(huge);
          exchange.close();
        });
    server.start();
    BindingHttpClient client = newClient("spi-secret");
    assertFalse(client.commit("t".repeat(24), "sub-12345678", null, false, null).allowed());
    assertFalse(
        client.refreshDecision("bind-1234", "sub-12345678", "empery-desktop", "jkt-1234", 1, null)
            .allowed());
  }

  @Test
  void circuitOpensAfterConsecutiveFailures() throws Exception {
    AtomicInteger hits = new AtomicInteger();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/auth/internal/precheck",
        exchange -> {
          hits.incrementAndGet();
          exchange.sendResponseHeaders(503, 0);
          exchange.close();
        });
    server.start();
    BindingHttpClient client = newClient("spi-secret");
    for (int i = 0; i < BindingConstants.CIRCUIT_FAILURES; i++) {
      assertFalse(client.precheck("t".repeat(24), "auth-session-1", null).allowed());
    }
    int afterOpen = hits.get();
    assertEquals(BindingConstants.CIRCUIT_FAILURES, afterOpen);
    assertFalse(client.precheck("t".repeat(24), "auth-session-1", null).allowed());
    assertEquals(afterOpen, hits.get());
  }

  private BindingHttpClient newClient(String token) {
    int port = server.getAddress().getPort();
    HttpClient http =
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    return new BindingHttpClient("http://127.0.0.1:" + port, token, http);
  }
}
