package com.admin.backend.config;

/**
 * A validation failure tied to one request field that annotations can't express (e.g. one
 * field compared with another). Returned as 400 in the same shape as bean-validation errors.
 */
public class FieldValidationException extends RuntimeException {

    private final String field;

    public FieldValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
