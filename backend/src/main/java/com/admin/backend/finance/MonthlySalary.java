package com.admin.backend.finance;

import java.math.BigDecimal;

import com.admin.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** A user's salary for one calendar month. */
@Entity
@Table(name = "monthly_salaries",
        uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "salary_month" }))
public class MonthlySalary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    /** Month as "yyyy-MM" (sorts correctly as text). */
    @Column(name = "salary_month", nullable = false, length = 7)
    private String month;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    /** How much of the salary the user plans to save this month; null when no goal is set. */
    @Column(precision = 14, scale = 2)
    private BigDecimal savingsGoal;

    protected MonthlySalary() {
    }

    public MonthlySalary(User user, String month, BigDecimal amount, BigDecimal savingsGoal) {
        this.user = user;
        this.month = month;
        this.amount = amount;
        this.savingsGoal = savingsGoal;
    }

    public Long getId() { return id; }
    public String getMonth() { return month; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getSavingsGoal() { return savingsGoal; }
    public void setSavingsGoal(BigDecimal savingsGoal) { this.savingsGoal = savingsGoal; }
}
