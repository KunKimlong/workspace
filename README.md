# Kimlong Work Space

A personal workspace with JWT login and salary & expense tracking.
The app name is set in `frontend/src/lib/site.ts`.

| Part | Stack |
|---|---|
| `frontend/` | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, react-icons, pnpm |
| `backend/` | Spring Boot 4, Java 21, Spring Security (OAuth2 resource server, HS256 JWT), Spring Data JPA, H2 (file-based, `backend/data/`) |

## Run

```powershell
# 1. Backend  -> http://localhost:1680  (override with $env:PORT)
cd backend
copy .env.example .env     # first time only, then edit the values
.\mvnw.cmd spring-boot:run

# 2. Frontend -> http://localhost:168
cd frontend
pnpm install
pnpm dev
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`.

## Configuration

`backend/.env` (git-ignored) is loaded by `application.yaml` via
`spring.config.import: optional:file:.env[.properties]`, so run the backend from the `backend/` folder.

| Key | Purpose |
|---|---|
| `JWT_SECRET` | HMAC key for signing tokens, at least 32 characters |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Default admin account, created on startup if missing |
| `TIME_ZONE` | Optional IANA zone (e.g. `Asia/Ho_Chi_Minh`) that decides what "today" is for the date rules; blank = the server's zone. Keep it the same as your browser's |

