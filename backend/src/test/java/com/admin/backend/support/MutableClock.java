package com.admin.backend.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/** A clock tests can set and move, so "today" and "now" are fixed and time can pass on demand. */
public class MutableClock extends Clock {

    private Instant instant;
    private ZoneId zone;

    public MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    public void set(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    public void advance(Duration duration) {
        instant = instant.plus(duration);
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(instant, zone);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
