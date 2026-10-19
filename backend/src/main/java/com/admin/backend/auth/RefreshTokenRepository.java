package com.admin.backend.auth;

import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.admin.backend.user.User;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.user = :user and t.revokedAt is null")
    int revokeAllForUser(User user, Instant now);

    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :now")
    int deleteExpired(Instant now);
}