Token lifetimes, CORS origins and the cookie `Secure` flag live under `app:` in
`backend/src/main/resources/application.yaml`. The frontend calls `http://localhost:1680/api`
by default; override with `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

## How auth works

| Token | Lifetime | Where it lives |
|---|---|---|
| Access token (JWT) | 15 min | Returned in the login/refresh JSON body; kept **in memory** by the frontend and sent as `Authorization: Bearer ...` |
| Refresh token (JWT) | 7 days | `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/auth` - JavaScript can't read it |

- On page load the frontend calls `/api/auth/refresh` to restore the session from the cookie.
- When an API call returns 401, the frontend refreshes once and retries; if that fails it goes to `/login`.
- Refresh tokens are **rotated**: each refresh revokes the old one. Replaying an already-rotated token
  (outside a 30 s grace window for simultaneous tabs) revokes all of that user's sessions. The grace
  window only covers rotation: a logged-out token, or one killed by reuse detection, is dead at once.
- Tokens carry a `type` claim, so a refresh token is rejected as an access token and vice versa.

| Method | Path | Auth | |
|---|---|---|---|
| POST | `/api/auth/login` | - | Body `{email, password}`; returns access token, sets refresh cookie |
| POST | `/api/auth/refresh` | refresh cookie | Rotates tokens |
| POST | `/api/auth/logout` | refresh cookie | Revokes the refresh token, clears the cookie |
| GET | `/api/auth/me` | Bearer | Current user |

Every other `/api/**` endpoint requires a valid access token. Call it from the frontend with
`request()` from `frontend/src/lib/api.ts`, which handles the header and refresh for you.

## Finance (salary & expenses)

Finance is a sidebar group with three pages that share the selected month
(`components/finance/finance-context.tsx`, provided by `app/(dashboard)/finance/layout.tsx`):

| Page | Shows |
|---|---|
| `/finance` Overview | 4 headline numbers (money left, spent, can spend / day, spent today), daily spending chart, recent expenses |
| `/finance/expenses` Expenses | Special spending with quick add, every expense grouped by day |
| `/finance/budget` Budget & savings | Salary, remaining salary, current and remaining balance, pay plan, savings plan, income, 6-month salary vs. spent |

Amounts are shown in USD by default - set `NEXT_PUBLIC_CURRENCY=VND` (any ISO 4217 code)
in `frontend/.env.local` and rebuild to change it.

| Method | Path | |
|---|---|---|
| GET | `/api/finance/summary?month=2026-10` | Salary, total spent, per-day totals, 6-month history |
| PUT / DELETE | `/api/finance/salary/{month}` | Set (body `{amount, savingsGoal?}`) / remove a month's salary and savings goal |
| GET | `/api/finance/expenses?month=2026-10` | Expenses in a month, newest first |
| POST | `/api/finance/expenses` | Body `{date, amount, reason}` |
| PUT / DELETE | `/api/finance/expenses/{id}` | |
| PUT / DELETE | `/api/finance/balance` | Set (body `{amount}`) / remove the current balance, returned as the summary's `balance`. Remaining balance = balance − spending + extra income added since it was entered (dated that day or later); the balance you type already includes salary received and earlier spending |
| GET | `/api/finance/planned?month=2026-10` | Special spending in a month - one-off costs like fuel, soap or a bill |
| POST | `/api/finance/planned` | Body `{name, amount, date}`; records it as spent (creates an expense) right away |
| PUT / DELETE | `/api/finance/planned/{id}` | Edit / delete an item together with its expense |

Only spending dated **today** can be edited or deleted, and an edit can't move it to a past day -
earlier days are part of the record. Special items follow the same rule (by their expense's date).

### Budgeting until the next pay

For pay that doesn't come on a fixed day, the daily limit can follow the money you actually have
instead of a calendar month's salary:

1. **Set balance** - the money you have now (bank + cash).
2. **Set next pay** - when you expect money next, and optionally an amount to keep untouched.
   Daily limit = (balance left − amount to keep) ÷ days until the next pay.
3. **Got paid** - the amount is added to what's left of the balance and you pick the next expected
   date. Pay recorded this way also fills the Salary vs. spent chart for months without a salary.

When the expected day comes and nothing is recorded, the app asks you to add the pay or move the
date. Without a pay plan, the limit comes from the month's salary (and savings goal) as before.

| Method | Path | |
|---|---|---|
| PUT / DELETE | `/api/finance/pay-plan` | Body `{nextPayDate, keepAmount?}`; needs a balance; `nextPayDate` must be after today |
| POST | `/api/finance/income` | Body `{receivedOn, amount, note?, nextPayDate}`; adds the pay to the balance |

### Extra income

Money that comes in besides the pay (tips, side work, something sold) is recorded with **Add income**
(home page, or the Income card on Budget & savings). It counts on top of everything else and leaves the
pay plan alone:

- with a balance, it's added to the remaining balance, so the limit until the next pay goes up;
- by month, the spending budget becomes salary + extra income − savings goal.

Either way it's spread over the days left, today included. Like spending, only today's extra income can
be deleted. Pay recorded with **Got paid** can't be deleted - it entered the balance again - so a mistake
there is fixed with **Update balance**.

| Method | Path | |
|---|---|---|
| POST | `/api/finance/income/extra` | Body `{receivedOn, amount, note?}`; no balance needed |
| DELETE | `/api/finance/income/{id}` | Extra income dated today only |

The summary's `incomes` lists both kinds (`kind`: `PAY` or `EXTRA`); `history[].income` is pay and
`history[].extraIncome` the rest.

A special item and its expense are kept in step: deleting either one deletes both, and editing the
expense updates the item's name and amount. The summary's
`plannedSuggestions` lists every item used before with its latest amount, shown as quick-add
buttons so the amount doesn't have to be remembered.

## Database

Data is stored in an H2 file database at `backend/data/` (git-ignored), so it survives restarts.
To start fresh, stop the backend and delete that folder.

The schema is owned by **Liquibase** (`backend/src/main/resources/db/changelog/`). On startup it
applies any changesets not yet recorded in the `DATABASECHANGELOG` table; Hibernate runs with
`ddl-auto: validate`, so it only checks that the entities match and never alters tables.

| File | Creates |
|---|---|
| `changes/001-create-users.yaml` | `app_users` |
| `changes/002-create-refresh-tokens.yaml` | `refresh_tokens` |
| `changes/003-create-finance.yaml` | `monthly_salaries`, `expenses` |
| `changes/004-add-savings-goal.yaml` | `monthly_salaries.savings_goal` |
| `changes/005-create-planned-expenses.yaml` | `planned_expenses` |
| `changes/006-create-user-balances.yaml` | `user_balances` |
| `changes/007-add-refresh-token-rotated.yaml` | `refresh_tokens.rotated` |
| `changes/008-add-pay-plan-and-incomes.yaml` | `user_balances.next_pay_date` / `keep_amount`, `incomes` |
| `changes/009-add-income-kind.yaml` | `incomes.kind` (`PAY` / `EXTRA`) |

To change the schema, **never edit an applied changeset** (Liquibase checksums it and will refuse
to start). Add a new file such as `changes/010-add-expense-category.yaml`, include it at the end of
`db.changelog-master.yaml`, and update the entity to match. The backend tests run every changeset
against an in-memory DB and fail if an entity doesn't match the schema.

## Tests

```powershell
cd backend;  .\mvnw.cmd test   # JUnit: finance rules, auth/token rotation, API validation
cd frontend; pnpm test         # Vitest: budget maths, stats, API client, useApi, privacy toggle
```

Backend tests boot the app on an in-memory H2 database with a fixed clock (`MutableClock`), so
date rules like "only today can be edited" are tested on a known day.

To add a page: create `frontend/src/app/(dashboard)/<name>/page.tsx` (it's protected automatically)
and add it to `frontend/src/components/layout/nav-items.ts`.
