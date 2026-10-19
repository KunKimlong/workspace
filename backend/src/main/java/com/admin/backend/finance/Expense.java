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
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** Money a user spent on a given day, with the reason. */
@Entity
@Table(name = "expenses", indexes = @Index(columnList = "user_id, spent_on"))
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @Column(name = "spent_on", nullable = false)
    private LocalDate spentOn;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 200)
    private String reason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Expense() {
    }

    public Expense(User user, LocalDate spentOn, BigDecimal amount, String reason) {
        this.user = user;
        this.spentOn = spentOn;
        this.amount = amount;
        this.reason = reason;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public LocalDate getSpentOn() { return spentOn; }
    public void setSpentOn(LocalDate spentOn) { this.spentOn = spentOn; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
