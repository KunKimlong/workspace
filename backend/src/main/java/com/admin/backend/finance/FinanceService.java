package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.admin.backend.config.FieldValidationException;
import com.admin.backend.config.GlobalExceptionHandler;
import com.admin.backend.user.UserRepository;

/** Salary and expense bookkeeping. Every method is scoped to the signed-in user's id. */
@Service
public class FinanceService {

    /** Months of history (including the selected month) for the salary-vs-spent chart. */
    static final int HISTORY_MONTHS = 6;

    public record ExpenseInput(LocalDate date, BigDecimal amount, String reason) {
    }

    public record ExpenseView(Long id, LocalDate date, BigDecimal amount, String reason) {
        static ExpenseView of(Expense e) {
            return new ExpenseView(e.getId(), e.getSpentOn(), e.getAmount(), e.getReason());
        }
    }

    public record DailyTotal(LocalDate date, BigDecimal total, int count) {
    }

    public record MonthTotal(String month, BigDecimal salary, BigDecimal savingsGoal, BigDecimal spent) {
    }

    /**
     * {@code salary} / {@code savingsGoal} are null when not set for the month; {@code planned} is the
     * month's special spending, {@code plannedSuggestions} the items used in any month before.
     */
    public record Summary(String month, BigDecimal salary, BigDecimal savingsGoal, BigDecimal totalSpent,
            int expenseCount, List<DailyTotal> daily, List<MonthTotal> history, List<PlannedView> planned,
            List<PlannedSuggestion> plannedSuggestions, BalanceView balance) {
    }

    /** The balance the user entered, what they've spent since, and what's left of it. */
    public record BalanceView(BigDecimal amount, Instant setAt, BigDecimal spentSince, BigDecimal remaining) {
    }

    public record SalaryPlan(String month, BigDecimal amount, BigDecimal savingsGoal) {
    }

    public record PlannedInput(String name, BigDecimal amount, LocalDate date) {
    }

    /** A special spending item used before: its latest amount and the month it was in. */
    public record PlannedSuggestion(String name, BigDecimal amount, String month) {
    }

    static final int MAX_SUGGESTIONS = 50;

    /** Amount and date come from the recorded expense, so edits made in the expenses table show here too. */
    public record PlannedView(Long id, String name, BigDecimal amount, LocalDate date, Long expenseId) {
        static PlannedView of(PlannedExpense p) {
            Expense e = p.getExpense();
            return new PlannedView(p.getId(), p.getName(), e != null ? e.getAmount() : p.getAmount(),
                    e != null ? e.getSpentOn() : null, e != null ? e.getId() : null);
        }
    }

    private final MonthlySalaryRepository salaries;
    private final ExpenseRepository expenses;
    private final PlannedExpenseRepository planned;
    private final UserBalanceRepository balances;
    private final UserRepository users;

