# 02 — Menores de idade, LGPD e ECA Digital

> **Aviso:** este documento é engenharia de produto, não parecer jurídico. Cada escola
> contratante deve validar contratos, termos e fluxos com seu jurídico/DPO. O objetivo
> aqui é **construir o produto de forma que a conformidade seja possível e barata**.

## 1. Resumo executivo

O aluno é menor de idade, então a plataforma não pode tratá-lo como um usuário comum.
A decisão estruturante é:

> **O aluno é um perfil tutelado. A conta âncora é a do responsável legal.**

E desdobramos isso em sete regras não negociáveis:

| # | Regra | Por quê |
|---|---|---|
| R1 | `student` não tem e-mail, senha nem login próprio antes dos 16 | ECA Digital art. 24: conta de menor vinculada à do responsável |
| R2 | Todo vínculo aluno↔adulto é explícito, com grau e comprovação | Evita que um adulto qualquer acesse dados da criança |
| R3 | Cada finalidade tem seu consentimento, versionado e revogável | LGPD art. 14 §1º (específico e em destaque) e art. 8º |
| R4 | Saúde é dado sensível, com visibilidade segregada | LGPD art. 11 |
| R5 | Nada do aluno é público por padrão | Privacidade por padrão + melhor interesse |
| R6 | Matrícula **não** pode ser condicionada a consentimento de imagem/perfil | Consentimento deve ser livre (LGPD art. 8º) |
| R7 | Aos 18, a titularidade migra automaticamente para o aluno | Fim da tutela; direito de assumir a própria conta |

## 2. Quem é o controlador? (a pergunta que define o contrato)

A escola decide **quais** alunos matricular, **qual** conteúdo pedagógico usar, **quem**
pode ver o quê e **por quanto tempo** guardar. A NextGen apenas trata os dados para
prestar o serviço.

| Papel | Quem | Responsabilidade |
|---|---|---|
| **Controlador** | Escola | Finalidade, base legal, atendimento ao titular, retenção |
| **Operador** | NextGen | Tratar conforme instruções, segurança, sigilo, suboperadores |
| **Suboperadores** | Resend, Asaas, Cloudflare, Neon, Meta (WhatsApp) | Listados no DPA e no site |
| **Encarregado (DPO)** | Um por escola (ou compartilhado) + um da NextGen | Canal com titular e ANPD |

Isso precisa estar no **contrato de SaaS** (DPA anexo), com:

- objeto e duração do tratamento;
- instruções documentadas da escola;
- dever de sigilo e treinamento;
- medidas de segurança mínimas (criptografia, backup, controle de acesso);
- notificação de incidente em prazo curto (sugestão: 24h para a escola, que decide sobre ANPD/titulares);
- suboperadores e processo de aprovação;
- auditoria e due diligence;
- devolução/eliminação ao fim do contrato, com exceção de guarda legal;
- responsabilidade por danos e regresso.

**Consequência de produto:** a política de privacidade é **da escola**, publicada no site
público dela, com a NextGen como operadora. O aceite no onboarding é da escola, não do pai.

## 3. Matriz de finalidades × base legal × consentimento

Esta matriz é a fonte da verdade. Cada linha vira um `consent_type` no banco.

