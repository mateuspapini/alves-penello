#!/usr/bin/env python3
"""Gera o site estático do Alves Penello em ./dist

Uso:
    python build.py            monta o site (busca os artigos do blog; se falhar, usa o cache)
    python build.py --offline  monta sem acessar a internet (usa src/content/posts.json)

Só precisa do Python 3. Para ver o resultado:
    python -m http.server 8080 --directory dist
"""
import html
import json
import re
import shutil
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

# ----------------------------------------------------------------------------
# Dados do escritório. Altere aqui e rode o build de novo.
# ----------------------------------------------------------------------------
CFG = {
    "url": "https://alvespenello.com",
    "nome": "Alves Penello Advocacia e Consultoria",
    "razao": "Bruno Penello Sociedade Individual de Advocacia",
    "cnpj": "49.168.161/0001-88",
    "oab": "",  # ex.: "OAB/MG 000.000" (número de inscrição, a confirmar com o escritório)
    "whatsapp": "5531992164306",
    "telefone": "(31) 99216-4306",
    "email": "contato@alvespenelloadv.com",
    "endereco": "Av. Raja Gabaglia, 2000, Bloco 1, 7º andar, Sala 738",
    "bairro": "Estoril, Belo Horizonte/MG",
    "mapa": "https://www.google.com/maps/search/?api=1&query=Av.+Raja+Gabaglia+2000+Belo+Horizonte+MG",
    "instagram": "alvespenello.adv",
    # Blog: ID numérico do site no WordPress.com. O ID continua valendo
    # mesmo que o domínio alvespenello.com passe a apontar para este site.
    "wp_site": "231345239",
    # Artigos de demonstração do tema do WordPress (em inglês). Ficam fora do site
    # até serem apagados no painel do WordPress.
    "blog_ignorar": ["adaptive-advantage", "beyond-the-obstacle", "collaboration-magic",
                     "growth-unlocked", "teamwork-triumphs", "the-art-of-connection"],
    "ga4": "",      # ex.: "G-XXXXXXXXXX"
    "clarity": "",  # ID do projeto no Microsoft Clarity
}

WA_PADRAO = "Olá! Vim pelo site e gostaria de falar com o escritório."

NAV = [
    ("escritorio", "/escritorio/", "O escritório"),
    ("empresas", "/empresas/", "Empresas"),
    ("pessoas", "/pessoas-fisicas/", "Pessoas físicas"),
    ("calculadoras", "/calculadoras/", "Calculadoras"),
    ("blog", "/blog/", "Blog"),
    ("contato", "/contato/", "Contato"),
]

# Ícones lineares, traço de 1,5 px (manual de marca, seção 05)
_S = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
ICONS = {
    "seta": _S + '<path d="M4 12h16M14 6l6 6-6 6"/></svg>',
    "mais": _S + '<path d="M12 5v14M5 12h14"/></svg>',
    "whatsapp": _S + '<path d="M3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 8.1 19.2z"/><path d="M9.2 8.3c-.6 1 .1 2.9 1.7 4.6s3.6 2.5 4.7 1.9l.5-1.3-2-1.1-.9.8c-.9-.4-1.7-1.2-2.1-2.1l.8-.9-1.1-2z"/></svg>',
    "email": _S + '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>',
    "pin": _S + '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    "relogio": _S + '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    "instagram": _S + '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><circle cx="16.6" cy="7.4" r=".4" fill="currentColor"/></svg>',
}

# largura x altura da versão maior de cada foto (para reservar espaço e evitar salto de layout)
IMG = {
    "hero": (1280, 1920), "aline": (1280, 1920), "bruno": (1280, 1920),
    "socios-sala": (1280, 1920), "socios-vista": (1280, 1920), "socios-janela": (1280, 1920),
    "horizonte": (1280, 1920), "socios-amplo": (1280, 853), "socios-formal": (1280, 853),
    "socios-retrato": (1280, 853), "conversa": (1280, 853), "predio": (1200, 1600),
}

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
         "agosto", "setembro", "outubro", "novembro", "dezembro"]


def esc(s):
    return html.escape(str(s), quote=True)


def wa_link(msg=WA_PADRAO):
    return "https://wa.me/" + CFG["whatsapp"] + "?text=" + urllib.parse.quote(msg)


