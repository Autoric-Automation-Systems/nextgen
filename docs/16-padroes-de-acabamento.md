# 16 — Padrões de acabamento: tela, texto e e-mail

Regra de trabalho deste produto: **cada tela é construída como uma marca grande constrói** —
com estado vazio desenhado, erro que diz o que fazer, hierarquia tipográfica, contraste
verificado e e-mail que abre em qualquer cliente. Não é preferência estética; é o que separa
"protótipo que funciona" de "software que alguém paga sem pedir desconto".

O padrão vem de literatura publicada, não de gosto pessoal. Quando houver dúvida, a resposta
está em uma destas fontes:

| Fonte | O que ela decide aqui |
|---|---|
| **WCAG 2.2 AA** (W3C) | contraste mínimo 4,5:1 em texto e 3:1 em ícone/limite; foco visível; alvo de toque ≥ 24px; nada de informação só por cor; respeitar `prefers-reduced-motion` |
| **WAI-ARIA Authoring Practices** | comportamento de diálogo, aba, combobox e menu; rótulo acessível em botão de ícone; `aria-live` para resultado de ação assíncrona |
| **Apple HIG / Material 3** | hierarquia (um título por tela, um CTA primário), escala de espaçamento, estados de toque e de carregamento |
| **10 heurísticas de Nielsen** | feedback imediato, consistência, prevenção de erro, reconhecer em vez de lembrar, mensagem de erro em linguagem humana |
| **GOV.UK Design System + content design** | frase curta, assunto na frente, sentence case, verbo no início da instrução |
| **Guias de e-mail transacional** (Litmus, Really Good Emails, Can I Email) | layout de 600px em tabela, estilo inline, preheader, versão em texto, botão e link por extenso |
| **OWASP ASVS / cheat sheets** | mensagem de erro não revela se a conta existe, nem dado de outra pessoa |

## Toda tela tem quatro estados

Escrever a tela "cheia" é metade do trabalho. As outras três são o que o usuário vê no
primeiro dia:

1. **Vazio** — diz o que fazer agora, com o link para a ação. Nunca "Nenhum resultado".
2. **Carregando** — esqueleto ou texto, nunca área em branco que parece quebrada.
3. **Erro** — o que aconteceu, o que fazer, e o canal de contato se persistir.
4. **Sem permissão** — explica o motivo e mostra o caminho de volta; não devolve 404 genérico.

## Microcopy em português

- Sentence case em título, botão e etiqueta. CAIXA ALTA só em sigla.
- Botão diz o que faz: "Enviar link de acesso", não "Enviar" nem "OK".
- Erro aponta a correção: "Informe um e-mail com @", não "E-mail inválido".
- Sem emoji em assunto de e-mail e sem exclamação em mensagem de sistema.
- Nunca prometer o que a tela não entrega: o que não existe leva a marca "em breve" e não
  aparece como link clicável (`apps/web/lib/nav.ts`).
- Tratamento por "você"; a escola é "a escola", o aluno é "o aluno".

## E-mail transacional

O e-mail é a única tela que ninguém abre no navegador antes do cliente. O padrão está em
`packages/auth/src/magic-link-email.ts` e deve ser seguido por qualquer e-mail novo:

- **Tabela + estilo inline.** Gmail, Outlook e Apple Mail descartam parte do `<style>`,
  `flex` e `grid`. `role="presentation"` e `style` em cada célula é o denominador comum.
- **600px de largura máxima**, uma coluna, fundo claro, cartão branco.
- **Link duas vezes:** botão e o endereço por extenso em caixa monoespaçada. Cliente
  corporativo abre link em navegador interno e o botão morre sem aviso.
- **Prévia (preheader) escondida**: é o texto que aparece ao lado do assunto na caixa de
  entrada e decide se o e-mail é aberto.
- **Versão em texto sempre.** É o que leitor de tela, relógio e filtro antispam leem.
- **Sem imagem como conteúdo.** Se o cliente bloquear imagens (padrão no Outlook), a
  mensagem continua completa — logo é enfeite, com `alt` e largura/altura declaradas.
- **Sem gradiente, sem `background-image`, sem filtro CSS.** Não renderizam.
- **Assunto curto, sem emoji, sem dado pessoal.**
- **Um aviso de segurança** quando a mensagem dá acesso: "se não foi você, ignore".
- **Prévia obrigatória em `/sistema/email`** antes de anunciar mudança de e-mail.