| Finalidade | Dados | Base legal | Consentimento? | Obrigatório p/ matricular? | Revogável? |
|---|---|---|---|---|---|
| Matrícula e execução do serviço educacional | nome, nascimento, turma, responsável, contato | Execução de contrato (art. 7º, V) | Não | Sim (é o contrato) | Não, sem encerrar |
| Segurança e frequência | foto de identificação, presença, autorizados a retirar | Execução de contrato + legítimo interesse | Não | Sim | Não |
| Kit de emergência | alergias, medicação, condição que exige cuidado, contato de emergência | Tutela da saúde (art. 11, II, f) | Não (informativo destacado) | **Sim** — segurança da criança | Não |
| Anamnese completa / histórico de saúde | histórico médico, lesões, exames, laudo | Consentimento específico (art. 11, I) | **Sim, granular** | Não | **Sim** |
| Imagem e voz — uso interno/pedagógico | foto, vídeo, áudio | Consentimento específico | **Sim** | Não | **Sim** |
| Imagem e voz — site, redes e publicidade | foto, vídeo, nome | Consentimento específico | **Sim, separado do interno** | Não | **Sim** |
| Perfil público do aluno (card) | apelido, turma, skills, conquistas | Consentimento específico | **Sim, opt-in** | Não | **Sim** |
| Cobrança e financeiro | dados do **responsável financeiro**, CPF, endereço, histórico | Execução de contrato + obrigação legal (art. 7º, II) | Não | Sim | Não |
| Comunicação e marketing para o responsável | e-mail, telefone | Consentimento (adulto) | **Sim, opt-in** | Não | Sim |
| Analytics/cookies não essenciais | navegação | Consentimento (adulto) | Sim | Não | Sim |

### Regras de ouro

1. **Consentimento não é aceite de termo de uso.** Um checkbox escondido no fim de um
   contrato de 12 páginas não é "em destaque".
2. **Nunca condicione matrícula a imagem/perfil público.** Se a escola exigir, a família
   pode aceitar — mas o produto deve deixar claro que é opcional e permitir recusar.
3. **Cada finalidade tem um toggle independente**, com texto curto e link para o detalhe.
4. **Recusa não pode gerar retaliação.** Sem bloqueio de acesso ao boletim, à chamada etc.
5. **Marketing infantil é proibido.** Nada de publicidade comportamental direcionada a menor
   (ECA Digital arts. 22 e 26). O card público não é vitrine de anúncio.

## 4. Consentimento: como registrar de verdade

O registro precisa provar **quem autorizou, o quê, quando, como e sob qual texto**.

```sql
create table consent_purposes (
  code            text primary key,        -- 'health_full', 'image_public', 'public_card'
  title           text not null,
  description     text not null,
  is_required     boolean not null default false,
  legal_basis     text not null,           -- 'consent' | 'contract' | 'legal_obligation' | 'health'
  requires_reconsent_on_minor_change boolean not null default true
);

create table consent_terms (            -- texto versionado, imutável
  id              uuid primary key,
  purpose_code    text not null references consent_purposes(code),
  version         text not null,         -- '2026-11-01'
  body_md         text not null,
  body_hash       text not null,         -- sha256 do corpo, para integridade
  published_at    timestamptz not null,
  unique (purpose_code, version)
);

create table consents (
  id              uuid primary key,
  school_id       uuid not null,
  student_id      uuid not null,
  purpose_code    text not null,
  term_id         uuid not null references consent_terms(id),
  granted_by      uuid not null,          -- guardian_id ou user_id (16+)
  granted_by_role text not null,          -- 'guardian' | 'student' | 'school_staff'
  status          text not null,          -- 'granted' | 'revoked' | 'expired'
  granted_at      timestamptz not null,
  revoked_at      timestamptz,
  revoke_reason   text,
  evidence        jsonb not null,         -- ip, user_agent, canal, hash
  created_at      timestamptz not null default now()
);
```

Regras de implementação:

- **Append-only.** Nunca `update` em `consents`; revogação é um novo evento/`status`
  com `revoked_at`, preservando o histórico.
- **Evidência** guarda: IP, user-agent, timestamp do servidor, canal (`email_link`,
  `portal`, `presencial`), `term_hash` e o id do e-mail/clique quando houver.
- **Reconsentimento automático** quando o texto muda de forma material ou quando o aluno
  muda de faixa (ex.: completa 12 ou 16 anos).
- **Verificação de e-mail do responsável**: link de confirmação com token de uso único,
  expiração de 7 dias e registro do clique (double opt-in). Isso **não substitui** a
  verificação documental da matrícula, apenas a complementa.
- **Revogação em 1 clique** no portal do responsável, com efeito imediato em: site,
  card público, materiais e envio de marketing. Dados pedagógicos continuam pelo contrato.

### Fluxo de consentimento na matrícula

