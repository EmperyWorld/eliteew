package world.empery.eliteew.keycloak.binding;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

/**
 * EliteEW · Empery World · https://empery.world Author: po&T && TZBrand
 *
 * <p>Purpose: Fail-closed HTTP to EliteEW binding decision routes.
 *
 * <p>Invariants: 64 KiB body cap, timeouts, circuit open on repeated failures, never log token or
 * ticket plaintext.
 */
public final class BindingHttpClient {

  private static final Logger LOG = Logger.getLogger(BindingHttpClient.class.getName());

  private final String apiBase;
  private final String spiToken;
  private final HttpClient http;
  private final AtomicInteger consecutiveFailures = new AtomicInteger();
  private final AtomicLong circuitOpenUntilMs = new AtomicLong();

  public BindingHttpClient(String apiBase, String spiToken, HttpClient http) {
    this.apiBase = BindingEnv.trimSlash(Objects.requireNonNull(apiBase));
    this.spiToken = spiToken == null ? "" : spiToken;
    this.http = Objects.requireNonNull(http);
  }

  public static BindingHttpClient fromEnv() {
    return new BindingHttpClient(
        BindingEnv.apiBaseUrl(), BindingEnv.spiToken(), buildHttpClient());
  }

  static HttpClient buildHttpClient() {
    return HttpClient.newBuilder()
        .connectTimeout(Duration.ofMillis(BindingConstants.CONNECT_TIMEOUT_MS))
        .followRedirects(HttpClient.Redirect.NEVER)
        .version(HttpClient.Version.HTTP_1_1)
        .build();
  }

  public DecisionJson.Decision precheck(String ticket, String authSessionId, String idempotencyKey) {
    String body =
        "{"
            + jsonPair("ticket", ticket)
            + ","
            + jsonPair("keycloak_auth_session_id", authSessionId)
            + optionalIdempotency(idempotencyKey)
            + "}";
    return post("/auth/internal/precheck", body);
  }

  public DecisionJson.Decision commit(
      String ticket, String keycloakSub, String email, boolean emailVerified, String idempotencyKey) {
    StringBuilder body = new StringBuilder();
    body.append('{')
        .append(jsonPair("ticket", ticket))
        .append(',')
        .append(jsonPair("keycloak_sub", keycloakSub))
        .append(',')
        .append("\"email_verified\":")
        .append(emailVerified);
    if (email != null && !email.isBlank()) {
      body.append(',').append(jsonPair("email", email.trim()));
    }
    if (idempotencyKey != null && !idempotencyKey.isBlank()) {
      body.append(',').append(jsonPair("idempotency_key", idempotencyKey.trim()));
    }
    body.append('}');
    return post("/auth/internal/commit", body.toString());
  }

  public DecisionJson.Decision refreshDecision(
      String bindingId,
      String keycloakSub,
      String clientId,
      String dpopJkt,
      int authzEpoch,
      String idempotencyKey) {
    String body =
        "{"
            + jsonPair("binding_id", bindingId)
            + ","
            + jsonPair("keycloak_sub", keycloakSub)
            + ","
            + jsonPair("client_id", clientId)
            + ","
            + jsonPair("dpop_jkt", dpopJkt)
            + ",\"authz_epoch\":"
            + authzEpoch
            + optionalIdempotency(idempotencyKey)
            + "}";
    return post("/auth/internal/refresh-decision", body);
  }

  DecisionJson.Decision post(String path, String jsonBody) {
    if (spiToken.isEmpty()) {
      LOG.fine("[STEP] eliteew_binding_http_deny reason=spi_token_missing");
      return DecisionJson.parse("{\"allowed\":false}");
    }
    long now = System.currentTimeMillis();
    if (now < circuitOpenUntilMs.get()) {
      LOG.fine("[STEP] eliteew_binding_http_deny reason=circuit_open");
      return DecisionJson.parse("{\"allowed\":false}");
    }
    URI uri;
    try {
      uri = URI.create(apiBase + path);
    } catch (IllegalArgumentException ex) {
      LOG.fine("[STEP] eliteew_binding_http_deny reason=bad_base");
      return DecisionJson.parse("{\"allowed\":false}");
    }
    if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
      LOG.fine("[STEP] eliteew_binding_http_deny reason=bad_scheme");
      return DecisionJson.parse("{\"allowed\":false}");
    }
    byte[] payload = jsonBody.getBytes(StandardCharsets.UTF_8);
    if (payload.length > BindingConstants.HTTP_MAX_BYTES) {
      LOG.fine("[STEP] eliteew_binding_http_deny reason=request_too_large");
      return DecisionJson.parse("{\"allowed\":false}");
    }
    HttpRequest request =
        HttpRequest.newBuilder(uri)
            .timeout(Duration.ofMillis(BindingConstants.REQUEST_TIMEOUT_MS))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header(BindingConstants.SPI_TOKEN_HEADER, spiToken)
            .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
            .build();
    try {
      HttpResponse<InputStream> response =
          http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      int status = response.statusCode();
      String body = readBounded(response.body());
      if (body == null) {
        markFailure();
        LOG.fine("[STEP] eliteew_binding_http_deny reason=body_cap status=" + status);
        return DecisionJson.parse("{\"allowed\":false}");
      }
      if (status < 200 || status >= 300) {
        markFailure();
        LOG.fine("[STEP] eliteew_binding_http_deny reason=http status=" + status);
        return DecisionJson.parse("{\"allowed\":false}");
      }
      consecutiveFailures.set(0);
      DecisionJson.Decision parsed = DecisionJson.parse(body);
      if (!parsed.allowed()) {
        LOG.fine("[STEP] eliteew_binding_http_deny reason=decision");
      }
      return parsed;
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      markFailure();
      LOG.fine("[STEP] eliteew_binding_http_deny reason=interrupted");
      return DecisionJson.parse("{\"allowed\":false}");
    } catch (IOException ex) {
      markFailure();
      LOG.fine("[STEP] eliteew_binding_http_deny reason=network");
      return DecisionJson.parse("{\"allowed\":false}");
    }
  }

  private void markFailure() {
    int n = consecutiveFailures.incrementAndGet();
    if (n >= BindingConstants.CIRCUIT_FAILURES) {
      circuitOpenUntilMs.set(System.currentTimeMillis() + BindingConstants.CIRCUIT_OPEN_MS);
      consecutiveFailures.set(0);
      LOG.fine("[STEP] eliteew_binding_http_circuit_open");
    }
  }

  static String readBounded(InputStream in) throws IOException {
    byte[] buf = new byte[BindingConstants.HTTP_MAX_BYTES + 1];
    int offset = 0;
    while (offset < buf.length) {
      int n = in.read(buf, offset, buf.length - offset);
      if (n < 0) {
        break;
      }
      offset += n;
    }
    if (offset > BindingConstants.HTTP_MAX_BYTES) {
      return null;
    }
    return new String(buf, 0, offset, StandardCharsets.UTF_8);
  }

  private static String optionalIdempotency(String key) {
    if (key == null || key.isBlank()) {
      return "";
    }
    return "," + jsonPair("idempotency_key", key.trim());
  }

  static String jsonPair(String key, String value) {
    return "\"" + escape(key) + "\":\"" + escape(value == null ? "" : value) + "\"";
  }

  static String escape(String raw) {
    StringBuilder out = new StringBuilder(raw.length() + 8);
    for (int i = 0; i < raw.length(); i++) {
      char c = raw.charAt(i);
      switch (c) {
        case '\\' -> out.append("\\\\");
        case '"' -> out.append("\\\"");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> out.append(c);
      }
    }
    return out.toString();
  }
}
