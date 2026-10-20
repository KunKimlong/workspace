package com.admin.backend.finance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.admin.backend.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Money the user received - their pay, or extra income on any day. Either way it adds to their balance. */
@Entity
@Table(name = "incomes", indexes = @Index(columnList = "user_id, received_on"))
public class Income {

    public enum Kind {
        /** "Got paid": added to what's left of the balance, which is entered again from it. */
        PAY,
        /** Money in on a day (tips, side work, selling something): counted on top of the balance. */
        EXTRA
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Kind kind;

    @Column(name = "received_on", nullable = false)
    private LocalDate receivedOn;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(length = 100)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Income() {
    }

    public Income(User user, Kind kind, LocalDate receivedOn, BigDecimal amount, String note, Instant createdAt) {
        this.user = user;
        this.kind = kind;
        this.receivedOn = receivedOn;
        this.amount = amount;
        this.note = note;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Kind getKind() { return kind; }
    public LocalDate getReceivedOn() { return receivedOn; }
    public BigDecimal getAmount() { return amount; }
    public String getNote() { return note; }
}
