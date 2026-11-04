/**
 * Cria o primeiro administrador durante o deploy, a partir de variáveis de ambiente.
 *
 * `disableSignUp` está ligado: e-mail que não existe no banco recebe o link e o clique
 * morre em `new_user_signup_disabled`, com o usuário de volta na tela de login e nenhuma
 * pista. Sem este passo, um deploy saudável é um sistema onde ninguém consegue entrar.
 *
 * Idempotente e opcional: sem `BOOTSTRAP_ADMIN_EMAIL`, nada acontece.
 */

/** Literal SQL seguro: aspas simples dobradas, como o Postgres espera. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Slug a partir do nome: o schema exige, e derivar evita mais uma variável para errar.
 * Acentos saem antes da normalização porque `NFD` separa a marca e ela viraria hífen.
 */
export function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function bootstrapAdminFrom(env = process.env) {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const name = env.BOOTSTRAP_ADMIN_NAME?.trim() || email.split("@")[0];
  const schoolName = env.BOOTSTRAP_SCHOOL_NAME?.trim() || "Minha Escola";
  const schoolLegalName = env.BOOTSTRAP_SCHOOL_LEGAL_NAME?.trim() || schoolName;
  const schoolSlug = env.BOOTSTRAP_SCHOOL_SLUG?.trim() || slugify(schoolName);

  return { email, name, schoolName, schoolLegalName, schoolSlug };
}

/**
 * Mesmo efeito de `scripts/bootstrap-admin.sql`, com o `on conflict` que o torna seguro
 * para rodar a cada deploy: promover quem já existe em vez de duplicar.
 */
export function bootstrapAdminSql(admin) {
  const { email, name, schoolName, schoolLegalName, schoolSlug } = admin;

  return `
begin;

insert into users (id, name, email, email_verified, updated_at)
values (gen_random_uuid(), ${quote(name)}, ${quote(email)}, true, now())
on conflict (email) do update
  set name = excluded.name,
      email_verified = true,
      updated_at = now();

insert into schools (id, slug, legal_name, trade_name, status, updated_at)
values (gen_random_uuid(), ${quote(schoolSlug)}, ${quote(schoolLegalName)}, ${quote(schoolName)}, 'active', now())
on conflict (slug) do update
  set legal_name = excluded.legal_name,
      trade_name = excluded.trade_name,
      status = 'active',
      updated_at = now();

insert into memberships (id, school_id, user_id, role, status, updated_at)
values (
  gen_random_uuid(),
  (select id from schools where slug = ${quote(schoolSlug)}),
  (select id from users where email = ${quote(email)}),
  'admin',
  'active',
  now()
)
on conflict (school_id, user_id) do update
  set role = 'admin',
      status = 'active',
      updated_at = now();

commit;

select count(*)::text as membros
from memberships m
join users u on u.id = m.user_id
where u.email = ${quote(email)};
`;
}
