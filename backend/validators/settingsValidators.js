import { checkSchema } from "express-validator";

export const roundUpRuleValidator = checkSchema({
  roundUpRule: {
    in: ["body"],
    notEmpty: { errorMessage: "Round-up rule is required" },
    isIn: {
      options: [[10, 50, 100, "10", "50", "100"]],
      errorMessage: "Round-up rule must be 10, 50, or 100",
    },
    toInt: true,
  },
});
