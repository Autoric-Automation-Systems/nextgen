# 15 — Marca e arquivos de imagem

Ativos servidos direto em `/` pelo Next. Tudo abaixo é estático: trocar o arquivo já muda o
site, sem tocar em código.

```
public/
├── brand/          identidade do produto (NextGen)
│   ├── logo.svg           lockup horizontal, fundo claro
│   ├── logo-light.svg     mesmo lockup, fundo escuro
│   ├── mark.svg           só o símbolo (avatar, app icon, cabeçalho estreito)
│   ├── wordmark.svg       só o nome (rodapé, e-mail, assinatura)
│   └── icon.svg           favicon; o Next publica como /icon.svg
├── icons/
│   ├── ui/                ícones de interface (ações, navegação)
│   └── skills/            um por atributo do card, nomeado pelo código
└── dev/            logo do desenvolvedor (Autoric)
    ├── logo-dev.svg       fundo claro
    └── logo-dev-light.svg fundo escuro
```

## Regras

**Nome do arquivo é contrato.** `apps/web/lib/brand.ts` referencia estes caminhos. Renomear
quebra o site; substituir o conteúdo não quebra nada. Se precisar de outro nome, adicione ao
manifesto — não espalhe o caminho pelo código.

**Assinatura visual.** Os SVGs atuais são esboços funcionais (`<!-- PLACEHOLDER -->` no
arquivo). Substitua pelo oficial mantendo nome e proporção: a altura é definida pelo
componente, então um logo com proporção muito diferente fica esticado.

**SVG primeiro, raster depois.** SVG escala sem borrar e pesa poucos KB. Use PNG só se o
original não existir em vetor, e nesse caso gere em `@2x` (ex.: `logo@2x.png`) mantendo o
PNG base com o nome do SVG que ele substitui.

**Cores vêm dos tokens.** Os arquivos usam as cores fixas `#10331f` (verde profundo) e
`#c9f24d` (lima), porque SVG carregado por `<img>` não enxerga variável CSS. Se a paleta da
escola mudar em `globals.css`, os logos precisam ser regerados.

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
| desenho da marca | `apps/web/components/brand-logo.tsx` | escolhe variante e superfície, nada mais |
| assinatura do dev | `apps/web/components/site-footer.tsx` | rodapé com link para a Autoric |
| ícone de atributo | `apps/web/components/skill-icon.tsx` | usa o arquivo se existir, senão o código |

Para trocar o logo: substitua o arquivo. Para trocar de nome ou acrescentar uma variante:
edite `brand.ts` — os componentes não precisam saber. `lib/brand.test.ts` falha se um
caminho do manifesto apontar para arquivo inexistente, então um rename não passa no CI.

## Onde não colocar arquivo

Conteúdo do usuário (foto de aluno, logo da escola, anexo de aula) **não** entra aqui: este
diretório é versionado no git e público. Esses arquivos vão para o Blob privado, com URL
assinada e controle de acesso por escola. Aqui só vive a identidade do produto.
