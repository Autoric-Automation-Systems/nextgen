# 11 — Decisões e perguntas abertas

## 1. Decisões tomadas (ADR resumido)

### ADR-001 — Multi-tenant com coluna + RLS
**Decisão:** banco único, `school_id` em todas as tabelas, RLS obrigatória.
**Motivo:** custo marginal baixo, operação simples, volume inicial pequeno.
**Consequência:** exige disciplina rígida e testes de isolamento em CI.
**Revisitar quando:** cliente enterprise exigir isolamento físico.

### ADR-002 — Monolito modular Next.js
**Decisão:** um app Next.js + pacotes internos, sem microserviços.
**Motivo:** time pequeno, velocidade, menos infraestrutura.
**Consequência:** jobs precisam de plataforma externa (Inngest) para não competir com requests.

### ADR-003 — Aluno é perfil tutelado, não usuário
**Decisão:** sem login próprio antes dos 16; conta âncora é do responsável.
**Motivo:** LGPD art. 14 + ECA Digital art. 24 + segurança.
**Consequência:** todo o domínio de identidade gira em torno de `guardian`, não de `user`.

### ADR-004 — Dinheiro fica na conta da escola
**Decisão:** gateway da própria escola (ou subconta), NextGen só orquestra.
**Motivo:** evitar regulação de arranjo de pagamento e risco de crédito.
**Consequência:** onboarding inclui criar conta no gateway; fallback Pix estático.

### ADR-005 — Card público é opt-in e sem ranking
**Decisão:** default desligado, `noindex`, slug aleatório, sem comportamento.
**Motivo:** risco jurídico e reputacional; proteção da criança.
**Consequência:** menos viralidade que um ranking, mais sustentável.

### ADR-006 — Offline-first apenas no app do professor
**Decisão:** PWA com IndexedDB e fila de sincronização; backoffice é online.
**Motivo:** o campo é o único lugar sem conectividade garantida.
**Consequência:** complexidade de conflito concentrada em poucas entidades.

### ADR-007 — Vercel Blob como storage único, com dois stores
**Decisão:** Vercel Blob para tudo (foto, PDF, áudio, vídeo curto), separado em store
`public` (site) e `private` (mídia de aluno), com URL assinada de curta duração.
**Motivo:** integração nativa com Next.js, `access: 'private'` com `presignUrl`, upload
direto do browser com multipart, e um fornecedor a menos para operar.
**Consequência:** Blob **não transcodifica** e **não serve HLS**; arquivo acima de 512 MB
não é cacheado pela CDN. Vídeo é aceito como clipe curto e comprimido no cliente. Se uma
escola exigir player adaptativo, avaliar Mux/Cloudflare Stream como complemento na v2.
**Custo:** US$ 0,023/GB armazenado e US$ 0,05/GB transferido — o risco está no egress de
vídeo, não no armazenamento; mitigar com limite mensal por escola.

## 2. Perguntas que preciso responder com você

Estas decisões mudam escopo, preço ou arquitetura. Sem resposta, sigo com o default indicado.

| # | Pergunta | Default se não houver resposta |
|---|---|---|
| 1 | O produto é **white-label** (a escola tem a marca) ou a marca NextGen aparece? | white-label no plano Escola+ |
| 2 | Quem é o **controlador** no contrato: a escola (recomendado) ou a NextGen? | escola |
| 3 | O card público é **default ligado** para alunos 12+? | não, sempre opt-in |
| 4 | Aluno de 13–15 tem login próprio supervisionado? | sim, somente leitura |
| 5 | O vencimento pode ser qualquer dia ou só 5/10/15/20? | 5, 10, 15, 20 e "10 dias após matrícula" |
| 6 | A escola usa boleto, Pix ou cartão hoje? Qual banco/gateway? | Pix + boleto via Asaas |
| 7 | Existe cobrança de **matrícula** e **material** além da mensalidade? | sim, como itens de plano |
| 8 | A escola quer emitir NFS-e pelo sistema? | não na v1 |
| 9 | Quantas unidades a primeira escola tem? | 1 |
| 10 | Há professores autônomos a pagar por aula? | relatório sim, repasse v2 |
| 11 | O site público precisa de domínio próprio na v1? | não, subdomínio |
| 12 | Precisa de app nativo (iOS/Android) ou PWA resolve? | PWA |
| 13 | Qual o volume inicial: quantas escolas e alunos no primeiro ano? | 10 escolas / 1.000 alunos |
| 14 | Existe exigência de dados só no Brasil? | sim, `sa-east-1` |
| 15 | Quem faz o jurídico (DPA, termos, RIPD)? | modelo pronto + revisão externa |
| 16 | ~~Card público de menor de 12 anos~~ | **decidido**: card público só a partir dos 12, com consentimento do responsável; abaixo disso não existe card público (o card privado continua mostrando só barras) |
| 17 | Card público exige consentimento de **imagem em divulgação** junto com o do card? | sim: o card pode exibir foto |

## 3. Pendências jurídicas antes do primeiro cliente

- [ ] Contrato de SaaS com DPA anexo
- [ ] Termo de uso da plataforma (escola)
- [ ] Política de privacidade por escola (template)
- [ ] Termos de consentimento por finalidade (versão 1)
- [ ] Política de retenção e eliminação
- [ ] Nomeação de encarregado (DPO) e canal público
- [ ] RIPD/DPIA assinado
- [ ] Lista de suboperadores publicada
- [ ] Procedimento de verificação de idade documentado
- [ ] Modelo de autorização de imagem (interna e pública)
- [ ] Modelo de autorização de retirada por terceiros
- [ ] Termo de ciência de risco esportivo
- [ ] Contrato de prestação de serviço do professor (se aplicável)

## 4. O que eu não faria

| Ideia | Por quê não |
|---|---|
| Ranking público de alunos | exposição de menor, conflito entre famílias, risco jurídico |
| Chat aluno↔professor | canal desprotegido entre adulto e criança |
| Biometria facial na portaria | dado sensível, alto risco, alternativa é QR/crachá |
| Guardar cartão de crédito | aumenta superfície de ataque; tokenizar no gateway |
| Custo por "aluno inativo" | incentiva a escola a esconder cancelamento |
| Gamificação paga | vedada para menor e antiética |
| App nativo no dia 1 | PWA cobre 90% e evita duas lojas |
| Microserviços no dia 1 | complexidade sem escala que justifique |
| Vender dado agregado sem base legal | viola LGPD e destrói confiança |
