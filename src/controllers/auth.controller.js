import { AppError } from "../utils/AppError.js";
import * as authService from "../services/auth.service.js";

export async function registerController(req, res) {
  const { name, email, password, role, organization } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email and password are all required.", 400, "VALIDATION_ERROR");
  }
  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters.", 400, "VALIDATION_ERROR");
  }

  const { token, user } = await authService.register({ name, email, password, role, organization });
  res.status(201).json({ token, user });
}

export async function loginController(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required.", 400, "VALIDATION_ERROR");
  }

  const { token, user } = await authService.login({ email, password });
  res.json({ token, user });
}

export async function meController(req, res) {
  // req.user was set by the requireAuth middleware, from the verified JWT.
  const user = await authService.getUserById(req.user.id);
  res.json({ user });
}

export async function updateMeController(req, res) {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const user = await authService.updateAccount(req.user.id, {
    name,
    email,
    currentPassword,
    newPassword,
  });
  res.json({ user });
}
