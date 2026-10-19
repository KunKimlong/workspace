package com.admin.backend.finance;

import java.math.BigDecimal;

import com.admin.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Special (one-off) spending such as fuel, soap or a bill. Entering it records a normal {@link Expense}
 * straight away; the item keeps the name so it can be suggested, with its amount, in later months.
 */
@Entity
@Table(name = "planned_expenses", indexes = @Index(columnList = "user_id, plan_month"))
public class PlannedExpense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    /** Month as "yyyy-MM". */
    @Column(name = "plan_month", nullable = false, length = 7)
    private String month;

    @Column(nullable = false, length = 100)
    private String name;

    /** Planned amount; what was actually paid lives on {@link #expense}. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    /** Set when paid. The DB nulls it if that expense is deleted, which makes the item unpaid again. */
    @ManyToOne(fetch = FetchType.LAZY)
    private Expense expense;

    protected PlannedExpense() {
    }

    public PlannedExpense(User user, String month, String name, BigDecimal amount) {
        this.user = user;
        this.month = month;
        this.name = name;
        this.amount = amount;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public Expense getExpense() { return expense; }
    public void setExpense(Expense expense) { this.expense = expense; }
}
