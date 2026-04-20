Refactor the AirSave frontend to improve structure, navigation, and user flow.

---

# OBJECTIVE

Simplify the application by consolidating pages, improving navigation, and aligning the UI with a real savings workflow:

Goal → Save → Withdraw

---

# FILES TO CREATE / EDIT / REMOVE

CREATE:
- frontend/src/pages/Savings.jsx
- frontend/src/pages/Withdraw.jsx
- frontend/src/components/Footer.jsx

EDIT:
- frontend/src/App.jsx
- frontend/src/components/Navbar.jsx
- frontend/src/pages/Dashboard.jsx (minimal updates if needed)

REMOVE:
- frontend/src/pages/Payments.jsx

---

# 1. PAGE CONSOLIDATION (CRITICAL)

Create a new page:

frontend/src/pages/Savings.jsx

This page replaces BOTH:
- Goals page
- Transactions page

---

## Savings Page Requirements:

Sections:

1. Create Goal
- Inputs:
  - Goal name
  - Target amount
  - Duration (new field, e.g. months or date)

2. Save to Goal
- Amount input
- Goal selector (dropdown)
- Rounding logic (10, 50, 100)
- Payment trigger (M-Pesa)

3. Activity Section
- List of transactions
- Show:
  - amount
  - savings
  - date
  - status

---

# 2. GOAL ENHANCEMENTS

Update goal creation logic:

Add:
- duration field

Example:
{
  name,
  targetAmount,
  duration
}

---

# 3. WITHDRAW FEATURE

Create:

frontend/src/pages/Withdraw.jsx

---

## Withdraw Page Requirements:

1. Amount input

2. Source selection:
- If multiple goals/wallets exist:
  → Show dropdown to select source

3. Goal maturity logic:
- If goal is not completed:
  → Show warning:
    "This goal has not matured"
  → Provide options:
    - Break goal
    - Cancel

4. Submit withdrawal request

---

# 4. NAVBAR UPDATE

File:
frontend/src/components/Navbar.jsx

---

## New Navbar Structure:

- Logo → links to /dashboard
- Savings → /savings
- Withdraw → /withdraw

Remove:
- Dashboard link
- Payments link
- Goals link
- Transactions link

---

# 5. FOOTER (NEW)

Create:

frontend/src/components/Footer.jsx

---

## Footer Requirements:

- Add:
  - Support link
  - Admin link
- Clean layout using Bootstrap
- Place footer at bottom of app

---

# 6. ROUTING UPDATE

File:
frontend/src/App.jsx

---

Add routes:

/savings → Savings.jsx  
/withdraw → Withdraw.jsx  

Remove route:
/payments

---

# 7. REMOVE PAYMENTS PAGE

Delete:
frontend/src/pages/Payments.jsx

Ensure no imports reference it.

---

# 8. UX IMPROVEMENTS

- Keep UI minimal and clean
- Use Bootstrap only
- Avoid clutter
- Group related actions together

---

# 9. CONSTRAINTS

- Do not redesign entire UI
- Keep consistency with existing styles
- Do not break existing API integrations
- Keep components modular

---

# SUCCESS CRITERIA

- Savings page replaces Goals + Transactions
- Withdraw page works logically
- Navbar is simplified
- Footer added with Support/Admin
- Payments page removed
- Navigation is clean and intuitive