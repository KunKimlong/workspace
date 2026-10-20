package com.admin.backend.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the {@code app.*} section in application.yaml. {@code timeZone} decides what "today" is
 * (an IANA id such as Asia/Ho_Chi_Minh); blank means the server's own zone.
 */
@ConfigurationProperties("app")
public record AppProperties(Cors cors, Jwt jwt, Admin admin, String timeZone) {

    public record Cors(List<String> allowedOrigins) {
    }

    public record Jwt(String secret, Duration accessTokenTtl, Duration refreshTokenTtl, boolean cookieSecure) {
    }

    public record Admin(String email, String password, String name) {
    }
}
