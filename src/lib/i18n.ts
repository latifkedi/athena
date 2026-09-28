import type { Lang, L10n, NodeDate } from './data';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix an internal path with the site base (/athena). */
export function url(path: string): string {
  return BASE + (path.startsWith('/') ? path : '/' + path);
}

export const REPO = 'https://github.com/latifkedi/athena';

export const routes = {
  home: { tr: '/', en: '/en/' },
  list: { tr: '/liste/', en: '/en/list/' },
  timeline: { tr: '/zaman/', en: '/en/timeline/' },
  dashboard: { tr: '/pano/', en: '/en/dashboard/' },
  latest: { tr: '/yeni/', en: '/en/latest/' },
  method: { tr: '/yontem/', en: '/en/method/' },
  search: { tr: '/ara/', en: '/en/search/' },
  journeys: { tr: '/yolculuklar/', en: '/en/journeys/' },
  people: { tr: '/kisiler/', en: '/en/people/' },
} as const;

export type RouteKey = keyof typeof routes;

export function nodePath(id: string, lang: Lang): string {
  return lang === 'tr' ? `/d/${id}/` : `/en/d/${id}/`;
}

export const journeyPath = (id: string, lang: Lang): string =>
  lang === 'tr' ? `/yolculuk/${id}/` : `/en/journey/${id}/`;
export const personPath = (slug: string, lang: Lang): string =>
  lang === 'tr' ? `/kisi/${slug}/` : `/en/person/${slug}/`;
export const comparePath = (id: string, lang: Lang): string =>
  lang === 'tr' ? `/karsilastir/${id}/` : `/en/compare/${id}/`;

export function t(v: L10n | undefined, lang: Lang): string {
  if (!v) return '';
  return v[lang] || v.tr || v.en || '';
}

