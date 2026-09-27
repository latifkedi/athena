# Athena: insanlığın bilgi ağacı

**Athena**, insanlığın bilgisini ilk taş aletlerden 2026'nın en yeni keşiflerine kadar bir **dünya ağacı** olarak gösteren
iki dilli (Türkçe/İngilizce) bir sitedir.

- **Dallar** (yukarı): dünyayı araştıran alanlar. İlk bilgiler, matematik, fizik, enerji, kimya, biyoloji, tıp,
  astronomi, uzay keşfi, yer bilimleri ve iklim, bilişim, psikoloji, parapsikoloji, toplum, hukuk ve siyaset, dilbilim,
  sanat ve müzik.
- **Kökler** (aşağı): düşünce ve inanç gelenekleri. Felsefe, kelam, tasavvuf, dinler, mitoloji, ezoterik gelenekler
  (simya, hermetizm, astroloji).

## İlke: karar vermeyiz

Athena hiçbir iddiaya "doğru", "yanlış", "makul" gibi bir hüküm vermez. Her düğümde şunlar bulunur:

1. **Herkes için** sade bir anlatım ve **uzmanlar için** teknik bir anlatım
2. **İddialar**
3. **Destekleyen** ve **karşı çıkan / sorgulayan** kanıtlar (türü etiketli: deney, gözlem, ispat, kutsal metin, tecrübe…)
4. Farklı çevrelerin **görüşleri**
5. Tarihi kesin olmayan konularda tek bir tarih yerine **tarihlendirme görüşleri** (bilim, dinler vb.)
6. **Kaynaklar**: DOI, arXiv, ISBN, bağlantı ve her biri için **Wayback Machine arşivi**

Kaynaksız düğüm kabul edilmez. `scripts/check-content.mjs` her derlemeden önce bunu denetler.

## Siteyi yayına almak (GitHub Pages)

1. GitHub'da depo **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
2. **Actions → Deploy → Run workflow** ile ilk yayını başlatın. Bu çalıştırma ilk makale listesini de çeker.
3. Site şu adreste yayınlanır: `https://latifkedi.github.io/athena/`

Sonrasında varsayılan dala yapılan her gönderimde site kendiliğinden güncellenir. Her ayın 1'inde de yeni makaleler
çekilir ve kaynaklar arşivlenir.

## Yeni düğüm eklemek

`content/nodes/<dal>/` altında yeni bir `.yaml` dosyası oluşturun. Dosya adı, düğümün `id` değeriyle aynı olmalıdır.

```yaml
id: ornek-kesif            # dosya adıyla aynı
parent: fizik              # üst düğüm
type: event                # field | idea | event | tradition | practice | question | technology | text
date: { year: 2026, month: 3 }   # yalnızca belgelenmiş olaylar için; yaklaşık ise approx: true
# datings:                 # tarih kesin değilse date yerine görüşler
#   - view: { tr: ..., en: ... }
#     value: { tr: ..., en: ... }
#     src: [kaynak1]
people: [Ad Soyad]
related: [baska-dugum]
title:   { tr: ..., en: ... }
summary: { tr: ..., en: ... }     # herkes için
technical: { tr: ..., en: ... }   # uzmanlar için
claims:
  - { tr: ..., en: ..., src: [kaynak1] }
evidence:
  - kind: experiment       # proof, observation, measurement, statistical, replication, scripture, experience, argument…
    stance: for            # for (destekleyen) | against (karşı çıkan)
    tr: ...
    en: ...
    src: [kaynak1]
positions:
  - who: { tr: ..., en: ... }
    tr: ...
    en: ...
    src: [kaynak2]
sources:
  kaynak1:
    type: article          # article | book | preprint | scripture | manuscript | web | report | encyclopedia | dataset | news
    authors: Soyad, A. et al.
    title: ...
    year: 2026
    in: Dergi 1, 1–10
    doi: 10.xxxx/xxxxx     # veya arxiv: '2601.00001', isbn: ..., url: ...
```

Birden fazla düğümde kullanılan kaynaklar `content/shared-sources.yaml` dosyasına eklenip `@anahtar` ile anılabilir.

## Lisans

İçerik (`content/`) [CC BY-SA 4.0](content/LICENSE.md), kod [MIT](LICENSE) lisanslıdır.

## Komutlar

```bash
npm install
npm run dev       # yerel geliştirme sunucusu
npm run check     # içerik denetimi
npm run build     # denetim + statik site (dist/)
npm run feed      # en yeni ön baskıları çek (arXiv, bioRxiv, medRxiv, ChemRxiv, PsyArXiv, SocArXiv)
npm run archive   # kaynak bağlantılarını Wayback Machine'e arşivle
```

## Yapı

```
content/nodes/        düğümler (her biri bir YAML dosyası)
content/dashboard.yaml  "İnsanlık nerede?" panosu
content/feed/latest.json  aylık otomatik makale listesi
content/archive.json  kaynakların arşiv bağlantıları
src/                  Astro sayfaları, D3 ağaç görünümü
scripts/              içerik denetimi, makale akışı, arşivleme
.github/              yayın iş akışı ve "düzeltme öner" formu
```

---

# Athena: the tree of human knowledge

A bilingual (Turkish/English) site showing human knowledge, from the first stone tools to the newest discoveries of 2026,
as a **world tree**: **branches** above are fields of inquiry, **roots** below are traditions of thought and belief.
Athena delivers no verdicts: every node presents claims, supporting and challenging evidence, positions, dating views
and archived sources. See the Turkish section above for publishing, adding nodes and commands.
