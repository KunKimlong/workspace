package com.admin.backend.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** One clock for every "today" / "now" decision, so the day boundary follows app.time-zone and tests can fix it. */
@Configuration
public class TimeConfig {

    @Bean
    Clock clock(AppProperties props) {
        String zone = props.timeZone();
        return zone == null || zone.isBlank() ? Clock.systemDefaultZone() : Clock.system(ZoneId.of(zone.trim()));
    }
}
