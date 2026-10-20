package com.admin.backend.support;

import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.admin.backend.user.User;
import com.admin.backend.user.UserRepository;

/**
 * Base for tests that boot the whole app against an in-memory database (shared by every subclass, so
 * each test creates its own users). The app's Clock is replaced by a {@link MutableClock} (it's @Primary)
 * that starts at {@link #NOW} in UTC before every test.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:itdb;DB_CLOSE_DELAY=-1",
        "app.jwt.secret=test-secret-that-is-at-least-32-characters-long",
        "app.admin.email=",
        "app.admin.password=",
        "app.time-zone=UTC",
})
@Import(TestClockConfig.class)
public abstract class IntegrationTest {

    /** Sunday 15 March 2026, 10:00 UTC. */
    protected static final Instant NOW = Instant.parse("2026-03-15T10:00:00Z");

    @Autowired
    protected MutableClock clock;

    @Autowired
    protected UserRepository users;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @BeforeEach
    void resetClock() {
        clock.set(NOW, ZoneOffset.UTC);
    }

    protected User createUser(String password) {
        String email = "user-" + System.nanoTime() + "@example.com";
        return users.save(new User(email, "Test User", passwordEncoder.encode(password), User.Role.USER));
    }
}
