# Site Alves Penello

Site estático do Alves Penello Advocacia e Consultoria. HTML, CSS e JavaScript puros, sem framework.

## Como montar

Precisa só do Python 3.

```bash
python build.py
```

O resultado fica em `dist/`. Para ver no navegador:

```bash
python -m http.server 8080 --directory dist
```

`python build.py --offline` monta sem acessar a internet, usando os artigos salvos em `src/content/posts.json`.

## Onde mexer

| O quê | Onde |
| --- | --- |
| Telefone, e-mail, endereço, OAB, Instagram, GA4, Clarity | bloco `CFG` no começo de `build.py` |
| Textos de cada página | `src/pages/*.html` |
| Cabeçalho, rodapé e menu | função `layout` em `build.py` |
| Cores, fontes e espaçamentos (tokens do manual de marca) | `src/assets/css/style.css`, bloco `:root` |
| Regras das calculadoras | `src/assets/js/calc.js` |
| Fotos e logos | `src/assets/img` e `src/assets/brand` |

Depois de qualquer alteração, rode `python build.py` de novo e publique a pasta `dist/`.

## Blog

Os artigos são escritos no WordPress.com do escritório, como hoje. O build baixa os artigos e gera uma página para cada um em `/blog/<slug>/`, com o visual do site.

Um artigo publicado depois do último build aparece na lista na hora, carregado pelo navegador, e abre em `/blog/artigo/?p=<slug>`. No build seguinte ele ganha a página própria. Vale rodar o build sempre que sair artigo novo, ou agendar isso na hospedagem.

O site usa o ID numérico do blog (`wp_site` em `CFG`), então a integração continua funcionando quando o domínio `alvespenello.com` passar a apontar para o site novo. O painel do WordPress segue acessível em wordpress.com.

Os seis artigos de demonstração do tema (em inglês) estão listados em `blog_ignorar` e não entram no site.

## Publicação

Publique o conteúdo de `dist/` na raiz do domínio. Os endereços usam caminhos absolutos (`/assets/...`), então o site não funciona dentro de uma subpasta. Configure `404.html` como página de erro na hospedagem.
