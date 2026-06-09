// src/app/api/auth/[...all]/route.ts
// Better Auth catch-all handler — the ONLY file that does not call requireRole().
// Better Auth manages session internally here.
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
