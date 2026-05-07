import { z } from "zod";
import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/errors.js";

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const register = asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw new HttpError(409, "A user with this email already exists");
  }

  const user = await User.create({
    email: body.email,
    passwordHash: body.password,
    name: body.name || "",
  });

  const token = signToken(user._id);

  res.status(201).json({
    data: { user: user.toSafeJSON(), token },
  });
});

export const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const match = await user.comparePassword(body.password);
  if (!match) {
    throw new HttpError(401, "Invalid email or password");
  }

  const token = signToken(user._id);

  res.json({
    data: { user: user.toSafeJSON(), token },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ data: { user: req.user } });
});