# 01 — Visão de produto e escopo

## 1. Contexto de mercado

O Brasil tem milhares de escolinhas de futebol, núcleos de base, projetos sociais e
academias infantis. A operação típica é:

- 1 a 5 unidades, 50 a 800 alunos;
- cobrança mensal por boleto, Pix ou dinheiro;
- 3 a 20 professores, muitos autônomos;
- comunicação por WhatsApp e Instagram;
- controle em planilha + caderno.

É um mercado fragmentado, de ticket baixo por aluno e alta rotatividade. O software
precisa ser **barato por aluno**, **fácil de operar por quem não é técnico** e **resolver
o dia a dia do professor em campo** — não apenas "cadastro bonito".

## 2. Proposta de valor

**Para a escola:** profissionaliza a operação, reduz inadimplência, dá previsibilidade
financeira e cria um canal digital de aquisição (site + card do aluno compartilhável).

**Para o professor:** menos papel, mais tempo com a criança. Chamada em 30 segundos,
plano de aula reaproveitável, avaliação com evidência (foto/vídeo) e histórico do aluno.

**Para a família:** transparência. Mensalidade no e-mail certo, evolução do filho visível,
autorizações e anamnese digital, comunicação sem grupo de WhatsApp caótico.

**Para o aluno:** um "card" que mostra evolução — sem exposição, sem ranking público,
sem transformar criança em produto de mídia.

## 3. Escopo

### Dentro do escopo (v1)

- Cadastro da escola, unidades, salas/quadras, identidade visual
- Alunos, responsáveis, vínculo e consentimentos
- Categorias (Sub-8, Sub-9…), turmas, horários, professores
- Matrícula e rematrícula com plano e vencimento
- Conteúdo pedagógico (matéria → capítulo → aula/material)
- Plano de aula, chamada e diário de classe
- Avaliação de habilidades + card de evolução
- Anamnese inicial/periódica, restrições e ocorrências
- Mensalidades (boleto/Pix), despesas, painel financeiro e inadimplência
- Site público da escola + card público opt-in
- Portal do responsável e app do professor
- Auditoria, exportação de dados e exclusão

### Fora do escopo (v1)

- Federação, torneios e escalação de campeonato (avaliar v3)
- Repasse/pagamento de professores (folha) — só relatório de aulas dadas
- Telemedicina, prontuário clínico completo, integração com plano de saúde
- Reconhecimento facial / biometria
- Marketplace de escolinhas
- Emissão de nota fiscal própria (integração fica para depois)

## 4. Diferenciais defensáveis

1. **Conformidade como produto**, não como PDF de política de privacidade: consentimento
   versionado, auditoria, visibilidade segregada de saúde, maioridade automática.
2. **Card de evolução** que a família quer compartilhar — motor de aquisição orgânica.
3. **Offline-first no campo** — o professor consegue trabalhar sem sinal.
4. **Financeiro com o dinheiro na conta da escola** — confiança e menos atrito contábil.
5. **White-label** — a escola tem site e identidade próprios, a NextGen fica invisível.

## 5. Modelo de negócio

B2B2C: a NextGen cobra da escola (assinatura por aluno ativo, com mínimo mensal) e a
escola cobra das famílias (mensalidade, fora da plataforma).

Três planos previstos:

| Plano | Para quem | Inclui |
|---|---|---|
| **Campo** | escola até 80 alunos | cadastro, turmas, chamada, financeiro básico |
| **Escola** | 80–300 alunos | tudo + conteúdo, avaliação, site, portal do responsável |
| **Clube** | 300+ / multi-unidade | tudo + multi-unidade, relatórios, API, domínio próprio |

Números em [`12-metricas-precificacao.md`](12-metricas-precificacao.md).

## 6. Glossário (usar exatamente estes termos no código)

| Termo | Definição |
|---|---|
| **Escola** (`school`) | Tenant. Unidade de isolamento de dados e de cobrança da NextGen |
| **Unidade** (`unit`) | Endereço físico: sede, núcleo, polo. Tem quadras/campos |
| **Sala/Recurso** (`room`) | Espaço dentro da unidade (quadra coberta, campo 1, sala de vídeo) |
| **Temporada** (`season`) | Ano/período esportivo. Define categorias e ciclos de avaliação |
| **Categoria** (`category`) | Faixa etária (Sub-8, Sub-9…), calculada por ano de nascimento |
| **Turma** (`class_group`) | Grupo de alunos com horário, unidade, categoria e professor |
| **Matrícula** (`enrollment`) | Vínculo aluno ↔ turma ↔ plano, com vigência e status |
| **Responsável** (`guardian`) | Adulto com vínculo legal e/ou financeiro com o aluno |
| **Aluno** (`student` / `student_profile`) | Menor tutelado; **não** é usuário autônomo antes dos 16 |
| **Consentimento** (`consent`) | Registro imutável de autorização, com finalidade, versão e evidência |
| **Anamnese** | Questionário de saúde inicial e periódico (dado sensível) |
| **Card** | Representação visual das habilidades e evolução do aluno |

> **Atenção de nomenclatura:** o pedido original fala em "salas de aula (nome, endereço)".
> Endereço é atributo de **Unidade**, não de sala. No modelo, `unit` tem endereço e `room`
> pertence a uma unidade. Isso evita retrabalho quando a escola abrir a segunda sede.

## 7. Métricas de sucesso do produto

- **Ativação:** escola publica site e matricula 10 alunos em 7 dias
- **Engajamento do professor:** ≥ 80% das aulas com chamada registrada
- **Engajamento da família:** ≥ 60% dos responsáveis acessam o portal no mês
- **Financeiro:** redução de 30% na inadimplência em 90 dias
- **Retenção:** churn mensal de escola < 2,5%
