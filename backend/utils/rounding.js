export const roundAmount = (amount, rule = 10) => {
  const rounded = Math.ceil(amount / rule) * rule;
  const savings = rounded - amount;

  return {
    original: amount,
    rounded,
    savings
  };
};