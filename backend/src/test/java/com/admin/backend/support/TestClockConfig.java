package com.admin.backend.support;

import java.time.ZoneOffset;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the app's Clock with one tests control. */
@TestConfiguration
public class TestClockConfig {

    @Bean
    @Primary
    MutableClock testClock() {
        return new MutableClock(IntegrationTest.NOW, ZoneOffset.UTC);
    }
}