```mermaid
sequenceDiagram
    autonumber
    actor A as Adm/Coordenação
    actor R as Responsável
    participant S as NextGen
    participant E as E-mail

    A->>S: Cria aluno + matrícula (dados mínimos)
    S->>S: Gera convite com token único (7 dias)
    S->>E: Envia convite ao e-mail do responsável
    E-->>R: "Confirme o vínculo com seu filho"
    R->>S: Abre link, cria conta, confirma CPF/telefone
    S->>R: Exibe termos por finalidade (checkboxes separados)
    R->>S: Aceita contrato + kit de emergência (obrigatórios)
    opt Opcionais
        R->>S: Aceita ou recusa anamnese, imagem interna, imagem pública, card
    end
    S->>S: Grava consents + evidências + hash do termo
    S->>A: Matrícula ativa; pendências visíveis no painel
    S->>E: Envia boleto/Pix conforme vencimento escolhido
```

Enquanto o responsável não confirma, a matrícula fica em **`pending_guardian`**: o aluno
aparece na turma, mas sem acesso a conteúdo, sem financeiro e sem card.

## 5. Verificação de idade e de vínculo (sem fricção)

O ECA Digital veda autodeclaração de idade (art. 9º, §1º). Na prática, para uma escola:

| Nível | Método | Quando usar |
|---|---|---|
| **1. Documental presencial** *(padrão ouro)* | Funcionário confere certidão de nascimento e documento do responsável; registra tipo, número mascarado, validade e hash do arquivo | Matrícula na secretaria |
| **2. Documental digital** | Upload de documento + conferência humana assíncrona | Matrícula online |
| **3. Validação cadastral** | Consulta a base oficial (CPF → data de nascimento) via API | Conveniência/auto-atendimento |
| **4. E-mail + telefone** | Confirmação de contato e vínculo declarado | Complemento, nunca sozinho |

Implementação:

- `age_verification_method` e `age_verified_at` no vínculo com o responsável;
- `document_type`, `document_hash`, `verified_by`, `verified_at` (nunca o número completo
  em claro no banco, se evitável);
- cálculo de idade sempre **server-side** a partir de `birth_date`, nunca do cliente;
- **bloqueio de cadastro** se a data de nascimento indicar 18+ e o fluxo for de aluno menor;
- registro de tentativas e de divergências para auditoria.

> **Ponto de atenção jurídica:** a lei fala em "esforços razoáveis" e a ANPD ainda
> regulamenta procedimentos. A defesa mais forte da escola é a verificação presencial
> documentada. O produto deve tornar isso o caminho padrão, não a exceção.

## 6. Três regimes etários, três comportamentos

### 6.1 Criança (0–11 anos completos)

- Consentimento **específico e em destaque** de ao menos um pai/mãe/responsável (LGPD art. 14, §1º).
- **Sem login próprio.** Nenhum e-mail, nenhuma senha, nenhuma notificação direta.
- Comunicação **somente** com o responsável. Proibido chat/mensagem direta adulto↔criança.
- Card público: **não existe**. O card privado do portal mostra apelido, turma e badges,
  **sem nota, sem nome completo, sem foto pública, sem data de nascimento**.
- Nenhum dado de geolocalização em tempo real.

### 6.2 Adolescente (12–15 anos)

- LGPD não exige consentimento parental pelo §1º, mas o **melhor interesse** continua e o
  ECA Digital exige vínculo com responsável até 16.
- Pode ter **acesso supervisionado**: login próprio vinculado à conta do responsável
  (`supervised_account`), com permissões limitadas (ver conteúdo, ver card, ver próprias
  avaliações). **Não** pode alterar dados cadastrais, autorizar imagem ou contratar.
- O responsável vê tudo o que o adolescente vê e recebe cópia das comunicações.

### 6.3 Adolescente (16–17 anos)

- Conta própria permitida, mas **ainda vinculada** ao responsável (ECA Digital).
- Pode consentir em finalidades de baixo risco (ex.: notificações de treino).
- Imagem pública, card público e dados sensíveis continuam exigindo **co-assentimento**
  do responsável — recomendação de produto, conservadora e defensável.
