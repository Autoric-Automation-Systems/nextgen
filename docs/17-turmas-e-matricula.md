# 17 — Turmas e matrícula (fase 1, primeira entrega)

Este documento registra o que foi construído em `/turmas`, por que cada regra existe e o que
ficou de fora. Complementa o modelo de dados ([05](05-modelo-dados.md)) e a fase 1 do
[roadmap](09-roadmap.md); não repete o que já está lá.

## 1. A hierarquia

```
class_group (turma)   nome livre + unidade, sala, dias, horário, capacidade
└── enrollment        aluno × turma × situação
```

Cada nível tem um motivo:

| Nível | Por que separado |
|---|---|
| **turma** | é o que a escola vende e o que o responsável contrata: "Sub-8 — Ter/Qui 17h". O nome é livre, escrito pela escola, porque a grade real varia (turma por idade, por nível, por bairro, por horário) |
| **matrícula** | o vínculo do aluno com a turma **naquele período**. Encerrar não apaga: preenche `ends_on` |

**Por que não existem mais categoria e temporada.** Modelar `season → category → class_group`
obrigava a escola a manter uma grade anual antes de abrir a primeira turma, e a "regra de idade"
no banco brigava com a operação real: escola junta duas idades por falta de professor, aceita um
aluno mais novo por avaliação, renomeia "Sub-8" para "Iniciação". A idade continua sendo dado do
aluno (`birth_date`) e aparece derivada no card e nos relatórios; o agrupamento pedagógico passa
a ser o nome da turma, que a escola escolhe. Quem quiser sinalizar idade no nome escreve
"Sub-8 — Ter/Qui 17h" e tem o mesmo efeito sem schema novo.

O que se perdeu: promoção automática de categoria na virada de ano. A troca de turma no fim do
ciclo é uma ação da secretaria (encerrar a matrícula e criar outra), o que também deixa rastro
em `audit_log` — melhor do que uma reclassificação silenciosa.

## 1.1 Quem entra na turma

A vaga é da turma (`capacity`), contada por matrículas `active`. Matrícula em `draft` **não**
ocupa vaga; `waitlist` guarda a ordem de chegada. A sala (`room`) é informativa — duas turmas no
mesmo horário na mesma sala é conflito que a escola resolve, não o sistema.

## 2. Situações da matrícula

```mermaid
stateDiagram-v2
    [*] --> draft: sem termo do responsável
    [*] --> active: vaga + termo em dia
    [*] --> waitlist: turma cheia
    draft --> active: termo assinado
    waitlist --> active: abriu vaga e termo ok
    waitlist --> draft: abriu vaga, termo pendente
    active --> cancelled: encerrada (fim do período)
    draft --> cancelled: desistência antes do termo
```

- **rascunho** existe porque a secretaria matricula antes de o responsável assinar. Nada é
  liberado ao responsável e o aluno **não ocupa vaga**.
- **lista de espera** guarda a ordem de chegada (`waitlist_position`). Chamar exige vaga livre.
- **cancelada** mantém `starts_on`/`ends_on`: o histórico de quem esteve na turma é dado
  pedagógico e financeiro.

## 3. A ordem das checagens (e por que essa ordem)

`decideEnrollment` (`packages/core/src/class-group.ts`) é pura e testada; a action só consulta o
banco e obedece. A ordem importa:

| # | Checagem | Resultado | Por que antes das outras |
|---|---|---|---|
| 1 | já existe matrícula na turma | bloqueia | evita duplicar aluno na chamada |
| 2 | consentimento **revogado** | bloqueia | revogação é ato do responsável; nada a contorna |
| 3 | outra turma ativa | bloqueia (com exceção) | evita cobrança dupla e duas chamadas |
| 4 | turma lotada | lista de espera | lotação **não** é bloqueio; é fila |
| 6 | consentimento ausente | rascunho | a vaga já foi decidida; falta o termo |

Duas consequências deliberadas:

- **Lotação vence termo pendente.** Sem vaga, não há o que ativar depois: o lugar é da fila.
- **Revogação vence tudo.** Quem revogou não entra nem na fila.

## 4. Exceção com motivo, nunca silenciosa

"Uma turma ativa por aluno" aceita exceção — atleta que treina no Sub-8 de terça e no Sub-11 de
sábado. A exceção exige texto em `override_reason` (≥ 10 caracteres), vai para `audit_log` e
aparece na linha da turma.

**Exceção não fura lotação.** Quem autoriza a segunda turma não compra vaga: se a turma está
cheia, a matrícula com exceção entra na fila como qualquer outra. O primeiro código desta entrega fazia
o contrário; o teste de UI mostrou a turma passando de 1/1 para 2/1.

Consentimento revogado, duplicidade e dados inválidos **não** têm exceção — não é decisão da
escola.

## 5. O que a tela mostra

`/turmas` — tabela de turmas com horário, sala, ocupação e professores, mais o cadastro de aluno
logo acima (a secretaria abre turma e matricula no mesmo lugar). Formulário em `<details>`:
"Abrir turma" (nome livre, unidade, sala, dias, horário, capacidade, professores).

`/turmas/[id]` — cabeçalho da turma, três números (matriculados, vagas, lista de espera), painel
de professores, matrícula e a lista da turma com consentimento por aluno.

Regras de acabamento aplicadas ([16](16-padroes-de-acabamento.md)):

- **vazio** diz o próximo passo ("Cadastre uma unidade antes de abrir turma");
- **erro** diz a correção ("Choque de horário com Sub-9 — Sáb 9h. Troque o horário ou a sala");
- **sem permissão** explica e oferece caminho, em vez de 404;
- ação que remove a própria linha avisa por `?aviso=`, porque o componente que mostraria o
  resultado desaparece junto com a linha;
- tabela rola dentro do card no celular (`.table-scroll`): esconder coluna no mobile é perder
  dado de aluno.

## 6. Permissões

| Papel | Vê | Cria/edita |
|---|---|---|
| admin | todas as turmas | turma, matrícula, aluno, professor |
| coordenação | todas as turmas | turma, matrícula |
| professor | **só as turmas dele** | nada (leitura) |
| responsável | nada em `/turmas` | — |

O filtro do professor é explícito no `where` (`teachers: { some: { userId } }`); a RLS isola a
escola, não o papel. O responsável é barrado na página, com mensagem: a RLS escolar não impede
que ele leia a turma inteira, e turma inteira é nome de outras crianças.

## 7. Auditoria

Toda escrita grava `audit_log`: `season.create`, `category.create`, `class_group.create`,
`enrollment.create`, `enrollment.end`, `enrollment.activate`, `class_group.teacher.assign`,
`class_group.teacher.remove` — com `before`/`after` e o motivo da exceção quando houver.

## 8. Fora desta entrega

- Chamada e reposição de aula (depende da turma, entra na sequência).
- Plano de aula por turma.
- Cobrança da matrícula (a competência nasce daqui, mas o financeiro é o próximo bloco).
- Conflito de **professor** em duas turmas no mesmo horário — hoje só checamos sala.
- Transferência de turma com histórico (hoje: encerra e matricula de novo).
- Edição e arquivamento de turma pela tela (o modelo já tem `is_active` e `deleted_at`).
