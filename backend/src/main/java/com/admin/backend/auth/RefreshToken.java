package com.admin.backend.auth;

import java.time.Instant;

import com.admin.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Server-side record of an issued refresh token (keyed by its JWT id) so it can be rotated and revoked. */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant revokedAt;

    /** Revoked because a new token replaced it - the only kind of revocation the reuse grace window forgives. */
    @Column(nullable = false)
    private boolean rotated;

    protected RefreshToken() {
    }

    public RefreshToken(String id, User user, Instant expiresAt) {
        this.id = id;
        this.user = user;
        this.expiresAt = expiresAt;
    }

    public String getId() { return id; }
    public User getUser() { return user; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public boolean isRevoked() { return revokedAt != null; }
    public boolean isRotated() { return rotated; }

    /** Logout or theft: never usable again. */
    public void revoke() { if (revokedAt == null) revokedAt = Instant.now(); }

    /** Replaced by a new token during refresh. */
    public void rotate() {
        if (revokedAt == null) {
            revokedAt = Instant.now();
            rotated = true;
        }
    }
}
