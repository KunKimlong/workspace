package com.admin.backend.finance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Special items used to be "planned" first and marked paid later; ones never marked have no expense, so
 * they weren't counted as spent. On startup this records the missing expense for each of them: today for
 * the current month, the last day for past months, the first day for future months.
 */
@Component
public class SpecialSpendingRepair implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SpecialSpendingRepair.class);

    private final PlannedExpenseRepository planned;
    private final ExpenseRepository expenses;
    private final Clock clock;

    public SpecialSpendingRepair(PlannedExpenseRepository planned, ExpenseRepository expenses, Clock clock) {
        this.planned = planned;
        this.expenses = expenses;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        LocalDate today = LocalDate.now(clock);
        int fixed = 0;
        for (PlannedExpense p : planned.findByExpenseIsNull()) {
            YearMonth month = YearMonth.parse(p.getMonth());
            LocalDate date = month.equals(YearMonth.from(today)) ? today
                    : month.isBefore(YearMonth.from(today)) ? month.atEndOfMonth() : month.atDay(1);
            p.setExpense(expenses.save(new Expense(p.getUser(), date, p.getAmount(), p.getName())));
            fixed++;
        }
        if (fixed > 0) {
            log.info("Recorded {} special spending item(s) that had no expense", fixed);
        }
    }
}
