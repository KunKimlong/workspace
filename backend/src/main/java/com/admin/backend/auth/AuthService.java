package com.admin.backend.auth;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.admin.backend.security.JwtService;
import com.admin.backend.security.JwtService.IssuedToken;
import com.admin.backend.user.User;
import com.admin.backend.user.UserRepository;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /**
     * A just-rotated refresh token presented again within this window is treated as a benign race
     * (e.g. two tabs refreshing at once) instead of token theft.
     */
    private static final Duration REUSE_GRACE = Duration.ofSeconds(30);

    public record AuthResult(User user, IssuedToken accessToken, IssuedToken refreshToken) {
    }

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
            PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dummyHash = passwordEncoder.encode("timing-equalizer");
    }

    @Transactional
    public AuthResult login(String email, String password) {
        User user = users.findByEmailIgnoreCase(email.trim()).orElse(null);
        // Always run a bcrypt check so response time doesn't reveal whether the email exists
        String hash = user != null ? user.getPasswordHash() : dummyHash;
        if (!passwordEncoder.matches(password, hash) || user == null) {
            throw unauthorized("Invalid email or password");
        }
        return issueTokens(user);
    }

    /** Rotates the refresh token: the presented one is revoked and a new pair is issued. */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AuthResult refresh(String token) {
        RefreshToken stored = findStored(token);
        if (stored.isRevoked()) {
            if (!stored.isRotated()) {
                // Logged out, or killed by reuse detection: dead for good, grace window or not
                throw unauthorized("Refresh token has been revoked");
            }
            if (stored.getRevokedAt().isAfter(Instant.now().minus(REUSE_GRACE))) {
                // Rotated moments ago, but the browser never got the new cookie (e.g. the page was
                // reloaded mid-refresh, or two tabs refreshed together): issue a fresh pair rather
                // than signing the user out.
                return issueTokens(stored.getUser());
            }
            // An old, already-rotated token is being replayed: assume it was stolen and
            // sign the user out everywhere.
            log.warn("Refresh token reuse detected for user {}", stored.getUser().getId());
            refreshTokens.revokeAllForUser(stored.getUser(), Instant.now());
            throw unauthorized("Refresh token has been revoked");
        }
        stored.rotate();
        refreshTokens.deleteExpired(Instant.now());
        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(String token) {
        try {
            findStored(token).revoke();
        } catch (ResponseStatusException ignored) {
            // Already invalid - nothing to revoke
        }
    }

    public User currentUser(Jwt accessToken) {
        return users.findById(Long.valueOf(accessToken.getSubject()))
                .orElseThrow(() -> unauthorized("User no longer exists"));
    }

    private RefreshToken findStored(String token) {
        if (token == null || token.isBlank()) {
            throw unauthorized("Missing refresh token");
        }
        Jwt jwt;
        try {
            jwt = jwtService.decodeRefreshToken(token);
        } catch (JwtException e) {
            throw unauthorized("Invalid or expired refresh token");
        }
        return refreshTokens.findById(jwt.getId())
                .orElseThrow(() -> unauthorized("Unknown refresh token"));
    }

    private AuthResult issueTokens(User user) {
        IssuedToken access = jwtService.issueAccessToken(user);
        IssuedToken refresh = jwtService.issueRefreshToken(user);
        refreshTokens.save(new RefreshToken(refresh.id(), user, refresh.expiresAt()));
        return new AuthResult(user, access, refresh);
    }

    private static ResponseStatusException unauthorized(String message) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
    }
}
