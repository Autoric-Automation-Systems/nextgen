import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "./server";

/** Handlers prontos para o route handler do Next (`app/api/auth/[...all]`). */
export const authHandlers = toNextJsHandler(auth.handler);
