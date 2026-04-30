const amountFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function parseAmountInput(value) {
  const digitsOnly = String(value || "").replace(/[^\d]/g, "");
  return digitsOnly ? String(Number(digitsOnly)) : "";
}

export function formatAmount(value) {
  return amountFormatter.format(Math.abs(Math.round(toAmount(value))));
}

export function formatKsh(value) {
  return `Ksh ${formatAmount(value)}`;
}

export function formatServiceDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
    return "Pending date";
  }

  return dateFormatter.format(date);
}

export function getRoundUp(amount, rule) {
  const numericAmount = toAmount(amount);
  const numericRule = Number(rule || 50);

  if (!numericAmount || !numericRule) {
    return { rounded: 0, savings: 0 };
  }

  const rounded = Math.ceil(numericAmount / numericRule) * numericRule;
  return {
    rounded,
    savings: Math.max(0, rounded - numericAmount),
  };
}

export function extractKenyaPhoneDigits(value) {
  let digits = String(value || "").replace(/[^\d]/g, "");

  if (digits.startsWith("254")) {
    digits = digits.slice(3);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 9);
}

export function formatKenyaPhoneDigits(value) {
  const digits = extractKenyaPhoneDigits(value);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  return groups.join(" ");
}

export function isValidKenyaPhoneDigits(value) {
  return /^[17]\d{8}$/.test(extractKenyaPhoneDigits(value));
}

export function getFullKenyaPhone(value) {
  const digits = extractKenyaPhoneDigits(value);
  return digits ? `+254${digits}` : "";
}
