import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { createAdminClient } from "@nextgen/db";
import { defaultMailer, type Mailer } from "./mail";
import { loggingMailer } from "./mail-log";
import { defaultBaseURL, trustedOriginsFrom } from "./base-url";

/**
 * Cliente dono das tabelas. O módulo de autenticação é o único consumidor: ele
 * precisa ler o usuário pelo e-mail antes de existir sessão (e portanto antes de
 * existir contexto de escola). Ver a migration 0004_auth_owner_bypass.
 */
const authDb = createAdminClient();

export * from "./mail";

export type AuthOptions = {
  mailer?: Mailer;
  baseURL?: string;
  secret?: string;
  trustedOrigins?: string[];
};

export function createAuth(options: AuthOptions = {}) {
  // Sem registro, "não chegou" não distingue endereço sem usuário de senha recusada.
  const mailer = options.mailer ?? loggingMailer(defaultMailer());
  const baseURL = options.baseURL ?? defaultBaseURL();
  const trustedOrigins = options.trustedOrigins ?? trustedOriginsFrom();

  return betterAuth({
    appName: "NextGen",
    baseURL,
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET,
    trustedOrigins,

    database: prismaAdapter(authDb, { provider: "postgresql" }),

    // Sessão de 7 dias, renovada por dia. Administrador exige 2FA (doc 10).
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    advanced: {
      // As tabelas usam uuid; sem isso o Better Auth gravaria ids aleatórios em
      // colunas uuid e a escrita falharia.
      database: { generateId: "uuid" },
      // `next start` local roda com NODE_ENV=production, mas em http: cookie Secure
      // não é gravado. A flag explícita evita "login não persiste" no ambiente local.
      useSecureCookies: process.env.BETTER_AUTH_SECURE_COOKIES
        ? process.env.BETTER_AUTH_SECURE_COOKIES === "true"
        : process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.BETTER_AUTH_SECURE_COOKIES
          ? process.env.BETTER_AUTH_SECURE_COOKIES === "true"
          : process.env.NODE_ENV === "production",
      },
      ipAddress: {
        // Vercel injeta o IP do cliente neste cabeçalho; guardamos em `session.ip_address`.
        ipAddressHeaders: ["x-forwarded-for"],
      },
    },

    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        // Sem auto-cadastro: só entra quem já foi convidado pela escola.
        disableSignUp: true,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          await mailer.send({
            to: email,
            subject: "Seu link de acesso ao NextGen",
            text: `Use o link para entrar (válido por 15 minutos):\n\n${url}\n\nSe não foi você, ignore este e-mail.`,
          });
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth();