- Aos 18: **transferência de titularidade** (ver §6.4).

### 6.4 Maioridade

Job diário verifica alunos que completaram 18 anos:

1. envia aviso ao aluno e ao responsável (D-30 e D0);
2. cria credencial própria para o aluno (convite);
3. mantém o responsável com acesso **somente leitura** por 90 dias, salvo oposição;
4. encerra o vínculo de tutela e registra o evento de auditoria;
5. permite ao aluno revogar consentimentos e pedir exclusão do que não tem guarda legal.

## 7. Dados de saúde: o ponto mais sensível

Anamnese é **dado pessoal sensível** (LGPD art. 11). Três decisões de produto:

### 7.1 Separar "kit de emergência" de "prontuário"

| Camada | Conteúdo | Quem vê | Base |
|---|---|---|---|
| **Kit de emergência** | alergias, medicação de uso contínuo, epilepsia/asma, contato de emergência | Professor da turma, coordenação, adm | Tutela da saúde |
| **Anamnese completa** | histórico familiar, lesões pregressas, laudos, cirurgias, exames | Coordenação + responsável + profissional de saúde designado | Consentimento específico |

O professor **nunca** vê o prontuário completo por padrão. Vê um selo: *"Atenção: restrição
de saúde — toque para ver o kit de emergência"*.

### 7.2 Ciclo de anamnese

- **Inicial** obrigatória para liberar atividade física;
- **Periódica** a cada 12 meses (ou 6 meses para aluno em competição);
- **Atualização por evento**: lesão, cirurgia, diagnóstico novo;
- **Atestado médico** com validade e alerta de vencimento no painel;
- bloqueio de participação em jogo/treino se atestado vencido (regra configurável pela escola).

### 7.3 Controles técnicos

- criptografia em repouso **no nível da coluna** (chave gerenciada) para campos clínicos;
- acesso por role + vínculo com o aluno, com **registro de leitura** (`audit_log`);
- exportação e exclusão apenas por coordenação/DPO, com dupla confirmação;
- nunca incluir saúde em e-mail, notificação push ou log de aplicação;
- retenção definida pela escola, com recomendação mínima até os 18 + prazo prescricional.

## 8. Perfil público e card (o caso "FIFA")

É o pedido mais divertido e o de maior risco. Regras:

1. **Opt-in explícito**, separado do consentimento de imagem interna.
2. **Default:** desligado, `noindex`, URL com slug aleatório (não sequencial, não adivinhável).
3. **Idade < 12:** não há card público. O portal do responsável mostra apelido, turma,
   badges e evolução — sem nota, sem nome completo, sem foto pública, sem escola, sem endereço,
   sem horário de treino.
4. **12–17:** nome + foto apenas com consentimento específico de imagem pública **e**
   co-assentimento do responsável.
5. **Nunca publicar:** data de nascimento, CPF, endereço, telefone, escola, turma/horário,
   dados de saúde, avaliação comportamental, observações de professores.
6. **Sem ranking público** entre alunos. O card mostra **evolução pessoal**, não comparação.
7. **Revogação imediata:** card sai do ar em < 1 minuto (cache invalidado por tag).
8. **Compartilhamento:** link + imagem OG gerada no servidor; sem download de dados brutos.
9. **Remoção a pedido:** responsável, escola ou ANPD; log de quem removeu e quando.

Detalhes visuais em [`08-avaliacao-e-card.md`](08-avaliacao-e-card.md).

## 9. Direitos do titular no produto

O responsável (e o aluno 16+) tem uma área "Privacidade" com:

| Direito (LGPD art. 18) | Implementação | Prazo |
|---|---|---|
| Confirmação e acesso | Download de todos os dados do aluno em JSON + PDF legível | imediato |
| Correção | Edição cadastral; correção de avaliação via coordenação | imediato / 15 dias |
| Anonimização/bloqueio/eliminação | Fluxo com validação e exclusão em cascata, preservando guarda legal | 15 dias |
| Portabilidade | Exportação estruturada (JSON) + CSV | 15 dias |
| Informação sobre compartilhamento | Página "Com quem compartilhamos" + lista de suboperadores | imediato |
| Revogação | Toggle por finalidade, efeito imediato | imediato |
| Oposição | Canal com a escola + registro de solicitação | 15 dias |