# ----------------------------------------------------------------------------
# Macros usadas nas páginas:  {{icon:seta}}  {{img:nome|alt|sizes|eager}}
#                             {{wa:local|mensagem opcional}}  {{cta:título|texto}}
# ----------------------------------------------------------------------------
def m_img(arg):
    p = [x.strip() for x in arg.split("|")]
    name, alt = p[0], (p[1] if len(p) > 1 else "")
    sizes = p[2] if len(p) > 2 and p[2] else "(max-width: 900px) 100vw, 50vw"
    eager = len(p) > 3 and p[3] == "eager"
    w, h = IMG[name]
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (f'<img src="/assets/img/{name}-1280.webp" srcset="/assets/img/{name}-640.webp 640w, '
            f'/assets/img/{name}-1280.webp {w}w" sizes="{sizes}" width="{w}" height="{h}" '
            f'alt="{esc(alt)}" {load} decoding="async">')


def m_wa(arg):
    p = arg.split("|", 1)
    msg = p[1].strip() if len(p) > 1 and p[1].strip() else WA_PADRAO
    return f'href="{esc(wa_link(msg))}" target="_blank" rel="noopener" data-wa="{esc(p[0].strip())}"'


def m_cta(arg):
    p = [x.strip() for x in arg.split("|")] if arg else []
    titulo = p[0] if p and p[0] else "Conte o que está acontecendo."
    texto = p[1] if len(p) > 1 else "Vamos olhar o seu caso com calma e explicar cada passo."
    return f'''<section class="sec sec--pedra fecho">
  <div class="wrap fecho__grid">
    <div class="linha rv">
      <p class="rotulo">Contato</p>
      <h2>{titulo}</h2>
      <p class="lead">{texto}</p>
    </div>
    <div class="fecho__acoes rv">
      <a class="btn" {m_wa("fecho")}>{ICONS["whatsapp"]}Fale pelo WhatsApp</a>
      <a class="btn btn--sec" href="/contato/">Outros contatos</a>
    </div>
  </div>
</section>'''


def expand(body):
    body = re.sub(r"\{\{cta(?::([^}]*))?\}\}", lambda m: m_cta(m.group(1) or ""), body)
    body = re.sub(r"\{\{img:([^}]+)\}\}", lambda m: m_img(m.group(1)), body)
    body = re.sub(r"\{\{wa:([^}]+)\}\}", lambda m: m_wa(m.group(1)), body)
    body = re.sub(r"\{\{icon:(\w+)\}\}", lambda m: ICONS[m.group(1)], body)
    for k, v in CFG.items():
        if isinstance(v, str):
            body = body.replace("{{" + k + "}}", esc(v))
    return body


