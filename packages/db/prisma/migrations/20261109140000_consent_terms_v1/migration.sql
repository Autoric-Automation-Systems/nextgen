-- Termos de consentimento v1, versionados e válidos para toda a plataforma.
--
-- `consent_purposes` e `consent_terms` são globais (sem `school_id`) e só a plataforma
-- escreve nelas — o papel de aplicação tem apenas SELECT. Sem semear por migração, o
-- portal do responsável em produção abriria sem termo para aceitar, e a matrícula ficaria
-- em rascunho para sempre.
--
-- O texto é o registro legal: mudar o corpo exige **versão nova** (`1.1`), nunca UPDATE
-- no corpo da 1.0, porque o `body_hash` aceito por cada família aponta para o texto da
-- época. `effective_from` é a data em que a versão passa a valer.
INSERT INTO "consent_purposes" ("id", "code", "name", "description", "is_required", "is_sensitive")
VALUES
  (gen_random_uuid(), 'enrollment',       'Matrícula e execução do contrato', 'Dados necessários para matricular o aluno e prestar o serviço de escolinha: identificação, data de nascimento, turma, frequência e avaliações pedagógicas.', true,  false),
  (gen_random_uuid(), 'image_internal',   'Uso interno de imagem',            'Fotos e vídeos do aluno usados apenas dentro da escola: registro de treino, evolução técnica e comunicação com a própria família.',                      false, false),
  (gen_random_uuid(), 'image_public',     'Divulgação de imagem em marketing','Fotos e vídeos do aluno em redes sociais, site e material de divulgação da escola, fora do ambiente interno.',                                            false, false),
  (gen_random_uuid(), 'public_card',      'Perfil público do aluno',          'Card público do aluno (apelido, posição, habilidades e conquistas) visível a qualquer pessoa com o link. Nunca inclui nome completo, foto ou nascimento.', false, false),
  (gen_random_uuid(), 'health_anamnesis', 'Anamnese e prontuário',            'Informações de saúde do aluno (alergias, lesões, condições clínicas, medicações) registradas e consultadas pela equipe técnica da escola.',              false, true),
  (gen_random_uuid(), 'health_emergency', 'Kit de emergência',                'Contatos de emergência e orientações de primeiros socorros para uso exclusivo em situação de urgência durante a atividade.',                            false, true),
  (gen_random_uuid(), 'marketing',        'Comunicações de marketing',        'Envio de novidades, promoções, matrícula aberta e comunicados comerciais por e-mail ou WhatsApp, além do aviso operacional.',                            false, false)
ON CONFLICT ("code") DO NOTHING;

WITH terms ("code", "body") AS (
  VALUES
    ('enrollment', $body$
## Matrícula e execução do contrato

Autorizo a escola a tratar os dados do aluno necessários para matricular e acompanhar a
prática esportiva: nome, data de nascimento, turma, frequência, avaliações técnicas e
registros de contato com o responsável.

Base legal: execução de contrato (LGPD, art. 7º, V) e proteção da criança (art. 14).
Este consentimento é obrigatório para a matrícula existir e pode ser revogado a qualquer
momento; a revogação encerra a possibilidade de renovar a matrícula, mas não apaga o
histórico já produzido sob contrato.
$body$),
    ('image_internal', $body$
## Uso interno de imagem

Autorizo o uso de fotos e vídeos do aluno dentro da escola: registro de treino, evolução
técnica, material de aula e comunicação com a própria família.

As imagens não são publicadas em redes sociais, site ou material de divulgação enquanto
esta autorização for a única vigente. Base legal: consentimento (LGPD, art. 7º, I).
$body$),
    ('image_public', $body$
## Divulgação de imagem em marketing

Autorizo o uso de fotos e vídeos do aluno em redes sociais, site e material de divulgação
da escola.

Para menores de 12 anos o consentimento é dado em destaque e de forma específica
(LGPD, art. 14, §1º). A revogação tem efeito imediato: o material sai do ar e o card
público do aluno é desligado.
$body$),
    ('public_card', $body$
## Perfil público do aluno

Autorizo a publicação do card público do aluno com apelido, posição, habilidades e
conquistas.

O card nunca mostra nome completo, foto, data de nascimento nem dados de comportamento.
É desligado por padrão, exige consentimento de imagem pública vigente e não é liberado
para menores de 12 anos. A revogação desliga o card imediatamente.
$body$),
    ('health_anamnesis', $body$
## Anamnese e prontuário

Autorizo o registro e a consulta de informações de saúde do aluno (alergias, lesões,
condições clínicas e medicações) pela equipe técnica da escola.

Dado pessoal sensível (LGPD, art. 5º, II e art. 11, I): acesso restrito à coordenação e
à administração, com registro de auditoria. Professores veem apenas a orientação de
emergência, nunca o prontuário.
$body$),
    ('health_emergency', $body$
## Kit de emergência

Autorizo o uso dos contatos de emergência e das orientações de primeiros socorros do aluno
em situação de urgência durante a atividade.

O acesso vale para qualquer colaborador presente no momento da emergência — é o único dado
de saúde liberado ao professor. Base legal: consentimento e proteção da vida.
$body$),
    ('marketing', $body$
## Comunicações de marketing

Autorizo o envio de novidades, promoções, matrícula aberta e comunicados comerciais por
e-mail ou WhatsApp.

Não inclui avisos operacionais (aula cancelada, cobrança, ocorrência), que são enviados
independentemente deste consentimento. A revogação interrompe o envio promocional.
$body$)
)
INSERT INTO "consent_terms" ("id", "purpose_code", "version", "body_markdown", "body_hash", "effective_from")
SELECT
  gen_random_uuid(),
  t."code",
  '1.0',
  t."body",
  encode(sha256(convert_to(t."body", 'UTF8')), 'hex'),
  '2026-01-01T00:00:00Z'::timestamptz
FROM terms t
ON CONFLICT ("purpose_code", "version") DO NOTHING;

-- Uma autorização vigente por aluno e finalidade. Reaceitar depois de revogar cria uma
-- linha nova (o histórico de revogação fica na linha anterior); duas `granted` ao mesmo
-- tempo seria estado impossível e faria a leitura "primeiro consentimento" mentir.
CREATE UNIQUE INDEX IF NOT EXISTS "consents_one_granted_per_purpose"
  ON "consents" ("student_id", "purpose_code")
  WHERE "status" = 'granted';
