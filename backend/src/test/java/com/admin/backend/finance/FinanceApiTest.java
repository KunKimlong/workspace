package com.admin.backend.finance;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.admin.backend.support.IntegrationTest;
import com.admin.backend.user.User;
import com.jayway.jsonpath.JsonPath;

/** Request validation and the error shape the frontend relies on ({message, errors: {field: text}}). */
@AutoConfigureMockMvc
class FinanceApiTest extends IntegrationTest {

    @Autowired
    MockMvc mvc;

    String bearer;

    @BeforeEach
    void signIn() throws Exception {
        User user = createUser("finance-password");
        String body = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"finance-password\"}".formatted(user.getEmail())))
                .andReturn().getResponse().getContentAsString();
        bearer = "Bearer " + JsonPath.read(body, "$.accessToken");
    }

    private ResultActions postExpense(String json) throws Exception {
        return mvc.perform(post("/api/finance/expenses")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    @Test
    void addsAnExpense() throws Exception {
        postExpense("{\"date\":\"2026-03-15\",\"amount\":12.5,\"reason\":\"Lunch\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reason").value("Lunch"));

        mvc.perform(get("/api/finance/summary").param("month", "2026-03").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSpent").value(12.5));
    }

    @Test
    void futureDateIsAFieldError() throws Exception {
        postExpense("{\"date\":\"2026-03-16\",\"amount\":5,\"reason\":\"Tomorrow\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.date").value("Date can't be in the future"));
    }

    @Test
    void invalidFieldsAreReportedTogether() throws Exception {
        postExpense("{\"date\":\"2026-03-15\",\"amount\":0,\"reason\":\"\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.amount").exists())
                .andExpect(jsonPath("$.errors.reason").exists());
    }

    @Test
    void badMonthIsRejected() throws Exception {
        mvc.perform(get("/api/finance/summary").param("month", "March").header("Authorization", bearer))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Month must look like 2026-10"));
    }

    @Test
    void gettingPaidWithoutABalanceAsksForOneFirst() throws Exception {
        mvc.perform(post("/api/finance/income")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"receivedOn\":\"2026-03-15\",\"amount\":500,\"nextPayDate\":\"2026-04-10\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Set your current balance first"));
    }

    @Test
    void extraIncomeNeedsNoBalanceAndShowsInTheSummary() throws Exception {
        mvc.perform(post("/api/finance/income/extra")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"receivedOn\":\"2026-03-15\",\"amount\":25,\"note\":\"Tips\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("EXTRA"));

        mvc.perform(get("/api/finance/summary").param("month", "2026-03").header("Authorization", bearer))
                .andExpect(jsonPath("$.incomes[0].note").value("Tips"))
                .andExpect(jsonPath("$.history[5].extraIncome").value(25));
    }

    @Test
    void extraIncomeNeedsAPositiveAmount() throws Exception {
        mvc.perform(post("/api/finance/income/extra")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"receivedOn\":\"2026-03-15\",\"amount\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.amount").exists());
    }

    @Test
    void payPlanNeedsANextPayDate() throws Exception {
        mvc.perform(put("/api/finance/pay-plan")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"keepAmount\":50}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.nextPayDate").exists());
    }

    @Test
    void savingsGoalAboveSalaryIsAFieldError() throws Exception {
        mvc.perform(put("/api/finance/salary/2026-03")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":100,\"savingsGoal\":150}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.savingsGoal").exists());
    }
}
