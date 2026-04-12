import Goal from "../models/Goal.js";

// Create Goal
export const createGoal = async (req, res) => {
  try {
    const { name, targetAmount } = req.body;

    if (!name || !targetAmount) {
      return res.status(400).json({ message: "All fields required" });
    }

    // ❌ Prevent multiple active goals
    const existingGoal = await Goal.findOne({
      user: req.user._id,
      status: "active"
    });

    if (existingGoal) {
      return res.status(400).json({
        message: "You already have an active goal. Complete it first."
      });
    }

    const goal = await Goal.create({
      user: req.user._id,
      name,
      targetAmount
    });

    res.status(201).json(goal);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get User Goals
export const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id });

    res.status(200).json(goals);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};