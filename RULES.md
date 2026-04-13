# 🚫 HARD RULES

## SECURITY
- Never trust frontend input
- Always validate ownership
- Always use auth middleware

## BACKEND
- No business logic in routes
- Controllers must be clean
- Always handle errors

## FRONTEND
- No direct API calls (use api.js)
- No duplicated state
- No hardcoded values

## DATA
- Always validate types
- Always sanitize input

---

# ⚠️ FAILURE CONDITIONS

Code is BAD if:

- Has console errors
- Has unhandled promises
- Breaks existing features
- Is hard to read

---

# 🧠 GOLDEN RULE

Clarity > Cleverness