export const validRoundUpRules = [10, 50, 100];

export function roundAmount(amount, rule = 10) {
  const numericAmount = Number(amount);
  const numericRule = Number(rule);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      original: 0,
      rounded: 0,
      savings: 0,
    };
  }

  const safeRule = validRoundUpRules.includes(numericRule) ? numericRule : 10;
  const rounded = Math.ceil(numericAmount / safeRule) * safeRule;
  const savings = rounded - numericAmount;

  return {
    original: Number(numericAmount.toFixed(2)),
    rounded: Number(rounded.toFixed(2)),
    savings: Number(savings.toFixed(2)),
  };
}
