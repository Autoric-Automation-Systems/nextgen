import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { accessContext } from "./access-context";
import { authDb } from "./auth-db";
import { defaultMailer, type Mailer } from "./mail";
import { buildInvitationEmail } from "./invitation-email";
import { buildPasswordResetEmail } from "./password-reset-email";
import { loggingMailer } from "./mail-log";
import { defaultBaseURL, trustedOriginsFrom } from "./base-url";
import { PASSWORD_MIN_LENGTH } from "./password-rules";

export * from "./mail";

/**
 * Validade do link de senha, seja convite da escola ou redefinição.
 *
 * Longo o bastante para o e-mail chegar depois do almoço, curto o bastante para não ser
 * um passeio grátis se a caixa vazar. É também o número que o e-mail anuncia.
 */
const RESET_EXPIRES_IN_MINUTES = 30;

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

    /**
     * Senha é o único caminho de entrada. O link por e-mail existe para **criar** a
     * senha — convite da escola ou "esqueci a senha" — e nunca autentica sozinho.
     *
     * `disableSignUp` impede que qualquer pessoa crie conta e escola pela API: quem
     * provisiona usuário é a escola (ou o bootstrap do primeiro acesso).
     */
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      resetPasswordTokenExpiresIn: RESET_EXPIRES_IN_MINUTES * 60,
      // Senha nova derruba as sessões antigas: se o motivo do pedido foi invasão de
      // conta, deixar o invasor logado anularia o reset.
      revokeSessionsOnPasswordReset: true,
      /**
       * O mesmo endpoint serve ao convite e à redefinição: quem decide o texto é o estado
       * da conta. Conta sem credencial recebe "sua escola criou seu acesso"; conta com
       * senha recebe "definir nova senha".
       */
      async sendResetPassword({ user, url }) {
        const context = await accessContext(user.id);

        const content = context.hasPassword
          ? buildPasswordResetEmail({
              url,
              email: user.email,
              appUrl: baseURL,
              expiresInMinutes: RESET_EXPIRES_IN_MINUTES,
            })
          : buildInvitationEmail({
              url,
              email: user.email,
              appUrl: baseURL,
              schoolName: context.schoolName,
              expiresInMinutes: RESET_EXPIRES_IN_MINUTES,
            });

        await mailer.send({ to: user.email, ...content });
      },
    },

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

    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth();
