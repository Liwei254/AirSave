Enhance the Savings payment flow to support async updates, auto-refresh, and correct goal targeting.

---

# FILES TO EDIT

- frontend/src/pages/Savings.jsx
- frontend/src/services/api.js

---

# OBJECTIVE

1. Track payment reference after initiating payment
2. Auto-refresh data after payment (no manual refresh)
3. Prevent duplicate submissions
4. Ensure correct goal targeting
5. Improve API response handling consistency

---

# 1. TRACK PAYMENT REFERENCE

In Savings.jsx:

Add state:

const [paymentRef, setPaymentRef] = useState(null);
const [isRefreshingAfterPayment, setIsRefreshingAfterPayment] = useState(false);

---

# 2. CAPTURE PAYMENT RESPONSE

After calling initiatePayment:

const res = await initiatePayment(payload);

setPaymentRef(res.paymentReference);
setIsRefreshingAfterPayment(true);

---

# 3. AUTO REFRESH (CONTROLLED POLLING)

Add useEffect:

useEffect(() => {
  if (!paymentRef) return;

  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    await refreshSavingsData();

    if (attempts >= 3) {
      clearInterval(interval);
      setPaymentRef(null);
      setIsRefreshingAfterPayment(false);
    }
  }, 2000);

  return () => clearInterval(interval);
}, [paymentRef]);

---

# 4. UPDATE BUTTON STATE

Update submit button:

- Disable when loading or refreshing
- Show "Processing..." during async flow

Example:

disabled={saveDisabled || isRefreshingAfterPayment}

Label:

{isSaveSubmitting || isRefreshingAfterPayment ? "Processing..." : "Save with M-Pesa"}

---

# 5. ENSURE GOAL TARGETING

Ensure selected goal is passed:

await initiatePayment({
  amount: Number(amount),
  rule,
  phone,
  goalId: selectedGoal
});

Validation:
- Do not allow submit if no goal selected

---

# 6. API LAYER FIX

File: frontend/src/services/api.js

Update initiatePayment to normalize response:

return requestData(API.post("/payments/initiate", payload), (data) => ({
  ...data,
  status: data?.status || "pending",
  message: data?.message || "STK push sent",
  paymentReference:
    data?.paymentReference ||
    data?.reference ||
    data?.transactionReference ||
    data?.checkoutRequestId ||
    null,
}));

---

# CONSTRAINTS

- Do not modify backend
- Do not fake goal balance updates
- Keep UI minimal and unchanged
- Avoid adding new libraries

---

# SUCCESS CRITERIA

- Payment triggers successfully
- Button shows "Processing..."
- UI auto-refreshes after payment
- Goal updates after backend callback
- Activity feed reflects new transaction
- Correct goal receives funds
- No manual refresh needed