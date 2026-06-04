import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

const attempts = new Map<string, { count: number; resetAt: number }>();
const windowMs = 15 * 60 * 1000;
const maxAttempts = 10;

export function loginRateLimit(req: Request, _res: Response, next: NextFunction) {
  const key = `${req.ip}:${String(req.body?.email ?? "").toLowerCase()}`;
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (current.count >= maxAttempts) {
    throw new HttpError(429, "AUTH_RATE_LIMITED", "Muitas tentativas de login. Tente novamente mais tarde");
  }

  current.count += 1;
  next();
}