export const ui = {
  siteTagline: {
    tr: 'İnsanlığın bilgi ağacı: iddialar, kanıtlar ve kaynaklar',
    en: 'The tree of human knowledge: claims, evidence and sources',
  },
  nav: {
    home: { tr: 'Ağaç', en: 'Tree' },
    list: { tr: 'Liste', en: 'List' },
    timeline: { tr: 'Zaman', en: 'Timeline' },
    journeys: { tr: 'Yolculuklar', en: 'Journeys' },
    people: { tr: 'Kişiler', en: 'People' },
    dashboard: { tr: 'İnsanlık nerede?', en: 'Where are we?' },
    latest: { tr: 'Yeni makaleler', en: 'New papers' },
    method: { tr: 'Yöntem', en: 'Method' },
  },
  principle: {
    tr: 'Athena karar vermez: iddiaları, destekleyen ve karşı çıkan kanıtları kaynaklarıyla sunar. Bilimde hiçbir teori mutlak değildir; her bilgi yeni kanıtlarla değişebilir.',
    en: 'Athena does not deliver verdicts: it presents claims together with supporting and challenging evidence, with sources. No theory in science is absolute; all knowledge may change with new evidence.',
  },
  suggest: { tr: 'Düzeltme öner', en: 'Suggest a correction' },
  nodeNote: {
    tr: 'Bu sayfa bir hüküm vermez; iddiaları ve kanıtları kaynaklarıyla sunar. Bilimde hiçbir teori mutlak değildir.',
    en: 'This page delivers no verdict; it presents claims and evidence with their sources. No theory in science is absolute.',
  },
  theme: { tr: 'Tema', en: 'Theme' },
  search: { tr: 'Ağaçta ara…', en: 'Search the tree…' },
  expandAll: { tr: 'Tümünü aç', en: 'Expand all' },
  collapseAll: { tr: 'Toparla', en: 'Collapse' },
  fit: { tr: 'Ortala', en: 'Fit' },
  canopyLabel: { tr: 'Dallar — araştırma alanları', en: 'Branches — fields of inquiry' },
  rootsLabel: { tr: 'Kökler — düşünce ve inanç gelenekleri', en: 'Roots — traditions of thought and belief' },
  legendFork: { tr: 'Açık soru: dalın görüşlere ayrıldığı yer', en: 'Open question: where the branch splits into views' },
  legendGrowth: { tr: 'Her dalda uca doğru daha yeni', en: 'Newer toward the tip of each branch' },
  timeView: { tr: 'Zamanda gez', en: 'Travel in time' },
  timePlay: { tr: 'Oynat', en: 'Play' },
  timeYear: { tr: 'Yıl', en: 'Year' },
  timeNote: {
    tr: 'Ağaç, seçilen yıla kadar belgelenmiş konularla büyür. Tarihi kesin olmayan konular bu görünümde gösterilmez.',
    en: 'The tree grows with the topics documented up to the chosen year. Topics without a documented date are not shown here.',
  },
  legendBloom: { tr: '2020 ve sonrasındaki gelişmeler', en: 'Developments from 2020 on' },
  forkNote: {
    tr: 'Bu soruda görüşler ayrılır; ağaçtaki her çatal bir görüştür.',
    en: 'Views diverge on this question; each prong on the tree is one position.',
  },
  forkNoteKids: {
    tr: 'Görüşler burada ayrılır; her alt dal ayrı bir görüştür ve kendi kanıtlarıyla sunulur.',
    en: 'Views diverge here; each sub-branch is a separate view, presented with its own evidence.',
  },
  openPage: { tr: 'Ayrıntılı sayfa', en: 'Full page' },
  close: { tr: 'Kapat', en: 'Close' },
  children: { tr: 'Alt dallar', en: 'Sub-branches' },
  related: { tr: 'Bağlantılı', en: 'Related' },
  noJs: {
    tr: 'Etkileşimli ağaç için JavaScript gerekir. Tüm düğümler Liste sayfasında.',
    en: 'The interactive tree needs JavaScript. All nodes are on the List page.',
  },
  searchTitle: { tr: 'Ara', en: 'Search' },
  searchIntro: {
    tr: 'Bütün düğümlerde, iddialarda, kanıtlarda, görüşlerde ve kaynaklarda arayın. Sonuçlar dala göre süzülebilir.',
    en: 'Search every node, claim, piece of evidence, position and source. Results can be filtered by branch.',
  },
  searchNoJs: {
    tr: 'Arama JavaScript gerektirir. Bütün düğümler Liste sayfasında.',
    en: 'Search needs JavaScript. All nodes are on the List page.',
  },
  cite: { tr: 'Bu sayfayı kaynak göster', en: 'Cite this page' },
  copy: { tr: 'Kopyala', en: 'Copy' },
  copied: { tr: 'Kopyalandı', en: 'Copied' },
  lastChanged: { tr: 'Son değişiklik', en: 'Last changed' },
  added: { tr: 'Eklendi', en: 'Added' },
  history: { tr: 'Sayfa geçmişi', en: 'Page history' },
  linkDown: { tr: 'bağlantı yanıt vermiyor; arşiv kopyasına bakın', en: 'link not responding; see the archived copy' },
  rssUpdates: { tr: 'Güncellemeler (RSS)', en: 'Updates (RSS)' },
  rssPapers: { tr: 'Yeni makaleler (RSS)', en: 'New papers (RSS)' },
  forEveryone: { tr: 'Herkes için', en: 'For everyone' },
  forExperts: { tr: 'Uzmanlar için', en: 'For specialists' },
  claims: { tr: 'İddialar', en: 'Claims' },
  evidence: { tr: 'Kanıtlar', en: 'Evidence' },
  evFor: { tr: 'Destekleyen', en: 'Supporting' },
  evAgainst: { tr: 'Karşı çıkan / sorgulayan', en: 'Challenging' },
  positions: { tr: 'Görüşler', en: 'Positions' },
  datings: { tr: 'Tarih hakkındaki görüşler', en: 'Views on dating' },
  datingsNote: {
    tr: 'Bu konunun tarihi kesin olarak belgelenmediği için tek bir tarih verilmez; farklı kaynakların görüşleri listelenir.',
    en: 'No single date is given because the date is not documented with certainty; the views of different sources are listed.',
  },
  open: { tr: 'Açık sorular', en: 'Open questions' },
  sources: { tr: 'Kaynaklar', en: 'Sources' },
  archive: { tr: 'arşiv', en: 'archive' },
  connections: { tr: 'Bağlantılar', en: 'Connections' },
  parentLabel: { tr: 'Üst dal', en: 'Parent' },
  people: { tr: 'Kişiler', en: 'People' },
  date: { tr: 'Tarih', en: 'Date' },
  latestInBranch: { tr: 'Bu dalda yeni araştırmalar', en: 'New research in this branch' },
  journalPapers: { tr: 'Hakemli dergilerde öne çıkanlar', en: 'Notable in peer-reviewed journals' },
  preprintPapers: { tr: 'Ön baskılar (henüz hakemden geçmemiş olabilir)', en: 'Preprints (may not be peer-reviewed yet)' },
  turkishPapers: { tr: 'Türkçe yayınlar (DergiPark ve diğer Türkçe dergiler)', en: 'Turkish-language papers' },
  literature: { tr: 'Literatürde ara', en: 'Search the literature' },
  literatureNote: {
    tr: 'Bu konudaki akademik yayınları başka dizinlerde de arayabilirsiniz:',
    en: 'Look for scholarly work on this topic in other indexes:',
  },
  forkBox: { tr: 'Görüş ayrılığı', en: 'Divergence of views' },
  nodes: { tr: 'düğüm', en: 'nodes' },
  undated: { tr: 'Tarihi kesin olmayanlar', en: 'Without a certain date' },
  undatedNote: {
    tr: 'Aşağıdakilerin tarihi tartışmalıdır; her birinin sayfasında farklı görüşler listelenir.',
    en: 'The dates of the following are disputed; each page lists the different views.',
  },
  filterAll: { tr: 'Tümü', en: 'All' },
  filterPlaceholder: { tr: 'Başlıkta veya özette ara…', en: 'Search titles and summaries…' },
  type: { tr: 'Tür', en: 'Type' },
  branch: { tr: 'Dal', en: 'Branch' },
  side: { tr: 'Konum', en: 'Position' },
  canopy: { tr: 'Dallar', en: 'Branches' },
  roots: { tr: 'Kökler', en: 'Roots' },
  generalLabel: { tr: 'Anlatım', en: 'Reading level' },
  lastUpdate: { tr: 'Son güncelleme', en: 'Last updated' },
  journeysIntro: {
    tr: 'Yolculuklar ağacın içinden geçen kısa rehberli yürüyüşlerdir. Her durak bir düğümdür; iddialar, kanıtlar ve kaynaklar o düğümün sayfasındadır. Duraklar birbirine bağlanır ama hiçbiri sonuç olarak sunulmaz.',
    en: 'Journeys are short guided walks through the tree. Each stop is a node; the claims, evidence and sources are on that node’s page. The stops are connected, but none of them is presented as the conclusion.',
  },
  stops: { tr: 'durak', en: 'stops' },
  stop: { tr: 'Durak', en: 'Stop' },
  startJourney: { tr: 'Yolculuğa başla', en: 'Start the journey' },
  otherJourneys: { tr: 'Diğer yolculuklar', en: 'Other journeys' },
  inJourneys: { tr: 'Bu konu şu yolculuklarda geçer', en: 'This topic is a stop on these journeys' },
  peopleIntro: {
    tr: 'Düğümlerde adı geçen kişiler, ekipler ve kurumlar. Her sayfa o kişinin anıldığı konuları tarih sırasıyla listeler.',
    en: 'People, teams and institutions named on the nodes. Each page lists the topics that mention them, in date order.',
  },
  personNodes: { tr: 'Anıldığı konular', en: 'Topics that mention them' },
  companions: { tr: 'Aynı konularda anılanlar', en: 'Named on the same topics' },
  mentions: { tr: 'konu', en: 'topics' },
  compare: { tr: 'Görüşleri yan yana karşılaştır', en: 'Compare the views side by side' },
  compareTitle: { tr: 'Karşılaştırma', en: 'Comparison' },
  compareIntro: {
    tr: 'Bu sorudaki görüşler aynı başlıklar altında yan yana. Tablo bir puanlama değildir: kanıtların sayısı, güçlerini ya da doğruluklarını göstermez. Ayrıntılar ve kaynaklar her görüşün kendi sayfasındadır.',
    en: 'The views on this question, side by side under the same headings. The table is not a score: the number of pieces of evidence says nothing about their strength or truth. Details and sources are on each view’s own page.',
  },
  compareShow: { tr: 'Gösterilen görüşler', en: 'Views shown' },
  poster: { tr: 'Poster', en: 'Poster' },
  posterPng: { tr: 'PNG olarak indir', en: 'Download as PNG' },
  posterSvg: { tr: 'SVG olarak indir', en: 'Download as SVG' },
  posterNote: {
    tr: 'Ağacın şu anki hâli, açık dallarıyla birlikte indirilir.',
    en: 'The tree is saved as it is now, with the branches you have opened.',
  },
  typedLinks: { tr: 'Fikir bağları', en: 'Lines of influence' },
  posterPrinciple: {
    tr: 'Athena karar vermez: iddiaları, kanıtları ve görüşleri kaynaklarıyla sunar.',
    en: 'Athena delivers no verdicts: it presents claims, evidence and views with their sources.',
  },
} satisfies Record<string, any>;

