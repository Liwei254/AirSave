import { describe, expect, test } from "@jest/globals";
import { calculateRoundUp } from "../services/roundUpService.js";

describe("calculateRoundUp", () => {
  test.each([
    [87, 50, 100, 13],
    [100, 50, 100, 0],
    [101, 50, 150, 49],
    [101, 100, 200, 99],
  ])("rounds %s to the next %s increment", (originalAmount, rule, roundedAmount, roundUpAmount) => {
    expect(calculateRoundUp({ originalAmount, roundUpRule: rule })).toEqual({
      originalAmount,
      roundedAmount,
      roundUpAmount,
      rule,
    });
  });
});
