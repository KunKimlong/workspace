package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    /** Inclusive date range, newest first. */
    List<Expense> findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(Long userId, LocalDate from, LocalDate to);

    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    /**
     * Spending recorded after the balance was entered, dated that day or later. Expenses entered
     * earlier, or back-dated ones, were already reflected in the balance the user typed.
     */
    @Query("""
            select coalesce(sum(e.amount), 0) from Expense e
            where e.user.id = :userId and e.createdAt > :since and e.spentOn >= :fromDate""")
    BigDecimal sumAddedSince(Long userId, Instant since, LocalDate fromDate);
}