## Casca fixa: cabeçalho, menu e rodapé parados

Dentro do produto, as três âncoras ficam na tela e **só o miolo rola**: cabeçalho no topo,
menu à esquerda (ou no topo do miolo), rodapé embaixo. É o que a pessoa espera de um sistema
em que ela navega o dia inteiro — perder o menu ao rolar é perder o mapa.

Mecanismo, em `apps/web/app/globals.css`:

| Regra | Por quê |
|---|---|
| `body { height: 100dvh; display: flex; flex-direction: column; overflow: hidden }` | a página não cresce; crescer é o que faz o documento inteiro rolar |
| `body > main { flex: 1; min-height: 0; overflow-y: auto }` | o miolo é o único scroll |
| `.shell { flex: 1; min-height: 0; overflow: hidden }` + `.shell-side`/`.shell-content` com scroll próprio | menu e miolo administram o próprio scroll; menu longo não empurra o conteúdo |
| `scrollbar-gutter: stable` | a barra não aparece/desaparece entre telas curtas e longas, então nada desliza 8px ao navegar |
| `overscroll-behavior: contain` | rolar até o fim do miolo não "puxa" a página inteira (e não arranca o usuário do contexto no trackpad) |

Três armadilhas que este desenho evita:

- **`position: fixed`** exige compensar com `padding` no conteúdo e quebra quando a altura da
  barra muda (fonte maior, aviso do navegador). Altura de viewport com `flex` não tem esse
  acoplamento.
- **`min-height: 0`** no filho flex é obrigatório. Sem ele o item não encolhe abaixo do
  conteúdo e o `overflow` nunca dispara — o sintoma é "a página toda rola mesmo com a regra
  aplicada".
- **O `.wrap` não pode ser o contêiner que rola.** Se `main` tem `max-width`, a barra de
  rolagem nasce no meio da tela. Estrutura correta: `<main>` ocupa a largura toda e o
  `.wrap` (1080px) fica dentro.

No celular (≤ 820px) a regra é **suspensa de propósito**: altura de tela é o recurso
escasso, e menu + rodapé parados deixariam menos da metade para o conteúdo. Em impressão,
tudo volta ao fluxo normal.

## Celular: três decisões que fazem a tela caber

O layout de celular não é o de desktop encolhido. Em `globals.css`:

| Até | O que muda | Por quê |
|---|---|---|
| 820px | menu lateral vira **gaveta** fora da tela, aberta pelo botão do topo | oito itens em coluna empurravam o conteúdo para fora da primeira tela; a gaveta devolve a dobra ao conteúdo e mantém a hierarquia de seções |
| 820px | a barra de aviso some e sobra só menu, nome da escola e saída | 40px de aviso repetido custam mais que o aviso |
| 420px | o e-mail da conta sai da barra e passa para o pé da gaveta | em 320px ele truncava o nome da escola, que é o contexto |
| 700px | `.table-cards`: `thead` oculto, cada `tr` vira cartão com rótulo por `td::before` e `data-label` | tabela de 620px em tela de 390px escondia valor e ações atrás de rolagem lateral |
| 700px | ações do cartão em duas colunas | cinco botões empilhados faziam um cartão de 400px |
| 620px | títulos 30px, indicadores em duas colunas, `.row` quebra linha | cinco cartões de métrica empilhavam por mais de uma tela |
| 820px | campos com `font-size: 16px` | abaixo disso o iOS dá zoom ao focar |

Regra para tabela nova: marcar o contêiner com `table-cards`, pôr `data-label` em cada `td`
que tem cabeçalho, e `className="cell-actions"` na última célula quando ela tem botões. Sem
`data-label` a célula aparece sem rótulo no celular — e sem rótulo o número não significa nada.

O cabeçalho do site público continua `sticky`. No painel, a barra do topo também: é ela que
carrega o botão da gaveta — sem ela parada, o menu fica inalcançável no meio de uma lista
longa.

### Gaveta do menu: o que ela precisa cumprir

`apps/web/components/app-shell.tsx` guarda o estado porque o botão (barra do topo) e a
gaveta (`aside`) são irmãos — sem ancestral comum, um não alcança o outro.

