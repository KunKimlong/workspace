package com.admin.backend.finance;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MonthlySalaryRepository extends JpaRepository<MonthlySalary, Long> {

    Optional<MonthlySalary> findByUserIdAndMonth(Long userId, String month);

    /** Inclusive range of "yyyy-MM" months. */
    List<MonthlySalary> findByUserIdAndMonthBetween(Long userId, String from, String to);
}
