# 10 — Operação, segurança e LGPD na prática

## 1. Ambientes

| Ambiente | Dados | Acesso |
|---|---|---|
| Local | fictícios | dev |
| Preview (por PR) | fictícios, reset semanal | time |
| Staging | fictícios, cópia anonimizada | time + QA |
| Produção | reais | time restrito + suporte auditado |

**Nunca** copiar produção para staging sem anonimizar (nome, CPF, e-mail, telefone, saúde).

## 2. Gestão de segredos

- Segredos em Vercel Environment Variables / Doppler, nunca no repositório.
- Rotação a cada 90 dias para chaves de gateway, WhatsApp e e-mail.
- API keys de gateway **por escola**, criptografadas com KMS e chave derivada por tenant.
- Acesso a segredos de produção: 2 pessoas, com 2FA e log.
- Varredura de segredos no CI (gitleaks) e no pré-commit.

## 3. Backup e continuidade

| Item | Meta |
|---|---|
| RPO (perda máxima aceitável) | 15 minutos (PITR do Postgres) |
| RTO (tempo de restauração) | 4 horas |
| Backup completo | diário, retido 30 dias |
| Backup mensal | retido 12 meses |
| Teste de restauração | trimestral, documentado |
| Storage | versionamento + replicação de região |

Runbook de restauração precisa ser **testado**, não escrito apenas.

## 4. Resposta a incidentes

1. **Detecção** (Sentry, alerta de uso anômalo, denúncia de escola).
2. **Triagem em 24h**: quais dados, quantos titulares, há dado sensível, há menor envolvido.
3. **Contenção**: revogar credencial, bloquear acesso, preservar evidências.
4. **Comunicação à escola** (controlador) em até 24h, com fatos conhecidos.
5. A escola decide sobre ANPD e titulares; a NextGen apoia com relatório técnico.
6. **Pós-incidente**: causa raiz, ação corretiva, atualização de runbook, registro.

**Template de registro:** data/hora, detectado por, sistemas afetados, categorias de dados,
titulares, causa provável, medidas, comunicação realizada, lições.

## 5. Privacidade operacional (DSAR)

Fluxo para pedido do titular:

```
Pedido (portal ou e-mail) → validação de identidade (e vínculo com o aluno)
→ registro no ticket → execução (exportar/corrigir/excluir)
→ revisão de guarda legal → resposta em até 15 dias → log
```

- Exportação em JSON + PDF legível, por aluno.
- Exclusão em cascata com dry-run e relatório do que será mantido por obrigação legal.
- Todo DSAR entra em relatório mensal (quantidade, tipo, prazo médio).

## 6. Suporte e impersonação

- Suporte **não** vê saúde nem dados financeiros completos por padrão.
- Impersonação exige ticket, justificativa, aprovação e expira em 60 minutos.
- Banner permanente "você está vendo como suporte".
- Toda ação durante impersonação é auditada com `actor_role = support`.
- Escola pode revogar acesso de suporte a qualquer momento.

## 7. Onboarding de escola (playbook)

| Etapa | Responsável | Prazo |
|---|---|---|
| Contrato + DPA assinados | comercial | D-7 |
| Escola criada + trial | CS | D0 |
| Branding e unidades | escola | D+1 |
| Importação de alunos | CS + escola | D+3 |
| Treinamento de secretaria (60 min) | CS | D+5 |
| Treinamento de professores (45 min) | CS | D+7 |
| Primeira cobrança em produção | escola | D+10 |
| Revisão de 30 dias | CS | D+30 |

**Kit de onboarding:** vídeos de 2 minutos, checklist em PDF, planilha modelo de importação,
grupo de suporte (adultos da escola, sem alunos).

## 8. Segurança de aplicação — checklist

- [ ] RLS ativa em todas as tabelas de domínio
- [ ] Teste automatizado de isolamento entre tenants
- [ ] Rate limit em login, convite, formulário público e webhook
- [ ] Validação de payload com Zod em toda borda
- [ ] Upload com validação de MIME real (magic bytes) e limite de tamanho
- [ ] URLs assinadas com expiração curta
- [ ] Headers de segurança (CSP, HSTS, X-Frame-Options)
- [ ] Cookies `HttpOnly` + `Secure` + `SameSite`
- [ ] Proteção CSRF em mutações por formulário
- [ ] 2FA para admin e suporte
- [ ] Sanitização de HTML rico (se houver editor)
- [ ] Dependências auditadas (`npm audit`, Dependabot)
- [ ] Logs com redaction de CPF, e-mail, telefone e saúde
- [ ] Pentest antes de vender para rede grande

## 9. Observabilidade de negócio

Alertas que importam mais que CPU:

| Alerta | Gatilho |
|---|---|
| Cobranças não geradas | job diário sem execução até 6h |
| Webhook falhando | > 5 erros em 15 min |
| Sync offline travado | aluno com fila > 24h |
| Convite não aceito | > 30% dos convites em 15 dias |
| Professor sem chamada | turma sem registro há 14 dias |
| Card público órfão | consentimento revogado e card ainda publicado |

## 10. Go-live checklist

- [ ] Contrato, DPA, termos e política publicados
- [ ] RIPD assinado
- [ ] Encarregado nomeado e canal publicado
- [ ] Backup e restauração testados
- [ ] Runbook de incidente impresso/acessível
- [ ] Monitoramento e alertas ativos
- [ ] Teste de carga no site público (campanha de matrícula)
- [ ] Teste ponta a ponta de cobrança em sandbox e em produção com valor real pequeno
- [ ] Treinamento da primeira escola concluído
- [ ] Plano de rollback documentado
