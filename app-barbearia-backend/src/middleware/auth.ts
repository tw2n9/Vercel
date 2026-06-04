import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { UserRole } from "../types/user";
import { HttpError } from "../utils/http-error";

type JwtPayload = {
  sub: string;
  role: UserRole;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "AUTH_TOKEN_MISSING", "Token de autenticacao ausente");
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    req.user = {
      id: payload.sub,
      role: payload.role
    };
    next();
  } catch {
    throw new HttpError(401, "AUTH_TOKEN_INVALID", "Token invalido");
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new HttpError(401, "AUTH_TOKEN_MISSING", "Token de autenticacao ausente");
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "PERMISSION_DENIED", "Voce nao tem permissao para esta acao");
    }

    next();
  };
}
