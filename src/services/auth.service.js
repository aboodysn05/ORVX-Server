import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Never send password_hash back to the client — every auth response is
// shaped through this one function.
function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    organization: row.organization,
  };
}

export async function register({ name, email, password, role, organization }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new AppError("An account with that email already exists.", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const finalRole = role === "coach" ? "coach" : "player";
  const finalOrganization = finalRole === "coach" ? organization || null : null;

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, organization)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, organization`,
    [name.trim(), normalizedEmail, passwordHash, finalRole, finalOrganization],
  );

  const user = toPublicUser(result.rows[0]);
  return { token: signToken(user), user };
}

export async function login({ email, password }) {
  const normalizedEmail = (email || "").trim().toLowerCase();

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const row = result.rows[0];

  // Same error for "no such user" and "wrong password" — don't reveal which
  // one it was; that just tells an attacker which emails are registered.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw new AppError("Email or password is incorrect.", 401, "INVALID_CREDENTIALS");
  }

  const user = toPublicUser(row);
  return { token: signToken(user), user };
}

// Account settings. Name is a free edit; changing the email or the password
// requires the current password. Returns the fresh public user (the caller
// re-issues nothing — the existing JWT only carries id + role, both unchanged).
export async function updateAccount(userId, { name, email, currentPassword, newPassword }) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  const nextEmail = email != null ? email.trim().toLowerCase() : row.email;
  const wantsEmailChange = nextEmail !== row.email;
  const wantsPasswordChange = typeof newPassword === "string" && newPassword.length > 0;

  if (wantsEmailChange || wantsPasswordChange) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw new AppError("Your current password is incorrect.", 403, "INVALID_PASSWORD");
    }
  }
  if (wantsEmailChange && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
    throw new AppError("That doesn't look like a valid email.", 400, "VALIDATION_ERROR");
  }
  if (wantsPasswordChange && newPassword.length < 8) {
    throw new AppError("New password must be at least 8 characters.", 400, "VALIDATION_ERROR");
  }

  const nextName = name != null && name.trim() ? name.trim() : row.name;
  const nextHash = wantsPasswordChange
    ? await bcrypt.hash(newPassword, SALT_ROUNDS)
    : row.password_hash;

  try {
    const updated = await pool.query(
      `UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4
       RETURNING id, name, email, role, organization`,
      [nextName, nextEmail, nextHash, userId],
    );
    return toPublicUser(updated.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("An account with that email already exists.", 409, "EMAIL_TAKEN");
    }
    throw err;
  }
}

export async function getUserById(id) {
  const result = await pool.query(
    "SELECT id, name, email, role, organization FROM users WHERE id = $1",
    [id],
  );
  if (result.rows.length === 0) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }
  return toPublicUser(result.rows[0]);
}