**Exclusão x guarda legal:** dados financeiros (notas, boletos, recibos) ficam retidos pelo
prazo fiscal aplicável, **desvinculados** de dados pedagógicos e de saúde. O aluno é
anonimizado; a cobrança permanece no CPF do responsável.

## 10. Retenção e eliminação

| Dado | Retenção padrão | Após prazo |
|---|---|---|
| Cadastro e pedagógico | enquanto durar a matrícula + 1 ano | anonimizar/excluir |
| Saúde/anamnese | matrícula + 5 anos (recomendação) | excluir |
| Imagem/vídeo | enquanto o consentimento valer | excluir mídia e derivados |
| Card público | enquanto o consentimento valer | despublicar |
| Financeiro | 5 anos (prazo fiscal) | manter desvinculado |
| Logs de auditoria | 5 anos | agregar/excluir |
| Backups | 30–90 dias rotativos | expurgo automático |

Implementar como **política declarativa** + job de expurgo com relatório mensal por escola.

## 11. Segurança e governança

- **RIPD/DPIA** obrigatório para o tratamento (menores + saúde + perfil público). Documento
  modelo por escola, com versão assinada no onboarding.
- **Treinamento** anual de professores e secretaria (phishing, acesso, incidente).
- **Gestão de incidentes:** runbook, triagem em 24h, comunicação à escola, avaliação de risco
  relevante à ANPD e aos titulares.
- **Auditoria** de leitura de dados sensíveis e de exportações.
- **Revisão de fornecedores** com cláusula de LGPD e região de dados no Brasil quando possível.
- **Testes de RLS** automatizados: nenhuma query pode cruzar `school_id`.

## 12. Anti-padrões proibidos (bloqueio de merge)

- ❌ Aluno com e-mail/senha antes dos 16
- ❌ Chat direto entre adulto e menor
- ❌ Ranking público de alunos ou "peneira" exposta
- ❌ Foto + nome completo + escola no card público
- ❌ Consentimento único "aceito tudo" para finalidades distintas
- ❌ Consentimento de imagem como condição de matrícula
- ❌ Biometria facial para chamada
- ❌ Geolocalização em tempo real do menor
- ❌ Anúncios ou perfilamento de menores
- ❌ Dados de saúde em log, e-mail, push ou analytics
- ❌ Exclusão "hard delete" sem passar pela política de retenção
- ❌ `school_id` vindo do cliente sem validação de sessão

## 13. Checklist de conformidade por release

- [ ] Nova finalidade tem `consent_purpose` + termo versionado + texto em destaque
- [ ] Nova tabela com dado de aluno tem `school_id` + RLS + política de retenção
- [ ] Campo sensível tem criptografia e auditoria de leitura
- [ ] Tela de consentimento tem opção de recusar sem bloquear o essencial
- [ ] Exportação e exclusão cobrem a nova entidade
- [ ] Suboperador novo entrou no DPA e na página pública
- [ ] Fluxo testado com perfil "criança", "adolescente 15" e "16+"
- [ ] Nenhum dado de menor em log/analytics

## 14. Referências

- **LGPD** — Lei 13.709/2018, arts. 7º, 8º, 11, 14, 18 e 46–49.
- **ECA** — Lei 8.069/1990.
- **ECA Digital** — Lei 15.211/2025 (vigência em 17/03/2026; fiscalização plena a partir de
  jan/2027). Pontos que impactam o produto: art. 9º (verificação de idade), art. 24 (conta de
  menor vinculada ao responsável), arts. 22 e 26 (publicidade/perfilamento), art. 20
  (mecânicas de recompensa — evitar loot box).
- **ANPD** — guias de segurança, incidentes e tratamento de dados de crianças.
- **CDC** — Lei 8.078/1990 (cobrança, negativação, informação clara).
