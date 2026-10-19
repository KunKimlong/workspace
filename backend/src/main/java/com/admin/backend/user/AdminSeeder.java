package com.admin.backend.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.admin.backend.config.AppProperties;

/** Creates the default admin account from ADMIN_EMAIL / ADMIN_PASSWORD in .env. */
@Component
public class AdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties.Admin admin;

    public AdminSeeder(UserRepository users, PasswordEncoder passwordEncoder, AppProperties props) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.admin = props.admin();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (isBlank(admin.email()) || isBlank(admin.password())) {
            log.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set in .env - no default user created");
            return;
        }
        if (users.existsByEmailIgnoreCase(admin.email())) {
            return;
        }
        users.save(new User(admin.email().trim(), admin.name(), passwordEncoder.encode(admin.password()),
                User.Role.ADMIN));
        log.info("Created default admin user {}", admin.email());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
