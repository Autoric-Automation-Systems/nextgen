# 09 — Roadmap e backlog

## 1. Estratégia

Não construir os 11 módulos em paralelo. A ordem segue uma lógica de **valor cobrável**:

1. Sem matrícula + responsável + cobrança, a escola não paga.
2. Sem chamada + avaliação, a escola não usa.
3. Sem site + card, a escola não cresce — e o produto não viraliza.

```
Fase 0  Fundação e conformidade          (2–3 semanas)
Fase 1  Núcleo operacional               (6–8 semanas)  → cobrável
Fase 2  Pedagogia e engajamento          (6–8 semanas)  → retenção
Fase 3  Crescimento e automação          (8 semanas)    → expansão
Fase 4  Escala                           (contínuo)
```

## 2. Fases

### Fase 0 — Fundação (2–3 semanas)

Objetivo: base técnica e jurídica para não retrabalhar.

- [ ] Monorepo, CI, ambientes, lint, typecheck, testes
- [ ] Schema Prisma inicial + RLS + seed
- [ ] Auth + memberships + RBAC + auditoria
- [ ] Multi-tenant por subdomínio
- [ ] Design tokens + componentes base (shadcn)
- [ ] Modelos jurídicos: DPA, termo de uso, política de privacidade, consentimentos
- [ ] RIPD inicial
- [ ] Backoffice NextGen mínimo (criar escola, ver uso)

**Saída:** uma escola fictícia consegue logar e ver um painel vazio seguro.

### Fase 1 — Núcleo operacional (6–8 semanas) · MVP cobrável

- [ ] Escola, unidades, salas, identidade visual
- [ ] Alunos, responsáveis, vínculo, pessoas autorizadas
- [ ] Convite ao responsável + consentimentos + portal do responsável (mínimo)
- [ ] Categorias por temporada + turmas + matrícula
- [ ] Atestado médico com validade
- [ ] Kit de emergência
- [ ] Chamada (app do professor PWA, offline)
- [ ] Plano de aula básico + biblioteca de templates
- [ ] Cobrança: plano, competência, Pix/boleto, webhook, recibo
- [ ] Painel financeiro: recebido, a receber, vencido, inadimplentes
- [ ] Despesas simples
- [ ] E-mail transacional (convite, cobrança, recibo)

**Critério de saída (definição de "vendável"):**
- Uma escola real consegue matricular 50 alunos e cobrar 1 mês inteiro sem intervenção.
- Chamada funciona com celular em modo avião e sincroniza depois.
- Responsável confirma vínculo e vê a mensalidade.
- Nenhum dado de uma escola visível para outra (teste automatizado).

### Fase 2 — Pedagogia e engajamento (6–8 semanas)

- [ ] Matérias, capítulos, conteúdos (vídeo, áudio, PDF, imagem, texto)
- [ ] Progresso do aluno
- [ ] Avaliação por skills + ciclos + rubrica
- [ ] Card privado + evolução
- [ ] Card público opt-in + OG image + revogação
- [ ] Badges
- [ ] Anamnese completa + periódica
- [ ] Ocorrências e lesões + notificação ao responsável
- [ ] Boletim em PDF
- [ ] Relatórios pedagógicos

**Critério de saída:** professor avalia uma turma inteira em < 10 minutos; responsável
recebe o card e o boletim.

### Fase 3 — Crescimento e automação (8 semanas)

- [ ] Site público completo + SEO + lead de aula experimental
- [ ] Domínio próprio
- [ ] WhatsApp transacional + régua de cobrança multicanal
- [ ] Cartão recorrente
- [ ] Lista de espera + aula experimental + reposição
- [ ] Relatório de aulas por professor
- [ ] Exportação completa da escola
- [ ] Backoffice NextGen: assinatura, inadimplência do SaaS, feature flags
- [ ] App do responsável (PWA instalável, notificações)

**Critério de saída:** escola reduz ligações na secretaria e aumenta conversão de experimental.

### Fase 4 — Escala (contínuo)

