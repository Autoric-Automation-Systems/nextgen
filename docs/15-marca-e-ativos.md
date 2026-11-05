# 15 — Marca e arquivos de imagem

Ativos servidos direto em `/` pelo Next. Tudo abaixo é estático: trocar o arquivo já muda o
site, sem tocar em código.

```
public/
├── brand/
│   ├── mark.png           símbolo oficial, largura 192px
│   └── mark@2x.png        mesmo símbolo, largura 384px
├── icons/
│   ├── ui/                ícones de interface (ações, navegação)
│   └── skills/            um por atributo do card, nomeado pelo código
├── dev/                   logo do desenvolvedor (Autoric)
│   ├── logo-dev.svg       fundo claro
│   └── logo-dev-light.svg fundo escuro
├── favicon.ico            pedido pelo navegador mesmo sem <link>
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png   fundo opaco: o iOS pinta preto atrás de PNG transparente
├── android-chrome-192x192.png
├── android-chrome-512x512.png
└── site.webmanifest       nome, cor de tema e os dois ícones de instalação
```

## Regras

**Nome do arquivo é contrato.** `apps/web/lib/brand.ts` referencia estes caminhos. Renomear
quebra o site; substituir o conteúdo não quebra nada. Se precisar de outro nome, adicione ao
manifesto — não espalhe o caminho pelo código.

**A marca é símbolo + texto.** Só o símbolo é imagem. O nome "NextGen" é renderizado como
texto em `components/brand-logo.tsx`, então acompanha a fonte da interface, não borra ao
ampliar e não precisa de uma versão por densidade.

**SVG primeiro, raster quando não houver vetor.** O símbolo chegou como PNG; ele é o único
ativo raster do produto. O arquivo base foi recortado do ícone de 512px (sem a margem
transparente) e reduzido para 192px de largura; o `@2x` tem 384px. Se o vetor aparecer,
basta salvar `mark.svg`, apontar `MARK` para ele em `brand.ts` e apagar os PNGs — nenhum
componente muda.

**O favicon não é o card.** Os tamanhos 16 e 32 são gerados do mesmo arquivo mestre; como o
símbolo é largo, nos tamanhos pequenos ele fica com pouca margem. Se a marca mudar, gere o
pacote de novo a partir do vetor.

**Cores.** O símbolo usa as cores do arquivo original (azul `#0e305b` e verde `#80b235`),
porque imagem carregada por `<img>` não enxerga variável CSS. Os tokens de interface
(`--brand`, `--accent` em `globals.css`) ainda são os do esboço: unificar as duas paletas é
uma decisão de marca, não um ajuste de código.

## Ícones de habilidade

`icons/skills/<CÓDIGO>.svg`, em maiúsculas, com o código do atributo: `CTL.svg`, `PAS.svg`,
`DEF.svg`. Se o arquivo não existir, a interface mostra o código em texto — nada quebra, e
dá para subir os ícones um a um. Lista de códigos em `docs/08-avaliacao-e-card.md`.

## Logo do desenvolvedor

Aparece no rodapé, ligado a `https://www.autoric.com.br`. O vínculo é declarado em
`DEV_CREDIT` (`apps/web/lib/brand.ts`) — o endereço não é digitado em cada rodapé.

## Como o código consome

| Peça | Onde | Responsabilidade |
|---|---|---|
| caminhos e proporções | `apps/web/lib/brand.ts` | único lugar que sabe o nome de um arquivo |
| marca (símbolo + nome) | `apps/web/components/brand-logo.tsx` | escolhe variante e desenha |
| favicon e manifest | `apps/web/app/layout.tsx` | publica `metadata.icons` e `viewport.themeColor` |
| assinatura do dev | `apps/web/components/site-footer.tsx` | rodapé com link para a Autoric |
| ícone de atributo | `apps/web/components/skill-icon.tsx` | usa o arquivo se existir, senão o código |

Para trocar o logo: substitua o arquivo. Para trocar de nome ou acrescentar uma variante:
edite `brand.ts` — os componentes não precisam saber. `lib/brand.test.ts` falha se um
caminho do manifesto apontar para arquivo inexistente, então um rename não passa no CI.

## Onde não colocar arquivo

Conteúdo do usuário (foto de aluno, logo da escola, anexo de aula) **não** entra aqui: este
diretório é versionado no git e público. Esses arquivos vão para o Blob privado, com URL
assinada e controle de acesso por escola. Aqui só vive a identidade do produto.
