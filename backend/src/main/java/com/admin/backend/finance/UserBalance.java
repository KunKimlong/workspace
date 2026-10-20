package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.admin.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/** The money a user says they have (bank + cash) as of {@link #setAt}; one per user. */
@Entity
@Table(name = "user_balances")
public class UserBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private Instant setAt;

    /** Pay plan: when the user expects money next. Null = no plan, budget by calendar month instead. */
    @Column(name = "next_pay_date")
    private LocalDate nextPayDate;

    /** Pay plan: money to leave untouched until the next pay. */
    @Column(name = "keep_amount", precision = 14, scale = 2)
    private BigDecimal keepAmount;

    protected UserBalance() {
    }

    public UserBalance(User user, BigDecimal amount, Instant setAt) {
        this.user = user;
        this.amount = amount;
        this.setAt = setAt;
    }

    public BigDecimal getAmount() { return amount; }
    public Instant getSetAt() { return setAt; }

    public LocalDate getNextPayDate() { return nextPayDate; }
    public BigDecimal getKeepAmount() { return keepAmount; }

    public void set(BigDecimal amount, Instant setAt) {
        this.amount = amount;
        this.setAt = setAt;
    }

    public void setPayPlan(LocalDate nextPayDate, BigDecimal keepAmount) {
        this.nextPayDate = nextPayDate;
        this.keepAmount = keepAmount;
    }
}