- [ ] Multi-unidade avançado e franquia
- [ ] API pública + webhooks
- [ ] Integração contábil / NFS-e
- [ ] BI com dados agregados e benchmarks anônimos
- [ ] Torneios e escalação
- [ ] Repasse de professores
- [ ] App nativo (se PWA não bastar)
- [ ] SOC2-lite / ISO 27001 (se vender para clube grande)

## 3. Backlog priorizado

Escala: **P** ≤ 3 dias · **M** ≤ 1 semana · **G** ≤ 2 semanas · **GG** > 2 semanas.

### Must (MVP)

| ID | Item | Est. |
|---|---|---|
| AUTH-01 | Login, sessão, convite, RBAC | G |
| TEN-01 | Multi-tenant + RLS + testes | G |
| SCH-01 | CRUD escola/unidade/sala + branding | M |
| STU-01 | CRUD aluno + responsável + vínculo | G |
| STU-02 | Convite e confirmação do responsável | M |
| CON-01 | Consentimentos versionados + evidência | G |
| CLS-01 | Temporada, categoria, turma, matrícula | G |
| ATT-01 | Chamada PWA offline + sync | GG |
| PLN-01 | Plano de aula + templates | M |
| FIN-01 | Planos, cobrança, pro-rata, competência | G |
| FIN-02 | Integração Asaas + webhook idempotente | G |
| FIN-03 | Painel financeiro + inadimplência | M |
| MED-01 | Atestado + kit de emergência | M |
| NTF-01 | E-mail transacional + log | M |
| ADM-01 | Backoffice NextGen mínimo | M |

### Should (v1.1)

| ID | Item | Est. |
|---|---|---|
| CNT-01 | Matérias/capítulos/conteúdo | G |
| ASM-01 | Skills + ciclo + rubrica | GG |
| CARD-01 | Card privado + público + OG | G |
| HLT-01 | Anamnese completa + periódica | G |
| INC-01 | Ocorrências/lesões | M |
| RPT-01 | Relatórios pedagógicos + boletim | G |
| SITE-01 | Site público + SEO + lead | G |
| WPP-01 | WhatsApp transacional | M |
| FIN-04 | Régua de cobrança | M |
| FIN-05 | Cartão recorrente | M |
| ENR-02 | Lista de espera, experimental, reposição | M |
| EXP-01 | Exportação completa | M |

### Could (v2)

Domínio próprio · NFS-e · API pública · torneios · repasse de professores · app nativo ·
multi-franquia · benchmark anônimo.

### Won't (por ora)

Biometria facial · chat adulto-menor · ranking público · marketplace · empréstimo ·
criptomoeda · loot box.

## 4. Cronograma sugerido (time de 2 pessoas)

| Semanas | Entrega |
|---|---|
| 1–3 | Fase 0 |
| 4–11 | Fase 1 (MVP) — piloto com 1 escola |
| 12–19 | Fase 2 — 3 escolas pagantes |
| 20–27 | Fase 3 — 10 escolas |
| 28+ | Fase 4 |

Com 1 pessoa, multiplicar por ~1,7. Com 3–4, paralelizar front/back e reduzir ~30%.

## 5. Riscos do roadmap

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Escopo crescer no MVP | alta | alto | congelar Must; tudo mais vai para backlog |
| Integração de pagamento atrasar | média | alto | começar com Pix estático + baixa manual |
| Escola não migrar dados | alta | médio | importador CSV robusto + serviço de migração |
| Professor não adotar | alta | alto | treinamento + app offline + meta de 3 toques |
| Exigência jurídica mudar | média | alto | arquitetura de consentimento versionada |
| Custo de vídeo | média | médio | limite por plano |
| Time pequeno e suporte | alta | médio | base de conhecimento + vídeos curtos |

## 6. Definition of Done (por história)

- [ ] Regra de negócio coberta por teste
- [ ] RLS validada (quando há `school_id`)
- [ ] Auditoria nos eventos relevantes
- [ ] Estados vazios, erro e loading implementados
- [ ] Mobile validado (375px)
- [ ] Acessibilidade AA (contraste, foco, teclado)
- [ ] Texto em PT-BR revisado
- [ ] Documentação de API/uso atualizada
- [ ] Feature flag quando aplicável
- [ ] Analytics de adoção (evento nomeado)