    public FinanceService(MonthlySalaryRepository salaries, ExpenseRepository expenses,
            PlannedExpenseRepository planned, UserBalanceRepository balances, UserRepository users) {
        this.salaries = salaries;
        this.expenses = expenses;
        this.planned = planned;
        this.balances = balances;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Summary summary(Long userId, YearMonth month) {
        YearMonth first = month.minusMonths(HISTORY_MONTHS - 1);
        List<Expense> all = expenses.findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(
                userId, first.atDay(1), month.atEndOfMonth());

        // Every day of the selected month, so days without spending show as 0 on the chart
        Map<LocalDate, BigDecimal> perDay = new LinkedHashMap<>();
        Map<LocalDate, Integer> countPerDay = new LinkedHashMap<>();
        for (int d = 1; d <= month.lengthOfMonth(); d++) {
            perDay.put(month.atDay(d), BigDecimal.ZERO);
            countPerDay.put(month.atDay(d), 0);
        }
        Map<String, BigDecimal> perMonth = new LinkedHashMap<>();
        for (int i = 0; i < HISTORY_MONTHS; i++) {
            perMonth.put(first.plusMonths(i).toString(), BigDecimal.ZERO);
        }

        for (Expense e : all) {
            perMonth.merge(YearMonth.from(e.getSpentOn()).toString(), e.getAmount(), BigDecimal::add);
            if (perDay.containsKey(e.getSpentOn())) {
                perDay.merge(e.getSpentOn(), e.getAmount(), BigDecimal::add);
                countPerDay.merge(e.getSpentOn(), 1, Integer::sum);
            }
        }

        Map<String, MonthlySalary> salaryByMonth = new LinkedHashMap<>();
        salaries.findByUserIdAndMonthBetween(userId, first.toString(), month.toString())
                .forEach(s -> salaryByMonth.put(s.getMonth(), s));

        List<DailyTotal> daily = new ArrayList<>();
        perDay.forEach((date, total) -> daily.add(new DailyTotal(date, total, countPerDay.get(date))));
        List<MonthTotal> history = new ArrayList<>();
        perMonth.forEach((m, spent) -> {
            MonthlySalary s = salaryByMonth.get(m);
            history.add(new MonthTotal(m, s == null ? null : s.getAmount(), s == null ? null : s.getSavingsGoal(),
                    spent));
        });

        MonthlySalary selected = salaryByMonth.get(month.toString());
        int count = countPerDay.values().stream().mapToInt(Integer::intValue).sum();
        return new Summary(month.toString(),
                selected == null ? null : selected.getAmount(),
                selected == null ? null : selected.getSavingsGoal(),
                perMonth.get(month.toString()), count, daily, history, listPlanned(userId, month),
                plannedSuggestions(userId), balance(userId));
    }

    /** Creates or updates the month's salary and (optional) savings goal. */
    @Transactional
    public SalaryPlan setSalary(Long userId, YearMonth month, BigDecimal amount, BigDecimal savingsGoal) {
        if (savingsGoal != null && savingsGoal.compareTo(amount) > 0) {
            throw new FieldValidationException("savingsGoal", "Savings goal can't be more than the salary");
        }
        MonthlySalary salary = salaries.findByUserIdAndMonth(userId, month.toString())
                .orElseGet(() -> new MonthlySalary(users.getReferenceById(userId), month.toString(), amount,
                        savingsGoal));
        salary.setAmount(amount);
        salary.setSavingsGoal(savingsGoal);
        MonthlySalary saved = salaries.save(salary);
        return new SalaryPlan(saved.getMonth(), saved.getAmount(), saved.getSavingsGoal());
    }

    @Transactional
    public void clearSalary(Long userId, YearMonth month) {
        salaries.findByUserIdAndMonth(userId, month.toString()).ifPresent(salaries::delete);
    }

    @Transactional(readOnly = true)
    public List<ExpenseView> listExpenses(Long userId, YearMonth month) {
        return expenses.findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(
                userId, month.atDay(1), month.atEndOfMonth()).stream().map(ExpenseView::of).toList();
    }

    @Transactional
    public ExpenseView addExpense(Long userId, ExpenseInput in) {
        Expense e = new Expense(users.getReferenceById(userId), in.date(), in.amount(), in.reason().trim());
        return ExpenseView.of(expenses.save(e));
    }

    /** Like deleting, only today's expenses can be edited - earlier days are part of the record. */
    @Transactional
    public ExpenseView updateExpense(Long userId, Long id, ExpenseInput in) {
        Expense e = find(userId, id);
        if (e.getSpentOn().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Spending from past days can't be edited");
        }
        e.setSpentOn(in.date());
        e.setAmount(in.amount());
        e.setReason(in.reason().trim());
        return ExpenseView.of(e);
    }

    /**
     * Only today's expenses can be deleted - earlier days are part of the record. Deleting the expense of
     * a special item deletes the item too.
     */
    @Transactional
    public void deleteExpense(Long userId, Long id) {
        Expense e = find(userId, id);
        if (e.getSpentOn().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Spending from past days can't be deleted");
        }
        planned.deleteAll(planned.findByExpenseId(e.getId()));
        expenses.delete(e);
    }

    /** Looks up by id AND owner, so one user can never touch another user's expense. */
    private Expense find(Long userId, Long id) {
        return expenses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> GlobalExceptionHandler.notFound("Expense", id));
    }

    // ---- Special spending ------------------------------------------------------------------------
    // A special item is already spent when it's entered: it always comes with the expense it recorded,
    // and the two are created, edited and deleted together. The item's month follows the expense date.

