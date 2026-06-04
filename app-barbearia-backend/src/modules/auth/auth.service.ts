import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../../database/pool";
import { env } from "../../config/env";
import type { AuthUser, UserRole } from "../../types/user";
import { HttpError } from "../../utils/http-error";

type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

function signToken(user: { id: string; role: UserRole }) {
  const options: jwt.SignOptions = {
    subject: user.id,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  };

  return jwt.sign({ role: user.role }, env.jwtSecret as jwt.Secret, options);
}

function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role
  };
}

export async function register(input: RegisterInput) {
  const existing = await query("SELECT id FROM users WHERE email = $1", [input.email]);

  if (existing.rowCount) {
    throw new HttpError(409, "USER_EMAIL_ALREADY_EXISTS", "E-mail ja cadastrado");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const userResult = await query<AuthUser>(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, 'client')
     RETURNING id, name, email, phone, role, is_active`,
    [input.name, input.email, input.phone, passwordHash]
  );

  const user = userResult.rows[0];

  await query("INSERT INTO clients (user_id) VALUES ($1)", [user.id]);

  return {
    user: toPublicUser(user),
    token: signToken(user)
  };
}

export async function login(input: LoginInput) {
  const result = await query<AuthUser & { password_hash: string }>(
    "SELECT id, name, email, phone, password_hash, role, is_active FROM users WHERE email = $1",
    [input.email]
  );

  const user = result.rows[0];

  if (!user) {
    throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "Credenciais invalidas");
  }

  if (!user.is_active) {
    throw new HttpError(403, "AUTH_USER_INACTIVE", "Usuario inativo");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password_hash);

  if (!passwordMatches) {
    throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "Credenciais invalidas");
  }

  return {
    user: toPublicUser(user),
    token: signToken(user)
  };
}
