package com.admin.backend.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.admin.backend.config.FieldValidationException;
import com.admin.backend.finance.FinanceService.ExpenseInput;
import com.admin.backend.finance.FinanceService.ExpenseView;
import com.admin.backend.finance.FinanceService.PlannedInput;
import com.admin.backend.finance.FinanceService.PlannedView;
import com.admin.backend.finance.FinanceService.Summary;
import com.admin.backend.support.IntegrationTest;

/** Business rules of salary, expenses, special spending and balance. Each test rolls back. */
@Transactional
class FinanceServiceTest extends IntegrationTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 3, 15);
    private static final YearMonth MARCH = YearMonth.of(2026, 3);

    @Autowired
    FinanceService finance;

    @Autowired
    ExpenseRepository expenses;

    @Autowired
    PlannedExpenseRepository planned;

    Long userId;

    @BeforeEach
    void setUp() {
        userId = createUser("secret-password").getId();
    }

    private ExpenseView spend(LocalDate date, String amount, String reason) {
        return finance.addExpense(userId, new ExpenseInput(date, new BigDecimal(amount), reason));
    }

    private static BigDecimal money(String amount) {
        return new BigDecimal(amount);
    }

    private static void assertConflict(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    // ---- Summary ---------------------------------------------------------------------------------

    @Test
    void summaryTotalsSpendingPerDayAndPerMonth() {
        finance.setSalary(userId, MARCH, money("1000"), money("200"));
        spend(LocalDate.of(2026, 3, 1), "10", "Rice");
        spend(TODAY, "5", "Coffee");
        spend(TODAY, "2.50", "Bread");
        spend(LocalDate.of(2026, 2, 10), "100", "Rent");

        Summary s = finance.summary(userId, MARCH);

        assertThat(s.salary()).isEqualByComparingTo("1000");
        assertThat(s.savingsGoal()).isEqualByComparingTo("200");
        assertThat(s.totalSpent()).isEqualByComparingTo("17.50");
        assertThat(s.expenseCount()).isEqualTo(3);
        assertThat(s.daily()).hasSize(31);
        assertThat(s.daily().get(14).date()).isEqualTo(TODAY);
        assertThat(s.daily().get(14).total()).isEqualByComparingTo("7.50");
        assertThat(s.daily().get(14).count()).isEqualTo(2);
        assertThat(s.daily().get(1).total()).isEqualByComparingTo("0");

        assertThat(s.history()).hasSize(6);
        assertThat(s.history().getFirst().month()).isEqualTo("2025-10");
        assertThat(s.history().get(4).month()).isEqualTo("2026-02");
        assertThat(s.history().get(4).spent()).isEqualByComparingTo("100");
        assertThat(s.history().get(4).salary()).isNull();
        assertThat(s.history().getLast().salary()).isEqualByComparingTo("1000");
    }

    @Test
    void summaryOnlyShowsTheSignedInUsersData() {
        spend(TODAY, "5", "Mine");
        Long other = createUser("other-password").getId();

        assertThat(finance.summary(other, MARCH).totalSpent()).isEqualByComparingTo("0");
    }

    // ---- Salary ----------------------------------------------------------------------------------

    @Test
    void savingsGoalCantBeMoreThanTheSalary() {
        assertThatThrownBy(() -> finance.setSalary(userId, MARCH, money("100"), money("150")))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        e -> assertThat(e.getField()).isEqualTo("savingsGoal"));
    }

    @Test
    void settingTheSalaryAgainUpdatesTheSameMonth() {
        finance.setSalary(userId, MARCH, money("1000"), null);
        finance.setSalary(userId, MARCH, money("1200"), money("300"));

        Summary s = finance.summary(userId, MARCH);
        assertThat(s.salary()).isEqualByComparingTo("1200");
        assertThat(s.savingsGoal()).isEqualByComparingTo("300");
    }

    // ---- Expenses --------------------------------------------------------------------------------

    @Test
    void expensesCantBeDatedInTheFuture() {
        assertThatThrownBy(() -> spend(TODAY.plusDays(1), "5", "Tomorrow"))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        e -> assertThat(e.getField()).isEqualTo("date"));
    }

    @Test
    void todaysExpenseCanBeEditedAndDeleted() {
        ExpenseView e = spend(TODAY, "5", "Coffee");

        ExpenseView updated = finance.updateExpense(userId, e.id(), new ExpenseInput(TODAY, money("6"), " Tea "));
        assertThat(updated.amount()).isEqualByComparingTo("6");
        assertThat(updated.reason()).isEqualTo("Tea");

        finance.deleteExpense(userId, e.id());
        assertThat(expenses.findById(e.id())).isEmpty();
    }

    @Test
    void pastDaysAreLocked() {
        ExpenseView yesterday = spend(TODAY.minusDays(1), "5", "Coffee");
        ExpenseInput edit = new ExpenseInput(TODAY.minusDays(1), money("1"), "Changed");

        assertConflict(() -> finance.updateExpense(userId, yesterday.id(), edit));
        assertConflict(() -> finance.deleteExpense(userId, yesterday.id()));
    }

    @Test
    void todaysExpenseCantBeMovedToAPastDay() {
        ExpenseView e = spend(TODAY, "5", "Coffee");

        assertThatThrownBy(() -> finance.updateExpense(userId, e.id(),
                new ExpenseInput(TODAY.minusDays(3), money("5"), "Coffee")))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        ex -> assertThat(ex.getField()).isEqualTo("date"));
    }

    @Test
    void anotherUsersExpenseIsNotFound() {
        ExpenseView e = spend(TODAY, "5", "Coffee");
        Long other = createUser("other-password").getId();

        assertThatThrownBy(() -> finance.deleteExpense(other, e.id()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void theDayFollowsTheConfiguredTimeZone() {
        // 23:30 UTC on the 15th is already the 16th in Ho Chi Minh City (UTC+7)
        clock.set(Instant.parse("2026-03-15T23:30:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

        ExpenseView e = spend(LocalDate.of(2026, 3, 16), "5", "Breakfast");

        assertThat(e.date()).isEqualTo(LocalDate.of(2026, 3, 16));
    }

    // ---- Special spending ------------------------------------------------------------------------

    private PlannedView addSpecial(LocalDate date, String amount, String name) {
        return finance.addPlanned(userId, new PlannedInput(name, new BigDecimal(amount), date));
    }

    @Test
    void specialSpendingRecordsAnExpense() {
        PlannedView p = addSpecial(TODAY, "30", "Fuel");

        assertThat(p.expenseId()).isNotNull();
        Expense e = expenses.findById(p.expenseId()).orElseThrow();
        assertThat(e.getAmount()).isEqualByComparingTo("30");
        assertThat(e.getReason()).isEqualTo("Fuel");
        assertThat(finance.summary(userId, MARCH).totalSpent()).isEqualByComparingTo("30");
    }

    @Test
    void deletingTheExpenseDeletesTheSpecialItemToo() {
        PlannedView p = addSpecial(TODAY, "30", "Fuel");

        finance.deleteExpense(userId, p.expenseId());

        assertThat(planned.findById(p.id())).isEmpty();
    }

    @Test
    void deletingTheSpecialItemDeletesItsExpenseToo() {
        PlannedView p = addSpecial(TODAY, "30", "Fuel");

        finance.deletePlanned(userId, p.id());

        assertThat(expenses.findById(p.expenseId())).isEmpty();
    }

    @Test
    void editingTheExpenseKeepsTheSpecialItemInStep() {
        PlannedView p = addSpecial(TODAY, "30", "Fuel");

        finance.updateExpense(userId, p.expenseId(), new ExpenseInput(TODAY, money("35"), "Petrol"));

        PlannedView after = finance.listPlanned(userId, MARCH).getFirst();
        assertThat(after.name()).isEqualTo("Petrol");
        assertThat(after.amount()).isEqualByComparingTo("35");
    }

    @Test
    void specialSpendingFromAnEarlierDayThisMonthIsLocked() {
        PlannedView p = addSpecial(LocalDate.of(2026, 3, 2), "30", "Fuel");
        PlannedInput edit = new PlannedInput("Fuel", money("1"), LocalDate.of(2026, 3, 2));

        assertConflict(() -> finance.updatePlanned(userId, p.id(), edit));
        assertConflict(() -> finance.deletePlanned(userId, p.id()));
    }

    @Test
    void suggestionsListEachNameOnceWithItsLatestAmount() {
        addSpecial(LocalDate.of(2026, 1, 5), "20", "Fuel");
        addSpecial(LocalDate.of(2026, 2, 5), "25", "fuel");
        addSpecial(LocalDate.of(2026, 2, 6), "8", "Soap");

        var suggestions = finance.plannedSuggestions(userId);

        assertThat(suggestions).extracting(FinanceService.PlannedSuggestion::name).containsExactly("Soap", "fuel");
        assertThat(suggestions.get(1).amount()).isEqualByComparingTo("25");
    }

    // ---- Balance ---------------------------------------------------------------------------------

    @Test
    void balanceCountsOnlySpendingAddedAfterItWasSet() {
        spend(TODAY, "10", "Before the balance - already in it");
        clock.advance(Duration.ofMinutes(1));
        finance.setBalance(userId, money("500"));
        clock.advance(Duration.ofMinutes(1));

        spend(TODAY, "20", "After");
        spend(TODAY.minusDays(1), "7", "Back-dated - already in the balance");

        FinanceService.BalanceView b = finance.balance(userId);
        assertThat(b.amount()).isEqualByComparingTo("500");
        assertThat(b.spentSince()).isEqualByComparingTo("20");
        assertThat(b.remaining()).isEqualByComparingTo("480");
    }

    // ---- Pay plan & income -----------------------------------------------------------------------

    private static final LocalDate NEXT_PAY = LocalDate.of(2026, 3, 25);

    @Test
    void payPlanNeedsABalanceFirst() {
        assertConflict(() -> finance.setPayPlan(userId, NEXT_PAY, null));
    }

    @Test
    void payPlanIsStoredWithTheBalance() {
        finance.setBalance(userId, money("300"));

        FinanceService.BalanceView b = finance.setPayPlan(userId, NEXT_PAY, money("50"));

        assertThat(b.nextPayDate()).isEqualTo(NEXT_PAY);
        assertThat(b.keepAmount()).isEqualByComparingTo("50");
        assertThat(finance.summary(userId, MARCH).balance().nextPayDate()).isEqualTo(NEXT_PAY);
    }

    @Test
    void nextPayMustBeAfterToday() {
        finance.setBalance(userId, money("300"));

        assertThatThrownBy(() -> finance.setPayPlan(userId, TODAY, null))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        e -> assertThat(e.getField()).isEqualTo("nextPayDate"));
    }

    @Test
    void updatingTheBalanceKeepsThePayPlan() {
        finance.setBalance(userId, money("300"));
        finance.setPayPlan(userId, NEXT_PAY, money("50"));

        FinanceService.BalanceView b = finance.setBalance(userId, money("280"));

        assertThat(b.nextPayDate()).isEqualTo(NEXT_PAY);
        assertThat(b.keepAmount()).isEqualByComparingTo("50");
    }

    @Test
    void gettingPaidAddsToWhatIsLeftAndMovesThePlanOn() {
        finance.setBalance(userId, money("100"));
        finance.setPayPlan(userId, TODAY.plusDays(1), money("20"));
        clock.advance(Duration.ofMinutes(1));
        spend(TODAY, "30", "Groceries");
        clock.advance(Duration.ofMinutes(1));

        finance.recordIncome(userId,
                new FinanceService.IncomeInput(TODAY, money("500"), " Salary ", LocalDate.of(2026, 4, 10)));

        FinanceService.BalanceView b = finance.balance(userId);
        assertThat(b.remaining()).isEqualByComparingTo("570"); // 100 - 30 + 500
        assertThat(b.nextPayDate()).isEqualTo(LocalDate.of(2026, 4, 10));
        assertThat(b.keepAmount()).isEqualByComparingTo("20");

        Summary s = finance.summary(userId, MARCH);
        assertThat(s.incomes()).singleElement().satisfies(i -> {
            assertThat(i.amount()).isEqualByComparingTo("500");
            assertThat(i.note()).isEqualTo("Salary");
        });
        assertThat(s.history().getLast().income()).isEqualByComparingTo("500");
        assertThat(s.history().get(4).income()).isEqualByComparingTo("0");
    }

    @Test
    void incomeCantBeDatedInTheFuture() {
        finance.setBalance(userId, money("100"));

        assertThatThrownBy(() -> finance.recordIncome(userId,
                new FinanceService.IncomeInput(TODAY.plusDays(1), money("500"), null, NEXT_PAY)))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        e -> assertThat(e.getField()).isEqualTo("receivedOn"));
    }

    // ---- Extra income ----------------------------------------------------------------------------

    private FinanceService.IncomeView earn(LocalDate date, String amount, String note) {
        return finance.addExtraIncome(userId, new FinanceService.ExtraIncomeInput(date, money(amount), note));
    }

    @Test
    void extraIncomeAddsToTheBalanceAndKeepsThePayPlan() {
        earn(TODAY, "15", "Before the balance - already in it");
        clock.advance(Duration.ofMinutes(1));
        finance.setBalance(userId, money("100"));
        finance.setPayPlan(userId, NEXT_PAY, null);
        clock.advance(Duration.ofMinutes(1));

        spend(TODAY, "30", "Groceries");
        earn(TODAY, "25", " Tips ");
        earn(TODAY.minusDays(1), "9", "Back-dated - already in the balance");

        FinanceService.BalanceView b = finance.balance(userId);
        assertThat(b.earnedSince()).isEqualByComparingTo("25");
        assertThat(b.remaining()).isEqualByComparingTo("95"); // 100 - 30 + 25
        assertThat(b.nextPayDate()).isEqualTo(NEXT_PAY);
    }

    @Test
    void extraIncomeIsKeptApartFromPayInTheSummary() {
        finance.setBalance(userId, money("100"));
        clock.advance(Duration.ofMinutes(1));
        finance.recordIncome(userId, new FinanceService.IncomeInput(TODAY, money("500"), null, NEXT_PAY));
        earn(TODAY, "25", "Tips");

        Summary s = finance.summary(userId, MARCH);

        assertThat(s.incomes()).extracting(FinanceService.IncomeView::kind)
                .containsExactlyInAnyOrder(Income.Kind.PAY, Income.Kind.EXTRA);
        assertThat(s.history().getLast().income()).isEqualByComparingTo("500");
        assertThat(s.history().getLast().extraIncome()).isEqualByComparingTo("25");
    }

    @Test
    void extraIncomeNeedsNoBalanceButCantBeInTheFuture() {
        assertThat(earn(TODAY, "10", null).note()).isNull();

        assertThatThrownBy(() -> earn(TODAY.plusDays(1), "10", null))
                .isInstanceOfSatisfying(FieldValidationException.class,
                        e -> assertThat(e.getField()).isEqualTo("receivedOn"));
    }

    @Test
    void onlyTodaysExtraIncomeCanBeDeleted() {
        finance.setBalance(userId, money("100"));
        clock.advance(Duration.ofMinutes(1));
        FinanceService.IncomeView today = earn(TODAY, "25", "Tips");
        FinanceService.IncomeView yesterday = earn(TODAY.minusDays(1), "5", "Tips");
        FinanceService.IncomeView pay = finance.recordIncome(userId,
                new FinanceService.IncomeInput(TODAY, money("500"), null, NEXT_PAY));

        finance.deleteIncome(userId, today.id());

        assertThat(finance.summary(userId, MARCH).incomes()).extracting(FinanceService.IncomeView::id)
                .doesNotContain(today.id());
        assertConflict(() -> finance.deleteIncome(userId, yesterday.id()));
        assertConflict(() -> finance.deleteIncome(userId, pay.id()));
    }

    @Test
    void anotherUsersIncomeIsNotFound() {
        FinanceService.IncomeView mine = earn(TODAY, "25", "Tips");
        Long other = createUser("other-password").getId();

        assertThatThrownBy(() -> finance.deleteIncome(other, mine.id()))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void clearingThePayPlanKeepsTheBalance() {
        finance.setBalance(userId, money("300"));
        finance.setPayPlan(userId, NEXT_PAY, money("50"));

        finance.clearPayPlan(userId);

        FinanceService.BalanceView b = finance.balance(userId);
        assertThat(b.amount()).isEqualByComparingTo("300");
        assertThat(b.nextPayDate()).isNull();
        assertThat(b.keepAmount()).isNull();
    }

    @Test
    void noBalanceUntilOneIsSet() {
        assertThat(finance.balance(userId)).isNull();
        finance.setBalance(userId, money("100"));
        finance.clearBalance(userId);
        assertThat(finance.balance(userId)).isNull();
    }
}
