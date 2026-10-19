package com.admin.backend.auth;

import java.time.Duration;
import java.time.Instant;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.admin.backend.config.AppProperties;
import com.admin.backend.user.User;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Login returns a short-lived access token in the JSON body and sets the refresh token as an
 * HttpOnly cookie scoped to /api/auth, so page scripts can never read it.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String REFRESH_COOKIE = "refresh_token";
    private static final String COOKIE_PATH = "/api/auth";

    public record LoginRequest(
            @NotBlank(message = "Email is required") @Email(message = "Email is invalid") String email,
            @NotBlank(message = "Password is required") String password) {
    }

    public record UserResponse(Long id, String email, String name, User.Role role) {
        static UserResponse of(User user) {
            return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getRole());
        }
    }

    public record TokenResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {
    }

    private final AuthService authService;
    private final boolean cookieSecure;

    public AuthController(AuthService authService, AppProperties props) {
        this.authService = authService;
        this.cookieSecure = props.jwt().cookieSecure();
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req) {
        return tokenResponse(authService.login(req.email(), req.password()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        return tokenResponse(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
                .build();
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return UserResponse.of(authService.currentUser(jwt));
    }

    private ResponseEntity<TokenResponse> tokenResponse(AuthService.AuthResult result) {
        Instant now = Instant.now();
        Duration refreshTtl = Duration.between(now, result.refreshToken().expiresAt());
        long expiresIn = Duration.between(now, result.accessToken().expiresAt()).toSeconds();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken().value(), refreshTtl).toString())
                .body(new TokenResponse(result.accessToken().value(), "Bearer", expiresIn,
                        UserResponse.of(result.user())));
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
