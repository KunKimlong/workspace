package com.admin.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.admin.backend.support.IntegrationTest;
import com.admin.backend.user.User;
import com.jayway.jsonpath.JsonPath;

import jakarta.servlet.http.Cookie;

/** Login, token types, refresh rotation and reuse detection, through the real HTTP endpoints. */
@AutoConfigureMockMvc
class AuthApiTest extends IntegrationTest {

    private static final String PASSWORD = "correct-horse-battery";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    User user;

    @BeforeEach
    void setUp() {
        user = createUser(PASSWORD);
    }

    private MvcResult login(String password) throws Exception {
        return mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(user.getEmail(), password)))
                .andReturn();
    }

    private static String accessToken(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private static Cookie refreshCookie(MvcResult result) {
        return result.getResponse().getCookie(AuthController.REFRESH_COOKIE);
    }

    private MvcResult refresh(Cookie cookie) throws Exception {
        return mvc.perform(post("/api/auth/refresh").cookie(cookie)).andReturn();
    }

    @Test
    void loginReturnsAnAccessTokenAndAnHttpOnlyRefreshCookie() throws Exception {
        MvcResult result = login(PASSWORD);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        Cookie cookie = refreshCookie(result);
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo("/api/auth");
        assertThat(result.getResponse().getHeader("Set-Cookie")).contains("SameSite=Strict");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + accessToken(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(user.getEmail()));
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        assertThat(login("wrong-password").getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void apiNeedsAnAccessToken() throws Exception {
        mvc.perform(get("/api/finance/summary").param("month", "2026-03")).andExpect(status().isUnauthorized());
    }

    @Test
    void aRefreshTokenIsNotAcceptedAsAnAccessToken() throws Exception {
        Cookie cookie = refreshCookie(login(PASSWORD));

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + cookie.getValue()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesTheToken() throws Exception {
        Cookie first = refreshCookie(login(PASSWORD));

        MvcResult refreshed = refresh(first);

        assertThat(refreshed.getResponse().getStatus()).isEqualTo(200);
        assertThat(refreshCookie(refreshed).getValue()).isNotEqualTo(first.getValue());
        assertThat(accessToken(refreshed)).isNotBlank();
    }

    @Test
    void reusingARotatedTokenRightAwayIsTreatedAsARace() throws Exception {
        Cookie first = refreshCookie(login(PASSWORD));
        refresh(first);

        assertThat(refresh(first).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void reusingAnOldRotatedTokenSignsTheUserOutEverywhere() throws Exception {
        Cookie first = refreshCookie(login(PASSWORD));
        Cookie second = refreshCookie(refresh(first));
        // Pretend the rotation happened well outside the grace window
        jdbc.update("update refresh_tokens set revoked_at = dateadd('MINUTE', -5, revoked_at) where revoked_at is not null");

        assertThat(refresh(first).getResponse().getStatus()).isEqualTo(401);
        // Including the newest token, even though it was revoked only a moment ago
        assertThat(refresh(second).getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void aLoggedOutTokenIsDeadAtOnce() throws Exception {
        Cookie cookie = refreshCookie(login(PASSWORD));

        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isNoContent());

        // The reuse grace window is only for tokens replaced by a refresh, never for logged-out ones
        assertThat(refresh(cookie).getResponse().getStatus()).isEqualTo(401);
    }
}