# ----------------------------------------------------------------------------
# Moldura da página
# ----------------------------------------------------------------------------
def layout(meta, body):
    path = meta["path"]
    title = meta["title"]
    desc = meta.get("description", "")
    canonical = CFG["url"] + path
    atual = ' aria-current="page"'
    nav = "".join(
        f'<li><a href="{href}"{atual if meta.get("nav") == key else ""}>{label}</a></li>'
        for key, href, label in NAV)
    scripts = "".join(f'<script src="/assets/js/{s.strip()}.js" defer></script>\n'
                      for s in meta.get("scripts", "").split(",") if s.strip())
    oab = f' · {esc(CFG["oab"])}' if CFG["oab"] else ""
    robots = meta.get("robots", "index,follow")
    cfg_js = json.dumps({k: CFG[k] for k in ("whatsapp", "wp_site", "blog_ignorar", "ga4", "clarity")})
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="{meta.get("og_type", "website")}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="{esc(CFG["nome"])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{CFG["url"]}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F6F3EE">
<link rel="icon" href="/assets/brand/favicon-48.png" sizes="48x48">
<link rel="icon" href="/assets/brand/icon-512.png" sizes="512x512">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/cormorant-garamond.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/montserrat.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/style.css">
<script>document.documentElement.className="js";window.AP={cfg_js};</script>
{meta.get("head", "")}
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo" id="topo">
  <div class="wrap topo__in">
    <a class="marca" href="/" aria-label="Alves Penello Advocacia e Consultoria, página inicial">
      <img src="/assets/brand/ap-monograma-grafite.png" alt="" width="475" height="456">
      <span class="marca__nome">Alves<br>Penello</span>
    </a>
    <nav class="menu" id="menu" aria-label="Principal">
      <ul>{nav}</ul>
      <a class="btn menu__cta" {m_wa("menu")}>{ICONS["whatsapp"]}Fale com o escritório</a>
    </nav>
    <button class="burger" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
  </div>
</header>
<main id="conteudo">
{body}
</main>
<footer class="rodape">
  <div class="wrap">
    <div class="rodape__grid">
      <div class="rodape__marca">
        <img src="/assets/brand/ap-horizontal-branco.png" alt="Alves Penello Advocacia e Consultoria" width="1493" height="800" loading="lazy">
        <p>Direito imobiliário e empresarial em Belo Horizonte, com atendimento em todo o Brasil.</p>
      </div>
      <div>
        <h2 class="rodape__h">Navegação</h2>
        <ul>
          <li><a href="/">Início</a></li>
          {"".join(f'<li><a href="{h}">{l}</a></li>' for _, h, l in NAV)}
        </ul>
      </div>
      <div>
        <h2 class="rodape__h">Calculadoras</h2>
        <ul>
          <li><a href="/calculadoras/rescisao-de-aluguel/">Rescisão de aluguel</a></li>
          <li><a href="/calculadoras/imovel-na-planta/">Imóvel na planta</a></li>
        </ul>
        <h2 class="rodape__h rodape__h--2">Redes</h2>
        <ul>
          <li><a href="https://www.instagram.com/{CFG["instagram"]}/" target="_blank" rel="noopener">Instagram @{CFG["instagram"]}</a></li>
        </ul>
      </div>
      <div>
        <h2 class="rodape__h">Contato</h2>
        <ul>
          <li><a {m_wa("rodape")}>WhatsApp {CFG["telefone"]}</a></li>
          <li><a href="mailto:{CFG["email"]}">{CFG["email"]}</a></li>
          <li><a href="{esc(CFG["mapa"])}" target="_blank" rel="noopener">{CFG["endereco"]}<br>{CFG["bairro"]}</a></li>
        </ul>
      </div>
    </div>
    <div class="rodape__fim">
      <p>© {date.today().year} {CFG["nome"]} · {CFG["razao"]} · CNPJ {CFG["cnpj"]}{oab}</p>
      <p>Conteúdo de caráter informativo, conforme o Provimento 205/2021 da OAB.</p>
      <p><a href="/privacidade/">Privacidade e termos</a> · <a href="/privacidade/#cookies" data-cookies>Cookies</a> · <a href="https://mapasolucoesdigitais.com.br/" target="_blank" rel="noopener">Site por MAPA Soluções Digitais</a></p>
    </div>
  </div>
</footer>
<a class="zap" {m_wa("flutuante")} aria-label="Conversar pelo WhatsApp">{ICONS["whatsapp"]}</a>
<div class="consent" role="dialog" aria-label="Preferências de cookies" hidden>
  <p>Usamos cookies de medição para entender como o site é usado. Veja a <a href="/privacidade/#cookies">política de privacidade</a>.</p>
  <div><button class="btn" type="button" data-aceitar>Aceitar</button><button class="btn btn--sec" type="button" data-recusar>Recusar</button></div>
</div>
<script src="/assets/js/main.js" defer></script>
{scripts}</body>
</html>
'''


def parse_page(text):
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    for line in m.group(1).strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, text[m.end():]


def write(path, content):
    out = DIST / path.lstrip("/")
    if path.endswith("/"):
        out = out / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8", newline="\n")


# ----------------------------------------------------------------------------
# Blog (WordPress.com)
# ----------------------------------------------------------------------------
CACHE = SRC / "content" / "posts.json"


def fetch_posts():
    api = (f'https://public-api.wordpress.com/rest/v1.1/sites/{CFG["wp_site"]}/posts/'
           "?number=100&fields=ID,slug,title,excerpt,content,date,modified,featured_image")
    with urllib.request.urlopen(urllib.request.Request(api, headers={"User-Agent": "site-build"}), timeout=30) as r:
        posts = json.load(r)["posts"]
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(posts, ensure_ascii=False, indent=1), encoding="utf-8")
    return posts


def load_posts(offline):
    if not offline:
        try:
            posts = fetch_posts()
            print(f"blog: {len(posts)} artigos baixados do WordPress")
            return posts
        except Exception as e:  # sem rede, API fora do ar etc.
            print("blog: não foi possível buscar os artigos (", e, "); usando o cache")
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return []


def texto(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h or ""))).strip()


def resumo(p, n=170):
    t = texto(p["excerpt"]).replace("[…]", "").replace("[...]", "").strip()
    t = re.sub(r"^Introdução:?\s+", "", t)  # alguns artigos começam com o subtítulo "Introdução"
    if len(t) > n:
        t = t[:n].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return t


def data_br(iso, curta=False):
    y, mo, d = iso[:10].split("-")
    if curta:
        return f"{int(d)} {MESES[int(mo) - 1][:3]}. {y}"
    return f"{int(d)} de {MESES[int(mo) - 1]} de {y}"


def limpa(c):
    """Mantém só a estrutura do artigo; o visual vem do CSS do site."""
    c = re.sub(r"<(script|style|iframe|form|object|embed)\b.*?</\1>", "", c, flags=re.S | re.I)
    c = re.sub(r"<!--.*?-->", "", c, flags=re.S)
    c = re.sub(r'\s(class|style|id|data-[\w-]+|on\w+)="[^"]*"', "", c)
    c = re.sub(r"<(/?)h1\b", r"<\1h2", c)
    c = re.sub(r"<img\b", '<img loading="lazy" decoding="async"', c)
    c = re.sub(r"<table\b", '<div class="tabela"><table', c).replace("</table>", "</table></div>")
    c = re.sub(r'<a\s+href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', c)
    return re.sub(r"\n{3,}", "\n\n", c).strip()


def post_item(p, tag="h2"):
    return f'''<li class="post rv">
  <a href="/blog/{esc(p["slug"])}/">
    <time datetime="{p["date"][:10]}">{data_br(p["date"], True)}</time>
    <{tag}>{esc(texto(p["title"]))}</{tag}>
    <p>{esc(resumo(p))}</p>
    <span class="seta">Ler artigo{ICONS["seta"]}</span>
  </a>
</li>'''


def build_blog(posts):
    for p in posts:
        titulo = texto(p["title"])
        minutos = max(2, round(len(texto(p["content"]).split()) / 200))
        ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": titulo,
              "datePublished": p["date"], "dateModified": p.get("modified", p["date"]),
              "mainEntityOfPage": f'{CFG["url"]}/blog/{p["slug"]}/',
              "author": {"@type": "Organization", "name": CFG["nome"]},
              "publisher": {"@type": "LegalService", "name": CFG["nome"]}}
        body = f'''<article class="artigo">
  <header class="wrap artigo__topo">
    <p class="migalha migalha--so"><a href="/blog/">Blog</a></p>
    <h1>{esc(titulo)}</h1>
    <p class="artigo__meta"><time datetime="{p["date"][:10]}">{data_br(p["date"])}</time> · {minutos} min de leitura</p>
  </header>
  <div class="wrap prosa">
{limpa(p["content"])}
  </div>
  <footer class="wrap artigo__fim">
    <p>Este artigo tem caráter informativo e não substitui a análise do seu caso por um advogado.</p>
    <a class="seta seta--volta" href="/blog/">{ICONS["seta"]}Todos os artigos</a>
  </footer>
</article>
{m_cta("Ficou com alguma dúvida sobre o tema?|Conte o seu caso. Explicamos o que se aplica a ele.")}'''
        meta = {"path": f'/blog/{p["slug"]}/', "title": f"{titulo} | Alves Penello",
                "description": resumo(p, 155), "nav": "blog", "og_type": "article",
                "head": '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>"}
        write(meta["path"], layout(meta, body))


# ----------------------------------------------------------------------------
def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    offline = "--offline" in sys.argv
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC / "assets", DIST / "assets")
    shutil.copy(SRC / "assets" / "brand" / "favicon.ico", DIST / "favicon.ico")

    posts = [p for p in load_posts(offline) if p["slug"] not in CFG["blog_ignorar"]]
    posts.sort(key=lambda p: p["date"], reverse=True)
    slugs = json.dumps([p["slug"] for p in posts])
    lista = lambda n, tag: "\n".join(post_item(p, tag) for p in posts[:n]) or '<li class="post post--vazio">Em breve, novos artigos por aqui.</li>'

    urls = []
    for f in sorted((SRC / "pages").glob("*.html")):
        meta, body = parse_page(f.read_text(encoding="utf-8"))
        body = body.replace("{{posts:3}}", lista(3, "h3")).replace("{{posts:todos}}", lista(999, "h2"))
        body = body.replace("{{slugs}}", esc(slugs))
        write(meta["path"], layout(meta, expand(body)))
        if meta.get("robots", "index").startswith("index"):
            urls.append(meta["path"])
    build_blog(posts)
    urls += [f'/blog/{p["slug"]}/' for p in posts]

    hoje = date.today().isoformat()
    write("/sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f'  <url><loc>{CFG["url"]}{u}</loc><lastmod>{hoje}</lastmod></url>\n' for u in urls) + "</urlset>\n")
    write("/robots.txt", f'User-agent: *\nAllow: /\n\nSitemap: {CFG["url"]}/sitemap.xml\n')
    print(f"ok: {len(urls)} páginas em {DIST}")


if __name__ == "__main__":
    main()
