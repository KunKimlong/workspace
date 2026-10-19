package com.admin.backend.finance;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlannedExpenseRepository extends JpaRepository<PlannedExpense, Long> {

    @EntityGraph(attributePaths = "expense")
    List<PlannedExpense> findByUserIdAndMonthOrderByIdAsc(Long userId, String month);

    Optional<PlannedExpense> findByIdAndUserId(Long id, Long userId);

    List<PlannedExpense> findByExpenseId(Long expenseId);

    /** Items without a recorded expense (left over from when items could be unpaid). */
    @EntityGraph(attributePaths = "user")
    List<PlannedExpense> findByExpenseIsNull();

    /** Every item the user has ever planned, newest first - used to remember names and amounts. */
    @EntityGraph(attributePaths = "expense")
    List<PlannedExpense> findByUserIdOrderByMonthDescIdDesc(Long userId);
}