/** How a typed link reads from each end. 'out' is written on the node itself, 'in' on the other node. */
export const relLabels: Record<string, { out: L10n; in: L10n }> = {
  'builds-on': {
    out: { tr: 'Üzerine kurulduğu', en: 'Builds on' },
    in: { tr: 'Üzerine kurulanlar', en: 'Built upon by' },
  },
  'influenced-by': {
    out: { tr: 'Etkilendiği', en: 'Influenced by' },
    in: { tr: 'Etkiledikleri', en: 'Influenced' },
  },
  opposes: {
    out: { tr: 'Eleştirdiği / karşı çıktığı', en: 'Argues against' },
    in: { tr: 'Onu eleştirenler / karşı çıkanlar', en: 'Argued against by' },
  },
  replaces: {
    out: { tr: 'Yaygın kullanımda yerini aldığı', en: 'Took the place (in wide use) of' },
    in: { tr: 'Yaygın kullanımda yerini alan', en: 'Its place (in wide use) was taken by' },
  },
};

export const typeLabels: Record<string, L10n> = {
  field: { tr: 'Alan', en: 'Field' },
  idea: { tr: 'Fikir / teori / iddia', en: 'Idea / theory / claim' },
  event: { tr: 'Olay / yayın / deney', en: 'Event / publication / experiment' },
  tradition: { tr: 'Gelenek / ekol', en: 'Tradition / school' },
  practice: { tr: 'Uygulama', en: 'Practice' },
  question: { tr: 'Soru', en: 'Question' },
  technology: { tr: 'Teknoloji / buluş', en: 'Technology / invention' },
  text: { tr: 'Metin / eser', en: 'Text / work' },
  center: { tr: 'Merkez', en: 'Centre' },
};

