package com.admin.backend.finance;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBalanceRepository extends JpaRepository<UserBalance, Long> {

    Optional<UserBalance> findByUserId(Long userId);
}
