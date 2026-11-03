# 12 — Métricas e precificação do SaaS

## 1. Precificação

Cobrar por **aluno ativo** é o modelo que melhor alinha valor: a escola paga mais quando
cresce, e o custo por aluno cai na percepção dela.

| Plano | Alunos | Preço sugerido | Inclui |
|---|---|---|---|
| **Campo** | até 80 | R$ 199/mês | cadastro, turmas, chamada, financeiro básico, site simples |
| **Escola** | 81–300 | R$ 3,50/aluno (mín. R$ 349) | tudo + conteúdo, avaliação, card, portal do responsável |
| **Clube** | 300+ ou multi-unidade | R$ 2,80/aluno (mín. R$ 899) | tudo + multi-unidade, relatórios, API, domínio próprio |

**Regras comerciais**
- 14 dias de trial, sem cartão.
- Desconto anual de 15%.
- Setup opcional de migração: R$ 500–1.500 (ou grátis para os 10 primeiros).
- Não cobrar por professor (incentiva adoção).
- Não cobrar por responsável.
- Cobrar por aluno **ativo** (matrícula ativa), não por cadastro.

### Comparação de valor

Para uma escola de 200 alunos a R$ 250 de mensalidade média:

| Item | Valor |
|---|---|
| Receita mensal da escola | R$ 50.000 |
| Custo NextGen (Escola) | R$ 700 |
| % da receita | 1,4% |
| Se reduzir inadimplência de 12% para 8% | +R$ 2.000/mês |

O argumento de venda é esse: **o produto se paga com 4 pontos de inadimplência**.

## 2. Unit economics

Premissas conservadoras:

| Métrica | Valor |
|---|---|
| Ticket médio | R$ 450/mês |
| CAC | R$ 1.200 |
| Churn mensal de escola | 2,5% |
| Vida média | 40 meses |
| LTV | R$ 18.000 |
| LTV/CAC | 15x |
| Margem bruta | ~85% (infra + gateway de e-mail) |
| Payback | ~3 meses |

Com 50 escolas: MRR ≈ R$ 22.500 · ARR ≈ R$ 270 mil.

**Cuidado:** churn de escola pequena é alto (fecha, muda de dono, sazonalidade). O modelo
precisa de 100+ escolas para ser resiliente.

## 3. KPIs do produto

### Aquisição
- Leads de aula experimental por escola
- Taxa de conversão experimental → matrícula
- Tempo de onboarding (dias até 10 alunos)
- % de escolas que publicam o site na primeira semana

### Ativação
- Escolas com ≥ 1 cobrança emitida
- Escolas com ≥ 80% de chamadas no mês
- Responsáveis que aceitaram o convite (meta > 70%)
- Professores que fizeram ≥ 1 avaliação

### Retenção
- Churn mensal de escola
- Churn de aluno dentro da escola
- DAU/MAU do professor
- Acesso mensal do responsável

### Receita
- MRR, ARR, ARPA
- Receita por aluno
- Expansão (upgrade de plano)
- Inadimplência do próprio SaaS

### Suporte
- Tickets por escola/mês
- Tempo de primeira resposta
- % resolvido na base de conhecimento

## 4. North Star Metric

**Alunos com presença registrada e responsável ativo no mês.**

Essa métrica captura o valor real: a escola usa o sistema, o professor registra, a família
participa. Não é "número de cadastros", que infla e não significa nada.

## 5. Go-to-market (resumo)

1. **Venda direta** em raio de 50 km: 20 escolas visitadas = 3 pilotos.
2. **Piloto gratuito de 60 dias** em troca de depoimento e case.
3. **Parceria com contadores** de escolas esportivas (eles indicam).
4. **Conteúdo**: "quanto custa perder aluno por inadimplência", "LGPD para escolinha".
5. **Card compartilhável** como canal orgânico (cada pai que compartilha expõe a marca).
6. **Programa de indicação**: 1 mês grátis por escola indicada que assinar.

## 6. Metas por fase

| Fase | Escolas | Alunos | MRR | Foco |
|---|---|---|---|---|
| Piloto | 3 | 300 | R$ 1.500 | produto funciona |
| Tração | 15 | 1.500 | R$ 7.000 | onboarding repetível |
| Escala | 50 | 5.000 | R$ 22.000 | vendas e suporte |
| Expansão | 120 | 12.000 | R$ 55.000 | multi-unidade e API |

## 7. Riscos de negócio

| Risco | Mitigação |
|---|---|
| Escola pequena fecha | foco em escolas com 100+ alunos |
| Concorrente de gestão escolar genérico entra | profundidade no nicho futebol (avaliação, campo) |
| Sazonalidade (matrícula em jan/fev) | cobrança mensal + plano anual |
| Inadimplência da própria escola | cobrança recorrente e suspensão gradual |
| Dependência de um gateway | camada de abstração + fallback Pix |
| Custo de suporte alto | onboarding forte, base de conhecimento, vídeos |
