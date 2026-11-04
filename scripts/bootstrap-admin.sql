-- Primeiro administrador do NextGen.
-- Rode no SQL Editor do Neon, na conexão DIRECT (host sem -pooler), como dono do banco.
--
-- Não existe auto-cadastro: `disableSignUp` está ligado no Better Auth. Sem este
-- insert não há como entrar no sistema, por mais que o deploy esteja saudável.
--
-- Idempotente: pode rodar de novo depois de trocar e-mail ou nome.

-- ── 1. Ajuste aqui ────────────────────────────────────────────────────
\set admin_email  'voce@escola.com.br'
\set admin_nome   'Seu Nome'
\set escola_nome  'Escola Exemplo'          -- nome fantasia
\set escola_razao 'Escola Exemplo Ltda'     -- razão social (obrigatória no schema)
\set escola_slug  'escola-exemplo'
-- ──────────────────────────────────────────────────────────────────────

begin;

-- `updated_at` não tem default no banco: o Prisma o preenche pela aplicação, então
-- em SQL manual ele precisa ir explícito.
insert into users (id, name, email, email_verified, updated_at)
values (gen_random_uuid(), :'admin_nome', :'admin_email', true, now())
on conflict (email) do update
  set name = excluded.name,
      email_verified = true,
      updated_at = now();

-- `legal_name` e `trade_name` são obrigatórios: a tabela não tem coluna `name`.
insert into schools (id, slug, legal_name, trade_name, status, updated_at)
values (gen_random_uuid(), :'escola_slug', :'escola_razao', :'escola_nome', 'active', now())
on conflict (slug) do update
  set legal_name = excluded.legal_name,
      trade_name = excluded.trade_name,
      status = 'active',
      updated_at = now();

insert into memberships (id, school_id, user_id, role, status, updated_at)
values (
  gen_random_uuid(),
  (select id from schools where slug = :'escola_slug'),
  (select id from users where email = :'admin_email'),
  'admin',
  'active',
  now()
)
on conflict (school_id, user_id) do update
  set role = 'admin',
      status = 'active',
      updated_at = now();

commit;

-- ── 2. Conferência ────────────────────────────────────────────────────
select u.email, m.role, m.status, s.slug as escola
from memberships m
join users u on u.id = m.user_id
join schools s on s.id = m.school_id
where u.email = :'admin_email';
