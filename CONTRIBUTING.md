# Athena'ya katkı

Athena'ya herkes katkı verebilir: eksik bir kaynak, karşıt bir görüş, yanlış bir tarih ya da yepyeni bir düğüm.
Bu rehber, katkının nasıl yapılacağını ve sitenin temel ilkesinin nasıl korunduğunu anlatır.

## Temel ilke: hüküm vermeyiz

Athena bir iddianın "doğru", "yanlış", "makul" ya da "sözde bilim" olduğunu söylemez. Her düğümde:

- iddialar,
- destekleyen ve karşı çıkan / sorgulayan kanıtlar (türüyle birlikte: deney, gözlem, ispat, kutsal metin, tecrübe…),
- farklı çevrelerin görüşleri,
- tarihi kesin olmayan konularda tarihlendirme görüşleri

yan yana ve kaynaklarıyla sunulur. Okur kararını kendisi verir.

Bu yüzden katkılarda:

1. **Hüküm bildiren sözcükler kullanılmaz.** "Çürütülmüştür", "kanıtlanmış gerçektir", "batıl", "sözde bilim",
   "hurafe" gibi ifadeler yerine "X şu deneyi yaptı, sonuç şu çıktı" gibi betimleyici cümleler yazılır. İçerik denetimi
   (`npm run check`) bu sözcükleri uyarı olarak işaretler.
2. **Her iddia kaynaklıdır.** Kaynaksız düğüm kabul edilmez; denetim bunu hata sayar.
3. **Birincil kaynak önceliklidir.** Hakemli makale (DOI), kitap (ISBN), kutsal metin, el yazması. Haber ve ansiklopedi
   ek okuma olarak eklenebilir.
4. **Ciddi karşı görüş gösterilir.** Bir iddiaya karşı yayımlanmış ciddi bir kanıt ya da görüş varsa eklenir; yoksa
   uydurulmaz. Karşı sütunun boş kalması da bir bilgidir.
5. **Dinler ve gelenekler puanlanmaz.** Kendi metinleri ve kendi yorum gelenekleriyle anlatılır.
6. **Tarihi kesin olmayan konularda tek tarih verilmez.** `datings` alanında bilimin, dinlerin ve farklı okulların
   görüşleri ayrı ayrı yazılır.

## Nasıl katkı verilir?

### 1. Düzeltme ya da öneri (GitHub hesabı yeterli)

Her sayfanın altındaki **Düzeltme öner** bağlantısı hazır bir form açar. Yeni bir konu önermek için
[Yeni düğüm öner](https://github.com/latifkedi/athena/issues/new?template=yeni-dugum.yml) formunu kullanın.
Önerinizde kaynağı mutlaka belirtin.

### 2. Doğrudan düzenleme (pull request)

1. Depoyu çatallayın (fork) ve yeni bir dal açın.
2. `content/nodes/<dal>/` altında düğümün YAML dosyasını düzenleyin ya da yeni bir dosya ekleyin. Dosya adı düğümün
   `id` değeriyle aynı olmalıdır. Şablon için [README](README.md#yeni-düğüm-eklemek) dosyasına bakın.
3. `npm install` ve ardından `npm run check` çalıştırın; hata kalmamalıdır.
4. İsterseniz `npm run dev` ile siteyi yerelde açıp düğüm sayfasına bakın.
5. Pull request açın ve aşağıdaki kontrol listesini doldurun.

## İnceleme kontrol listesi

Her katkı birleştirilmeden önce şu sorularla gözden geçirilir:

- [ ] Her iddia, kanıt, görüş ve tarihlendirme en az bir kaynağa bağlı mı?
- [ ] Kaynaklar gerçekten var mı? DOI / ISBN / bağlantı doğru mu ve kaynak iddia edilen şeyi söylüyor mu?
- [ ] Metin betimleyici mi; hüküm bildiren bir sözcük ya da ima var mı?
- [ ] Ciddi bir karşı kanıt ya da görüş biliniyorsa eklenmiş mi?
- [ ] "Herkes için" metni uzman olmayan birinin anlayacağı dilde mi; "Uzmanlar için" metni teknik olarak doğru mu?
- [ ] Türkçe ve İngilizce metinler aynı şeyi söylüyor mu?
- [ ] Tarih kesin değilse tek tarih yerine `datings` kullanılmış mı?
- [ ] `npm run check` hatasız geçiyor mu?

## Düğüm türleri ve ilişkiler

- `type`: `field` (alan), `idea` (fikir/kuram), `event` (olay/yayın/deney), `tradition` (gelenek/ekol),
  `practice` (uygulama), `question` (açık soru; görüşler burada ayrılır), `technology` (teknoloji), `text` (metin/eser).
- `related`: bağlantılı düğümler. Bağlantının türü biliniyorsa `links` alanı kullanılır. Bağ, düğümün kendisinden
  diğerine doğru okunur ("bu düğüm … o düğümü"):
  `builds-on` (üzerine kurulur / geliştirir), `influenced-by` (ondan etkilendi), `opposes` (eleştirir / karşı çıkar),
  `replaces` (yaygın kullanımda yerini aldı). Diğer düğümün sayfasında bağ ters yönden gösterilir.

  ```yaml
  links:
    - { to: kopernik, rel: builds-on }
    - to: gazali-tehafut
      rel: opposes
      note: { tr: Tehâfütü't-Tehâfüt doğrudan bu esere cevaptır., en: The Incoherence of the Incoherence answers this book directly. }
      src: [kaynak1]
  ```
- `people`: kişiler. İki dilde farklı yazılıyorsa `Türkçe / English` biçiminde yazın (ör. `Gazzâlî / al-Ghazālī`);
  Türkçe kısmı aynı olan adlar tek bir kişi sayfasında toplanır.

## Yolculuklar

`content/journeys.yaml` ağacın içinden geçen rehberli yürüyüşleri tanımlar. Her durak var olan bir düğüme işaret eder;
durak metni yalnızca bir duraktan ötekine bağ kurar, hüküm vermez. Görüş ayrılığı olan konularda yolculuk görüşleri
sırayla gezer ve hiçbirini sonuç olarak sunmaz.

## Davranış

Farklı inanç ve görüşlerden insanların birlikte çalıştığı bir projeyiz. Kişilere değil, kaynaklara ve kanıtlara
odaklanın.

---

# Contributing to Athena

Anyone can contribute: a missing source, an opposing view, a wrong date or a whole new node.

**Core principle: we deliver no verdicts.** Athena never labels a claim as true, false, plausible or pseudoscience. Every
node lays out claims, supporting and challenging evidence (with its kind), positions and, where a date is uncertain,
the dating views of different traditions, each with its sources. Readers decide for themselves.

When contributing:

1. Avoid words that pass judgement ("debunked", "proven fact", "superstition", "pseudoscience"); describe what was done
   and what was found. `npm run check` warns about such words.
2. Every claim has a source; nodes without sources fail the check.
3. Prefer primary sources (peer-reviewed papers with DOI, books with ISBN, scriptures, manuscripts); news and
   encyclopedias are extra reading.
4. Show serious opposing evidence where it exists; never invent it.
5. Religions and traditions are not scored; they are presented through their own texts and interpretive traditions.
6. Where a date is uncertain, give the views (`datings`) instead of a single date.

**How:** use the "Suggest a correction" link on any page, the
[new node form](https://github.com/latifkedi/athena/issues/new?template=yeni-dugum.yml), or open a pull request that edits
`content/nodes/…/*.yaml` and passes `npm run check`. Reviews follow the checklist above.