export const evidenceKinds: Record<string, L10n> = {
  proof: { tr: 'Matematiksel ispat', en: 'Mathematical proof' },
  experiment: { tr: 'Deney', en: 'Experiment' },
  observation: { tr: 'Gözlem', en: 'Observation' },
  measurement: { tr: 'Ölçüm', en: 'Measurement' },
  archaeological: { tr: 'Arkeolojik / fosil bulgu', en: 'Archaeological / fossil find' },
  genetic: { tr: 'Genetik veri', en: 'Genetic data' },
  statistical: { tr: 'İstatistik / meta-analiz', en: 'Statistics / meta-analysis' },
  replication: { tr: 'Tekrar çalışması', en: 'Replication study' },
  theoretical: { tr: 'Kuramsal argüman', en: 'Theoretical argument' },
  argument: { tr: 'Felsefi / kelami argüman', en: 'Philosophical / theological argument' },
  scripture: { tr: 'Kutsal metin / nakil', en: 'Scripture / transmitted text' },
  experience: { tr: 'Tecrübe / keşf / tanıklık', en: 'Experience / unveiling / testimony' },
  historical: { tr: 'Tarihsel belge', en: 'Historical record' },
  critique: { tr: 'Yöntem eleştirisi', en: 'Methodological critique' },
  clinical: { tr: 'Klinik çalışma', en: 'Clinical study' },
  computation: { tr: 'Hesaplama / simülasyon', en: 'Computation / simulation' },
};

export const sourceTypes: Record<string, L10n> = {
  article: { tr: 'Makale', en: 'Article' },
  book: { tr: 'Kitap', en: 'Book' },
  preprint: { tr: 'Ön baskı', en: 'Preprint' },
  scripture: { tr: 'Kutsal metin', en: 'Scripture' },
  manuscript: { tr: 'Klasik eser', en: 'Classical work' },
  web: { tr: 'Web', en: 'Web' },
  report: { tr: 'Rapor', en: 'Report' },
  encyclopedia: { tr: 'Ansiklopedi', en: 'Encyclopedia' },
  dataset: { tr: 'Veri seti', en: 'Dataset' },
  news: { tr: 'Haber (ek okuma)', en: 'News (further reading)' },
};

const monthsTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function yearLabel(y: number, lang: Lang): string {
  if (y < 0) return lang === 'tr' ? `MÖ ${-y}` : `${-y} BCE`;
  return String(y);
}

export function formatDate(d: NodeDate | undefined, lang: Lang): string {
  if (!d) return '';
  const approx = d.approx ? (lang === 'tr' ? 'y. ' : 'c. ') : '';
  let s = yearLabel(d.year, lang);
  if (d.end !== undefined) s += '–' + (d.end < 0 ? yearLabel(d.end, lang) : String(d.end));
  if (d.month) {
    const m = (lang === 'tr' ? monthsTr : monthsEn)[d.month - 1];
    s = d.day ? (lang === 'tr' ? `${d.day} ${m} ${s}` : `${m} ${d.day}, ${s}`) : `${m} ${s}`;
  }
  return approx + s;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'tr' ? 'en' : 'tr';
}

export function suggestUrl(lang: Lang, nodeId?: string, title?: string): string {
  const p = new URLSearchParams({ template: 'duzeltme.yml' });
  if (nodeId) {
    p.set('title', `[${nodeId}] ${title ?? ''}`.trim());
    p.set('dugum', nodeId);
  }
  p.set('dil', lang);
  return `${REPO}/issues/new?${p.toString()}`;
}
