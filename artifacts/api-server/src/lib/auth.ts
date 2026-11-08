import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { authMode } from "./config";

export const DEMO_USER_ID = "demo-learner";

/**
 * Returns the authenticated user id.
 * - With Clerk configured (CLERK_SECRET_KEY) the Clerk session is required.
 * - Without it (local dev / preview) every request is the single demo learner.
 *   Demo mode is refused in production.
 */
export function getUserId(req: Request): string | null {
  if (authMode() === "clerk") return getAuth(req).userId ?? null;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_AUTH !== "true") return null;
  return DEMO_USER_ID;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Bạn cần đăng nhập để vào lớp học." });
    return;
  }
  res.locals.userId = userId;
  next();
}

export function userIdOf(res: Response): string {
  return res.locals.userId as string;
}
