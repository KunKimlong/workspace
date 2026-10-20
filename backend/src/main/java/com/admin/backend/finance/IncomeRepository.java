package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface IncomeRepository extends JpaRepository<Income, Long> {

    /** Inclusive date range, newest first. */
    List<Income> findByUserIdAndReceivedOnBetweenOrderByReceivedOnDescIdDesc(Long userId, LocalDate from,
            LocalDate to);

    Optional<Income> findByIdAndUserId(Long id, Long userId);

    /**
     * Extra income recorded after the balance was entered, dated that day or later - the same rule as
     * {@link ExpenseRepository#sumAddedSince}. Pay isn't counted: recording it enters the balance again.
     */
    @Query("""
            select coalesce(sum(i.amount), 0) from Income i
            where i.user.id = :userId and i.kind = com.admin.backend.finance.Income.Kind.EXTRA
              and i.createdAt > :since and i.receivedOn >= :fromDate""")
    BigDecimal sumExtraAddedSince(Long userId, Instant since, LocalDate fromDate);
}
