package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
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

    /**
     * {@code income} is the pay recorded as received in that month, {@code extraIncome} the other money
     * that came in (0 if none).
     */
    public record MonthTotal(String month, BigDecimal salary, BigDecimal savingsGoal, BigDecimal spent,
            BigDecimal income, BigDecimal extraIncome) {
    }

    /**
     * {@code salary} / {@code savingsGoal} are null when not set for the month; {@code planned} is the
     * month's special spending, {@code plannedSuggestions} the items used in any month before,
     * {@code incomes} the pay and extra income received in the month.
     */
    public record Summary(String month, BigDecimal salary, BigDecimal savingsGoal, BigDecimal totalSpent,
            int expenseCount, List<DailyTotal> daily, List<MonthTotal> history, List<PlannedView> planned,
            List<PlannedSuggestion> plannedSuggestions, BalanceView balance, List<IncomeView> incomes) {
    }

    /**
     * The balance the user entered, what they've spent and earned since, and what's left of it - plus the
     * pay plan ({@code nextPayDate} / {@code keepAmount}, null when not set) that budgets it until the next pay.
     */
    public record BalanceView(BigDecimal amount, Instant setAt, BigDecimal spentSince, BigDecimal earnedSince,
            BigDecimal remaining, LocalDate nextPayDate, BigDecimal keepAmount) {
    }

    public record IncomeInput(LocalDate receivedOn, BigDecimal amount, String note, LocalDate nextPayDate) {
    }

    public record ExtraIncomeInput(LocalDate receivedOn, BigDecimal amount, String note) {
    }

    public record IncomeView(Long id, Income.Kind kind, LocalDate receivedOn, BigDecimal amount, String note) {
        static IncomeView of(Income i) {
            return new IncomeView(i.getId(), i.getKind(), i.getReceivedOn(), i.getAmount(), i.getNote());
        }
    }

    public record SalaryPlan(String month, BigDecimal amount, BigDecimal savingsGoal) {
    }

    public record PlannedInput(String name, BigDecimal amount, LocalDate date) {
    }

    /** A special spending item used before: its latest amount and the month it was in. */
    public record PlannedSuggestion(String name, BigDecimal amount, String month) {
    }

    static final int MAX_SUGGESTIONS = 50;

    /** Column length of {@code planned_expenses.name}. */
    static final int PLANNED_NAME_MAX = 100;

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
    private final IncomeRepository incomes;
    private final UserRepository users;
    private final Clock clock;

    public FinanceService(MonthlySalaryRepository salaries, ExpenseRepository expenses,
            PlannedExpenseRepository planned, UserBalanceRepository balances, IncomeRepository incomes,
            UserRepository users, Clock clock) {
        this.salaries = salaries;
        this.expenses = expenses;
        this.planned = planned;
        this.balances = balances;
        this.incomes = incomes;
        this.users = users;
        this.clock = clock;
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

        List<Income> received = incomes.findByUserIdAndReceivedOnBetweenOrderByReceivedOnDescIdDesc(
                userId, first.atDay(1), month.atEndOfMonth());
        Map<String, BigDecimal> payPerMonth = new LinkedHashMap<>();
        Map<String, BigDecimal> extraPerMonth = new LinkedHashMap<>();
        received.forEach(i -> (i.getKind() == Income.Kind.EXTRA ? extraPerMonth : payPerMonth)
                .merge(YearMonth.from(i.getReceivedOn()).toString(), i.getAmount(), BigDecimal::add));

        List<DailyTotal> daily = new ArrayList<>();
        perDay.forEach((date, total) -> daily.add(new DailyTotal(date, total, countPerDay.get(date))));
        List<MonthTotal> history = new ArrayList<>();
        perMonth.forEach((m, spent) -> {
            MonthlySalary s = salaryByMonth.get(m);
            history.add(new MonthTotal(m, s == null ? null : s.getAmount(), s == null ? null : s.getSavingsGoal(),
                    spent, payPerMonth.getOrDefault(m, BigDecimal.ZERO),
                    extraPerMonth.getOrDefault(m, BigDecimal.ZERO)));
        });

        MonthlySalary selected = salaryByMonth.get(month.toString());
        int count = countPerDay.values().stream().mapToInt(Integer::intValue).sum();
        List<IncomeView> monthIncomes = received.stream()
                .filter(i -> YearMonth.from(i.getReceivedOn()).equals(month)).map(IncomeView::of).toList();
        return new Summary(month.toString(),
                selected == null ? null : selected.getAmount(),
                selected == null ? null : selected.getSavingsGoal(),
                perMonth.get(month.toString()), count, daily, history, listPlanned(userId, month),
                plannedSuggestions(userId), balance(userId), monthIncomes);
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
        requireNotFuture(in.date());
        return ExpenseView.of(expenses.save(newExpense(userId, in.date(), in.amount(), in.reason().trim())));
    }

    /**
     * Like deleting, only today's expenses can be edited, and they can't be moved to a past day - earlier
     * days are part of the record. A special item's name and amount follow its expense.
     */
    @Transactional
    public ExpenseView updateExpense(Long userId, Long id, ExpenseInput in) {
        Expense e = find(userId, id);
        requireToday(e.getSpentOn(), "Spending from past days can't be edited");
        requireEditableDate(in.date());
        e.setSpentOn(in.date());
        e.setAmount(in.amount());
        e.setReason(in.reason().trim());
        for (PlannedExpense p : planned.findByExpenseId(e.getId())) {
            p.setName(truncate(e.getReason(), PLANNED_NAME_MAX));
            p.setAmount(e.getAmount());
            p.setMonth(YearMonth.from(e.getSpentOn()).toString());
        }
        return ExpenseView.of(e);
    }

    /**
     * Only today's expenses can be deleted - earlier days are part of the record. Deleting the expense of
     * a special item deletes the item too.
     */
    @Transactional
    public void deleteExpense(Long userId, Long id) {
        Expense e = find(userId, id);
        requireToday(e.getSpentOn(), "Spending from past days can't be deleted");
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
        requireNotFuture(in.date());
        String name = in.name().trim();
        Expense e = expenses.save(newExpense(userId, in.date(), in.amount(), name));
        PlannedExpense p = new PlannedExpense(users.getReferenceById(userId), YearMonth.from(in.date()).toString(),
                name, in.amount());
        p.setExpense(e);
        return PlannedView.of(planned.save(p));
    }

    /** Same rule as expenses: only items dated today can be edited, and not moved to a past day. */
    @Transactional
    public PlannedView updatePlanned(Long userId, Long id, PlannedInput in) {
        PlannedExpense p = findPlanned(userId, id);
        requirePlannedChangeable(p, "Special spending from past days can't be edited");
        requireEditableDate(in.date());
        p.setName(in.name().trim());
        p.setAmount(in.amount());
        p.setMonth(YearMonth.from(in.date()).toString());
        Expense e = p.getExpense();
        if (e == null) { // its expense was removed some other way - record it again
            p.setExpense(expenses.save(newExpense(userId, in.date(), in.amount(), p.getName())));
        } else {
            e.setSpentOn(in.date());
            e.setAmount(in.amount());
            e.setReason(p.getName());
        }
        return PlannedView.of(p);
    }

    /** Deletes the item and the expense it recorded; like expenses, only items dated today can be deleted. */
    @Transactional
    public void deletePlanned(Long userId, Long id) {
        PlannedExpense p = findPlanned(userId, id);
        requirePlannedChangeable(p, "Special spending from past days can't be deleted");
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
        return balances.findByUserId(userId).map(b -> view(userId, b)).orElse(null);
    }

    private BalanceView view(Long userId, UserBalance b) {
        LocalDate fromDate = LocalDate.ofInstant(b.getSetAt(), clock.getZone());
        BigDecimal spent = expenses.sumAddedSince(userId, b.getSetAt(), fromDate);
        BigDecimal earned = incomes.sumExtraAddedSince(userId, b.getSetAt(), fromDate);
        return new BalanceView(b.getAmount(), b.getSetAt(), spent, earned,
                b.getAmount().subtract(spent).add(earned), b.getNextPayDate(), b.getKeepAmount());
    }

    /** Replaces the balance; spending and extra income count on it from now on. A pay plan is kept. */
    @Transactional
    public BalanceView setBalance(Long userId, BigDecimal amount) {
        Instant now = clock.instant();
        UserBalance b = balances.findByUserId(userId)
                .orElseGet(() -> new UserBalance(users.getReferenceById(userId), amount, now));
        b.set(amount, now);
        balances.save(b);
        return new BalanceView(amount, now, BigDecimal.ZERO, BigDecimal.ZERO, amount, b.getNextPayDate(),
                b.getKeepAmount());
    }

    @Transactional
    public void clearBalance(Long userId) {
        balances.findByUserId(userId).ifPresent(balances::delete);
    }

    // ---- Pay plan --------------------------------------------------------------------------------
    // For pay with no fixed day: the balance is budgeted until the day the user expects money next,
    // instead of a calendar month's salary.

    /** Sets when the next pay is expected and how much to leave untouched until then. */
    @Transactional
    public BalanceView setPayPlan(Long userId, LocalDate nextPayDate, BigDecimal keepAmount) {
        UserBalance b = requireBalance(userId);
        requireAfterToday(nextPayDate);
        b.setPayPlan(nextPayDate, keepAmount);
        return view(userId, b);
    }

    @Transactional
    public void clearPayPlan(Long userId) {
        balances.findByUserId(userId).ifPresent(b -> b.setPayPlan(null, null));
    }

    /**
     * "I got paid": records the pay, adds it to what's left of the balance and moves the plan on to the
     * next expected pay. The amount to keep untouched carries over.
     */
    @Transactional
    public IncomeView recordIncome(Long userId, IncomeInput in) {
        UserBalance b = requireBalance(userId);
        if (in.receivedOn().isAfter(today())) {
            throw new FieldValidationException("receivedOn", "Date can't be in the future");
        }
        requireAfterToday(in.nextPayDate());

        BigDecimal remaining = view(userId, b).remaining();
        b.set(remaining.add(in.amount()), clock.instant());
        b.setPayPlan(in.nextPayDate(), b.getKeepAmount());

        return IncomeView.of(incomes.save(newIncome(userId, Income.Kind.PAY, in.receivedOn(), in.amount(),
                in.note())));
    }

    /**
     * Money in on a day that isn't the pay (tips, side work, selling something). It counts on top of the
     * balance and the month's salary, and leaves the pay plan as it is. No balance is needed.
     */
    @Transactional
    public IncomeView addExtraIncome(Long userId, ExtraIncomeInput in) {
        if (in.receivedOn().isAfter(today())) {
            throw new FieldValidationException("receivedOn", "Date can't be in the future");
        }
        return IncomeView.of(incomes.save(newIncome(userId, Income.Kind.EXTRA, in.receivedOn(), in.amount(),
                in.note())));
    }

    /**
     * Like spending, only extra income from today can be deleted. Pay can't: recording it entered the
     * balance again, so a mistake there is fixed by updating the balance.
     */
    @Transactional
    public void deleteIncome(Long userId, Long id) {
        Income income = incomes.findByIdAndUserId(id, userId)
                .orElseThrow(() -> GlobalExceptionHandler.notFound("Income", id));
        if (income.getKind() == Income.Kind.PAY) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Pay can't be deleted - update your balance instead");
        }
        requireToday(income.getReceivedOn(), "Income from past days can't be deleted");
        incomes.delete(income);
    }

    private Income newIncome(Long userId, Income.Kind kind, LocalDate receivedOn, BigDecimal amount, String note) {
        String trimmed = note == null || note.isBlank() ? null : note.trim();
        return new Income(users.getReferenceById(userId), kind, receivedOn, amount, trimmed, clock.instant());
    }

    private UserBalance requireBalance(Long userId) {
        return balances.findByUserId(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                "Set your current balance first"));
    }

    private void requireAfterToday(LocalDate nextPayDate) {
        if (!nextPayDate.isAfter(today())) {
            throw new FieldValidationException("nextPayDate", "Pick a day after today");
        }
    }

    private PlannedExpense findPlanned(Long userId, Long id) {
        return planned.findByIdAndUserId(id, userId)
                .orElseThrow(() -> GlobalExceptionHandler.notFound("Planned expense", id));
    }

    // ---- Date rules ------------------------------------------------------------------------------

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private Expense newExpense(Long userId, LocalDate date, BigDecimal amount, String reason) {
        return new Expense(users.getReferenceById(userId), date, amount, reason, clock.instant());
    }

    private void requireNotFuture(LocalDate date) {
        if (date.isAfter(today())) {
            throw new FieldValidationException("date", "Date can't be in the future");
        }
    }

    /** Where an edit may move spending to: today only - not the future, and not a locked past day. */
    private void requireEditableDate(LocalDate date) {
        requireNotFuture(date);
        if (date.isBefore(today())) {
            throw new FieldValidationException("date", "Spending can't be moved to a past day");
        }
    }

    private void requireToday(LocalDate date, String message) {
        if (date.isBefore(today())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
    }

    /** Dated by its expense; an item that lost its expense falls back to its month. */
    private void requirePlannedChangeable(PlannedExpense p, String message) {
        if (p.getExpense() != null) {
            requireToday(p.getExpense().getSpentOn(), message);
        } else if (YearMonth.parse(p.getMonth()).isBefore(YearMonth.now(clock))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, message);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max).trim();
    }

    static YearMonth parseMonth(String value) {
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month must look like 2026-10");
        }
    }
}
