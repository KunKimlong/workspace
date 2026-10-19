package com.admin.backend.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

import com.admin.backend.config.AppProperties;
import com.admin.backend.user.User;

/**
 * Issues and verifies HS256-signed JWTs. Access and refresh tokens share the key but carry a
 * {@code type} claim, so a refresh token is never accepted as an access token and vice versa.
 */
@Service
public class JwtService {

    public static final String ISSUER = "admin-backend";
    public static final String TYPE_CLAIM = "type";
    public static final String ACCESS = "access";
    public static final String REFRESH = "refresh";

    public record IssuedToken(String value, String id, Instant expiresAt) {
    }

    private final JwtEncoder encoder;
    private final JwtDecoder refreshDecoder;
    private final AppProperties.Jwt props;

    public JwtService(JwtEncoder encoder, SecretKey jwtKey, AppProperties appProperties) {
        this.encoder = encoder;
        this.refreshDecoder = decoder(jwtKey, REFRESH);
        this.props = appProperties.jwt();
    }

    public IssuedToken issueAccessToken(User user) {
        return issue(user, ACCESS, props.accessTokenTtl());
    }

    public IssuedToken issueRefreshToken(User user) {
        return issue(user, REFRESH, props.refreshTokenTtl());
    }

    /** Verifies signature, expiry and type; throws {@link JwtException} if invalid. */
    public Jwt decodeRefreshToken(String token) {
        return refreshDecoder.decode(token);
    }

    private IssuedToken issue(User user, String type, Duration ttl) {
        Instant now = Instant.now();
        String id = UUID.randomUUID().toString();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .id(id)
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .claim(TYPE_CLAIM, type);
        if (ACCESS.equals(type)) {
            claims.claim("email", user.getEmail())
                    .claim("name", user.getName())
                    .claim("roles", List.of(user.getRole().name()));
        }
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String value = encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
        return new IssuedToken(value, id, now.plus(ttl));
    }

    static SecretKey secretKey(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must be set in backend/.env and be at least 32 characters long");
        }
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    static JwtDecoder decoder(SecretKey key, String requiredType) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(ISSUER),
                jwt -> requiredType.equals(jwt.getClaimAsString(TYPE_CLAIM))
                        ? OAuth2TokenValidatorResult.success()
                        : OAuth2TokenValidatorResult.failure(
                                new OAuth2Error("invalid_token", "Expected a " + requiredType + " token", null))));
        return decoder;
    }
}