    @Transactional(readOnly = true)
    public List<PlannedView> listPlanned(Long userId, YearMonth month) {
        return planned.findByUserIdAndMonthOrderByIdAsc(userId, month.toString()).stream()
                .map(PlannedView::of).toList();
    }

    @Transactional
    public PlannedView addPlanned(Long userId, PlannedInput in) {
        String name = in.name().trim();
        Expense e = expenses.save(new Expense(users.getReferenceById(userId), in.date(), in.amount(), name));
        PlannedExpense p = new PlannedExpense(users.getReferenceById(userId), YearMonth.from(in.date()).toString(),
                name, in.amount());
        p.setExpense(e);
        return PlannedView.of(planned.save(p));
    }

    /** Items from previous months can't be edited (same rule as deleting). */
    @Transactional
    public PlannedView updatePlanned(Long userId, Long id, PlannedInput in) {
        PlannedExpense p = findPlanned(userId, id);
        if (YearMonth.parse(p.getMonth()).isBefore(YearMonth.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Special spending from previous months can't be edited");
        }
        p.setName(in.name().trim());
        p.setAmount(in.amount());
        p.setMonth(YearMonth.from(in.date()).toString());
        Expense e = p.getExpense();
        if (e == null) { // its expense was removed some other way - record it again
            p.setExpense(expenses.save(new Expense(users.getReferenceById(userId), in.date(), in.amount(),
                    p.getName())));
        } else {
            e.setSpentOn(in.date());
            e.setAmount(in.amount());
            e.setReason(p.getName());
        }
        return PlannedView.of(p);
    }

    /** Deletes the item and the expense it recorded; items from previous months can't be deleted. */
    @Transactional
    public void deletePlanned(Long userId, Long id) {
        PlannedExpense p = findPlanned(userId, id);
        if (YearMonth.parse(p.getMonth()).isBefore(YearMonth.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Special spending from previous months can't be deleted");
        }
        Expense e = p.getExpense();
        planned.delete(p);
        if (e != null) {
            expenses.delete(e);
        }
    }

    /**
     * One entry per name the user has used before (most recent first), with the amount from the latest
     * time - what was actually paid if it was paid - so they don't have to remember it.
     */
    @Transactional(readOnly = true)
    public List<PlannedSuggestion> plannedSuggestions(Long userId) {
        Set<String> seen = new HashSet<>();
        List<PlannedSuggestion> out = new ArrayList<>();
        for (PlannedExpense p : planned.findByUserIdOrderByMonthDescIdDesc(userId)) {
            if (out.size() == MAX_SUGGESTIONS) {
                break;
            }
            if (seen.add(p.getName().toLowerCase())) {
                Expense e = p.getExpense();
                out.add(new PlannedSuggestion(p.getName(), e != null ? e.getAmount() : p.getAmount(), p.getMonth()));
            }
        }
        return out;
    }

    // ---- Balance ---------------------------------------------------------------------------------

    /** Null when the user hasn't entered a balance. */
    @Transactional(readOnly = true)
    public BalanceView balance(Long userId) {
        return balances.findByUserId(userId).map(b -> {
            LocalDate fromDate = LocalDate.ofInstant(b.getSetAt(), ZoneId.systemDefault());
            BigDecimal spent = expenses.sumAddedSince(userId, b.getSetAt(), fromDate);
            return new BalanceView(b.getAmount(), b.getSetAt(), spent, b.getAmount().subtract(spent));
        }).orElse(null);
    }

    /** Replaces the balance; spending is counted against it from now on. */
    @Transactional
    public BalanceView setBalance(Long userId, BigDecimal amount) {
        Instant now = Instant.now();
        UserBalance b = balances.findByUserId(userId)
                .orElseGet(() -> new UserBalance(users.getReferenceById(userId), amount, now));
        b.set(amount, now);
        balances.save(b);
        return new BalanceView(amount, now, BigDecimal.ZERO, amount);
    }

    @Transactional
    public void clearBalance(Long userId) {
        balances.findByUserId(userId).ifPresent(balances::delete);
    }

    private PlannedExpense findPlanned(Long userId, Long id) {
        return planned.findByIdAndUserId(id, userId)
                .orElseThrow(() -> GlobalExceptionHandler.notFound("Planned expense", id));
    }

    static YearMonth parseMonth(String value) {
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must look like 2026-10");
        }
    }
}