| Regra | Por quê |
|---|---|
| `aria-expanded` no botão e `aria-controls` apontando para o `aside` | é um *disclosure*: o leitor de tela anuncia aberto/fechado e para onde o botão leva |
| fecha ao navegar (`usePathname`), no Esc e no toque no véu | menu aberto sobre a tela nova é o defeito clássico de gaveta |
| foco vai para o botão fechar ao abrir e volta ao botão menu ao fechar | quem usa teclado não pode começar o Tab no topo do documento |
| `inert` no miolo enquanto aberta | o Tab não entra em conteúdo coberto pelo véu |
| `visibility: hidden` na gaveta fechada | `transform` sozinho deixa os links focáveis fora da tela |
| `body { overflow: hidden }` enquanto aberta | rolar atrás da gaveta embaralha a posição de retorno |
| largura `min(84vw, 296px)` | sobra uma faixa do conteúdo à vista, que é o que indica que dá para fechar tocando fora |
| fecha ao passar de 820px (`matchMedia`) | girar o celular devolveria a coluna do desktop com o miolo `inert` |

Contra o teclado: `Esc` fecha, `Tab` não escapa para o conteúdo, e nenhum link fica focável
com a gaveta fechada.

### Menu recolhido no desktop

Acima de 820px a coluna de 236px vira uma rail de 72px: só ícones, sem nome da escola e sem
título de seção. O botão que alterna mora na barra do topo, ao lado do menu que ele recolhe.

| Regra | Por quê |
|---|---|
| estado em `data-nav-collapsed`, preferência em `localStorage` | a escolha é do operador, não da sessão: quem trabalha em tela pequena recolhe uma vez e continua recolhido |
| preferência lida em `useEffect`, nunca no render | o servidor não vê o `localStorage`; ler no render daria diferença de markup a cada navegação |
| rótulo escondido por recorte (`clip`), não por `display: none` | no modo recolhido o ícone é o único sinal visual, então o nome acessível tem de continuar no HTML |
| linha divisória entre grupos quando os títulos somem | sem `sidebar-title`, os ícones de "Escola" e "Ajuda" ficam numa pilha só |
| `aria-expanded` no botão | o botão descreve o menu, não a si mesmo |

Como validar (mede, não confia no olho): com a página longa aberta, `window.scrollY` tem de
continuar `0`, `Math.round(document.scrollingElement.scrollHeight) === innerHeight`, e
`footer.getBoundingClientRect().bottom` tem de bater com a altura da janela depois de rolar
o miolo.

## Escala visual

Não inventar valor novo: os tokens estão em `apps/web/app/globals.css`.

| Token | Valor | Uso |
|---|---|---|
| espaçamento | múltiplos de 4 | 8 entre linhas, 16 dentro de bloco, 24–32 entre blocos |
| raio | 10, 12, 14, 18 | campo, botão, cartão, capa |
| título de página | 28px / 700 | um por tela |
| corpo | 14–16px / 1,6 | nunca abaixo de 13px em texto corrido |
| `--brand` | `#10331f` | ação primária e texto de marca |
| `--accent` | `#c9f24d` | destaque e CTA sobre verde — não sobre branco (contraste) |

## Marca

- Símbolo com área de respiro igual a um quarto da altura; nunca distorcido, nunca com
  sombra, nunca dentro de forma que corte a ponta.
- Nome "NextGen" é **texto**, não imagem (`components/brand-logo.tsx`).
- Logo do desenvolvedor com altura mínima de 34px, porque abaixo disso a linha de
  assinatura some. Ver `docs/15-marca-e-ativos.md`.
- Ilustração para criança em vitrine; foto de aluno real só com consentimento de imagem.

## Como validar antes de dizer "pronto"

```bash
pnpm typecheck && pnpm test            # regra e contraste de lógica
pnpm dev                               # /, /login, /dashboard, /sistema/card, /sistema/email
```

- Abrir a tela com zoom 200% e navegar só pelo teclado.
- Em 390px: `document.documentElement.scrollWidth === innerWidth` (sem rolagem lateral) e a
  faixa de seções tem de continuar no topo depois de rolar (`getBoundingClientRect().top === 0`).
- Conferir o estado vazio de cada lista nova.
- Conferir o e-mail em `/sistema/email` e, quando possível, no cliente real.
