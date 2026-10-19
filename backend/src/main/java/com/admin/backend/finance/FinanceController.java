package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.admin.backend.finance.FinanceService.BalanceView;
import com.admin.backend.finance.FinanceService.ExpenseInput;
import com.admin.backend.finance.FinanceService.ExpenseView;
import com.admin.backend.finance.FinanceService.PlannedInput;
import com.admin.backend.finance.FinanceService.PlannedView;
import com.admin.backend.finance.FinanceService.SalaryPlan;
import com.admin.backend.finance.FinanceService.Summary;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

/** Monthly salary and daily expenses for the signed-in user (months are "yyyy-MM"). */
@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    public record SalaryRequest(
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "0", message = "Amount cannot be negative")
            @Digits(integer = 12, fraction = 2, message = "Amount is too large or has more than 2 decimals")
            BigDecimal amount,
            /* Optional; null clears the goal. */
            @DecimalMin(value = "0", message = "Savings goal cannot be negative")
            @Digits(integer = 12, fraction = 2, message = "Savings goal is too large or has more than 2 decimals")
            BigDecimal savingsGoal) {
    }

    public record ExpenseRequest(
            @NotNull(message = "Date is required") @PastOrPresent(message = "Date can't be in the future") LocalDate date,
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
            @DecimalMax(value = "999999999999.99", message = "Amount is too large")
            @Digits(integer = 12, fraction = 2, message = "Amount can have at most 2 decimals")
            BigDecimal amount,
            @NotBlank(message = "Reason is required") @Size(max = 200, message = "Reason is too long (max 200)")
            String reason) {

        ExpenseInput toInput() {
            return new ExpenseInput(date, amount, reason);
        }
    }

    public record PlannedRequest(
            @NotBlank(message = "Name is required") @Size(max = 100, message = "Name is too long (max 100)")
            String name,
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
            @Digits(integer = 12, fraction = 2, message = "Amount is too large or has more than 2 decimals")
            BigDecimal amount,
            @NotNull(message = "Date is required") @PastOrPresent(message = "Date can't be in the future") LocalDate date) {

        PlannedInput toInput() {
            return new PlannedInput(name, amount, date);
        }
    }

    public record BalanceRequest(
            @NotNull(message = "Balance is required")
            @DecimalMin(value = "0", message = "Balance cannot be negative")
            @Digits(integer = 12, fraction = 2, message = "Balance is too large or has more than 2 decimals")
            BigDecimal amount) {
    }

    private final FinanceService finance;

    public FinanceController(FinanceService finance) {
        this.finance = finance;
    }

    @GetMapping("/summary")
    public Summary summary(@AuthenticationPrincipal Jwt jwt, @RequestParam String month) {
        return finance.summary(userId(jwt), FinanceService.parseMonth(month));
    }

    @PutMapping("/salary/{month}")
    public SalaryPlan setSalary(@AuthenticationPrincipal Jwt jwt, @PathVariable String month,
            @Valid @RequestBody SalaryRequest req) {
        return finance.setSalary(userId(jwt), FinanceService.parseMonth(month), req.amount(), req.savingsGoal());
    }

    @DeleteMapping("/salary/{month}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearSalary(@AuthenticationPrincipal Jwt jwt, @PathVariable String month) {
        finance.clearSalary(userId(jwt), FinanceService.parseMonth(month));
    }

    @PutMapping("/balance")
    public BalanceView setBalance(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BalanceRequest req) {
        return finance.setBalance(userId(jwt), req.amount());
    }

    @DeleteMapping("/balance")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearBalance(@AuthenticationPrincipal Jwt jwt) {
        finance.clearBalance(userId(jwt));
    }

    @GetMapping("/expenses")
    public List<ExpenseView> listExpenses(@AuthenticationPrincipal Jwt jwt, @RequestParam String month) {
        return finance.listExpenses(userId(jwt), FinanceService.parseMonth(month));
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseView addExpense(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExpenseRequest req) {
        return finance.addExpense(userId(jwt), req.toInput());
    }

    @PutMapping("/expenses/{id}")
    public ExpenseView updateExpense(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody ExpenseRequest req) {
        return finance.updateExpense(userId(jwt), id, req.toInput());
    }

    @DeleteMapping("/expenses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExpense(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        finance.deleteExpense(userId(jwt), id);
    }

    @GetMapping("/planned")
    public List<PlannedView> listPlanned(@AuthenticationPrincipal Jwt jwt, @RequestParam String month) {
        return finance.listPlanned(userId(jwt), FinanceService.parseMonth(month));
    }

    @PostMapping("/planned")
    @ResponseStatus(HttpStatus.CREATED)
    public PlannedView addPlanned(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PlannedRequest req) {
        return finance.addPlanned(userId(jwt), req.toInput());
    }

    @PutMapping("/planned/{id}")
    public PlannedView updatePlanned(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody PlannedRequest req) {
        return finance.updatePlanned(userId(jwt), id, req.toInput());
    }

    @DeleteMapping("/planned/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlanned(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        finance.deletePlanned(userId(jwt), id);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
