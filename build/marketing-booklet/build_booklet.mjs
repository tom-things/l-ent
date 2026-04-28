import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "outputs", "marketing-booklet");
const SCRATCH_DIR = path.join(ROOT, "tmp", "slides", "marketing-booklet");
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");

const W = 1240;
const H = 1754;

const COLORS = {
  cream: "#FCFBF8",
  creamDark: "#F1EEE6",
  paper: "#FFFFFF",
  ink: "#171717",
  inkSoft: "#4B4B46",
  line: "#D8D3C7",
  lime: "#D7FF30",
  aqua: "#CDFFF5",
  brown: "#341200",
  olive: "#859B1A",
  gold: "#F4C542",
  coral: "#F97316",
  blue: "#2F7EF7",
  rose: "#E85D8C",
  shadow: "#00000012",
};

const FONTS = {
  display: "Aptos Display",
  body: "Aptos",
  mono: "Aptos Mono",
};

const ASSETS = {
  icon: path.join(ROOT, "src", "assets", "favicon.png"),
  hero: path.join(ROOT, "src", "assets", "login", "illustration.png"),
  pwaInvite: path.join(ROOT, "src", "assets", "mobile-pwa-invite.png"),
  serviceIcons: [
    ["ADE", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "emplois-du-temps.png")],
    ["Moodle", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "moodle.png")],
    ["Messagerie", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "messagerie.png")],
    ["Microsoft 365", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "microsoft-365.png")],
    ["Notes", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "iutlan-notes9.png")],
    ["Annuaire", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "annuaire.png")],
    ["Sésame", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "sesame.png")],
    ["Stockage", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "espaces-stockage.png")],
    ["Docs", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "documentation-services.png")],
    ["Stage", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "stages.png")],
    ["Webconf", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "webconference.png")],
    ["Compte", path.join(ROOT, "src", "assets", "app_icons", "uni_rennes", "compte-informatique.png")],
  ],
};

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
}

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function line(fill = COLORS.line, width = 1) {
  return { style: "solid", fill, width };
}

function addShape(
  slide,
  geometry,
  { left, top, width, height, fill = COLORS.paper, lineFill = COLORS.line, lineWidth = 1, rotation = 0 },
) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height, rotation },
    fill,
    line: line(lineFill, lineWidth),
  });
}

function addText(
  slide,
  text,
  {
    left,
    top,
    width,
    height,
    size = 22,
    color = COLORS.ink,
    bold = false,
    face = FONTS.body,
    align = "left",
    valign = "top",
    fill = "#00000000",
    lineFill = "#00000000",
    lineWidth = 0,
    autoFit = "shrinkText",
    opacity = 1,
  },
) {
  const box = addShape(slide, "rect", { left, top, width, height, fill, lineFill, lineWidth });
  box.text = text;
  box.text.fontSize = size;
  box.text.color = color;
  box.text.bold = bold;
  box.text.typeface = face;
  box.text.alignment = align;
  box.text.verticalAlignment = valign;
  box.text.insets = { left: 0, right: 0, top: 0, bottom: 0 };
  if (autoFit) {
    box.text.autoFit = autoFit;
  }
  if (opacity !== 1) {
    box.opacity = opacity;
  }
  return box;
}

async function addImage(slide, imagePath, { left, top, width, height, fit = "contain", alt = "" }) {
  const image = slide.images.add({
    blob: await readImageBlob(imagePath),
    fit,
    alt,
  });
  image.position = { left, top, width, height };
  return image;
}

function addPageHeader(slide, section, pageNo) {
  addText(slide, section.toUpperCase(), {
    left: 78,
    top: 54,
    width: 500,
    height: 24,
    size: 14,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addText(slide, String(pageNo).padStart(2, "0"), {
    left: W - 130,
    top: 54,
    width: 52,
    height: 24,
    size: 14,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    align: "right",
    autoFit: null,
  });
  addShape(slide, "rect", {
    left: 78,
    top: 86,
    width: W - 156,
    height: 2,
    fill: COLORS.line,
    lineFill: "#00000000",
    lineWidth: 0,
  });
}

function addFooter(slide, note) {
  addText(slide, note, {
    left: 78,
    top: H - 64,
    width: W - 156,
    height: 20,
    size: 11,
    color: COLORS.inkSoft,
    face: FONTS.body,
    autoFit: null,
  });
}

function addBrandMark(slide, { left = 78, top = 94, compact = false } = {}) {
  const size = compact ? 46 : 60;
  return Promise.all([
    addImage(slide, ASSETS.icon, {
      left,
      top,
      width: size,
      height: size,
      fit: "contain",
      alt: "Icône l'ent",
    }),
    addText(slide, "l'ent", {
      left: left + size + 14,
      top: top + (compact ? 4 : 7),
      width: 180,
      height: compact ? 34 : 40,
      size: compact ? 28 : 34,
      color: COLORS.brown,
      bold: true,
      face: FONTS.display,
      autoFit: null,
    }),
  ]);
}

function addBadge(slide, text, { left, top, width = 220, fill = COLORS.paper, color = COLORS.ink }) {
  addShape(slide, "roundRect", {
    left,
    top,
    width,
    height: 34,
    fill,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, text, {
    left: left + 14,
    top: top + 8,
    width: width - 28,
    height: 18,
    size: 11,
    color,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
}

function addCard(slide, { left, top, width, height, accent = COLORS.lime, title, body, tone = COLORS.paper }) {
  addShape(slide, "roundRect", {
    left,
    top,
    width,
    height,
    fill: tone,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addShape(slide, "roundRect", {
    left: left + 18,
    top: top + 18,
    width: 44,
    height: 44,
    fill: accent,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, title, {
    left: left + 78,
    top: top + 18,
    width: width - 96,
    height: 24,
    size: 18,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    autoFit: null,
  });
  addText(slide, body, {
    left: left + 24,
    top: top + 82,
    width: width - 48,
    height: height - 104,
    size: 15,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
}

function addMetricCard(slide, { left, top, width, metric, label, accent }) {
  addShape(slide, "roundRect", {
    left,
    top,
    width,
    height: 128,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addShape(slide, "rect", {
    left,
    top,
    width,
    height: 7,
    fill: accent,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, metric, {
    left: left + 20,
    top: top + 22,
    width: width - 40,
    height: 38,
    size: 28,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    autoFit: null,
  });
  addText(slide, label, {
    left: left + 20,
    top: top + 68,
    width: width - 40,
    height: 34,
    size: 14,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
}

function addTimelineStep(slide, { left, top, width, label, body, accent }) {
  addShape(slide, "roundRect", {
    left,
    top,
    width,
    height: 150,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addShape(slide, "ellipse", {
    left: left + 22,
    top: top + 22,
    width: 38,
    height: 38,
    fill: accent,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, label, {
    left: left + 74,
    top: top + 22,
    width: width - 96,
    height: 24,
    size: 17,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    autoFit: null,
  });
  addText(slide, body, {
    left: left + 24,
    top: top + 72,
    width: width - 48,
    height: 56,
    size: 14,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
}

function addBulletList(slide, items, { left, top, width, gap = 18, size = 17 }) {
  items.forEach((item, index) => {
    const y = top + index * gap;
    addShape(slide, "ellipse", {
      left,
      top: y + 7,
      width: 8,
      height: 8,
      fill: COLORS.ink,
      lineFill: "#00000000",
      lineWidth: 0,
    });
    addText(slide, item, {
      left: left + 18,
      top: y,
      width: width - 18,
      height: gap + 8,
      size,
      color: COLORS.inkSoft,
      face: FONTS.body,
    });
  });
}

async function slideCover(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addShape(slide, "rect", {
    left: 0,
    top: 0,
    width: W,
    height: 710,
    fill: COLORS.lime,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "ellipse", {
    left: 720,
    top: 108,
    width: 470,
    height: 470,
    fill: "#CDFFF58F",
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "ellipse", {
    left: -120,
    top: 480,
    width: 500,
    height: 500,
    fill: "#FFFFFF66",
    lineFill: "#00000000",
    lineWidth: 0,
  });
  await addBrandMark(slide, { left: 84, top: 84 });
  addBadge(slide, "BOOKLET MARKETING", { left: 84, top: 182, width: 190, fill: "#FFFFFFA6", color: COLORS.brown });
  addText(slide, "Toute ta fac,\nau même endroit.", {
    left: 84,
    top: 242,
    width: 560,
    height: 280,
    size: 72,
    color: COLORS.brown,
    bold: true,
    face: FONTS.display,
    autoFit: "shrinkText",
  });
  addText(slide, "Le client universitaire alternatif qui réunit notes, planning et services ENT dans une seule expérience pensée pour le quotidien étudiant.", {
    left: 84,
    top: 548,
    width: 500,
    height: 120,
    size: 22,
    color: COLORS.brown,
    face: FONTS.body,
  });
  addShape(slide, "roundRect", {
    left: 84,
    top: 722,
    width: 360,
    height: 140,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Promesse", {
    left: 110,
    top: 748,
    width: 120,
    height: 20,
    size: 13,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addText(slide, "Une interface plus lisible, plus directe et plus mobile que le parcours ENT fragmenté.", {
    left: 110,
    top: 782,
    width: 300,
    height: 58,
    size: 18,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Projet indépendant, non officiel, open source.", {
    left: 84,
    top: H - 74,
    width: 400,
    height: 18,
    size: 11,
    color: COLORS.inkSoft,
    face: FONTS.body,
    autoFit: null,
  });
  await addImage(slide, ASSETS.hero, {
    left: 470,
    top: 520,
    width: 760,
    height: 1160,
    fit: "contain",
    alt: "Étudiants utilisant leur téléphone",
  });
}

async function slideProblem(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "Le constat", 2);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "La vie étudiante numérique reste dispersée.", {
    left: 78,
    top: 186,
    width: 560,
    height: 126,
    size: 46,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Entre l'ENT, ADE, Notes9 et les dizaines d'applications satellites, l'étudiant change sans cesse de repère, de logique et d'interface.", {
    left: 78,
    top: 330,
    width: 520,
    height: 110,
    size: 19,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
  addMetricCard(slide, { left: 78, top: 486, width: 154, metric: "3", label: "Flux majeurs à jongler", accent: COLORS.lime });
  addMetricCard(slide, { left: 252, top: 486, width: 154, metric: "32+", label: "Services visibles dans le repo", accent: COLORS.aqua });
  addMetricCard(slide, { left: 426, top: 486, width: 154, metric: "1", label: "Dashboard visé par l'ent", accent: COLORS.gold });
  addCard(slide, {
    left: 670,
    top: 186,
    width: 492,
    height: 176,
    accent: COLORS.lime,
    title: "Fragmentation",
    body: "Les informations utiles sont réparties entre portails, widgets, services et outils métiers peu cohérents entre eux.",
  });
  addCard(slide, {
    left: 670,
    top: 386,
    width: 492,
    height: 176,
    accent: COLORS.aqua,
    title: "Friction mobile",
    body: "Le parcours quotidien n'est pas pensé comme une expérience rapide à ouvrir depuis un téléphone entre deux cours.",
  });
  addCard(slide, {
    left: 670,
    top: 586,
    width: 492,
    height: 176,
    accent: COLORS.coral,
    title: "Charge mentale",
    body: "Retrouver une note, un prochain cours ou le bon service demande plus d'effort qu'il ne devrait.",
  });
  addShape(slide, "ellipse", {
    left: 148,
    top: 876,
    width: 178,
    height: 178,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addShape(slide, "ellipse", {
    left: 362,
    top: 876,
    width: 178,
    height: 178,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addShape(slide, "ellipse", {
    left: 576,
    top: 876,
    width: 178,
    height: 178,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "ENT", {
    left: 204,
    top: 940,
    width: 66,
    height: 28,
    size: 24,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    align: "center",
    autoFit: null,
  });
  addText(slide, "ADE", {
    left: 418,
    top: 940,
    width: 66,
    height: 28,
    size: 24,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    align: "center",
    autoFit: null,
  });
  addText(slide, "Notes9", {
    left: 612,
    top: 940,
    width: 106,
    height: 28,
    size: 24,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    align: "center",
    autoFit: null,
  });
  addShape(slide, "rect", {
    left: 326,
    top: 964,
    width: 34,
    height: 2,
    fill: COLORS.line,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "rect", {
    left: 540,
    top: 964,
    width: 34,
    height: 2,
    fill: COLORS.line,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "roundRect", {
    left: 286,
    top: 1098,
    width: 330,
    height: 92,
    fill: COLORS.lime,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, "Résultat : un quotidien numérique utile, mais peu fluide.", {
    left: 314,
    top: 1124,
    width: 272,
    height: 40,
    size: 22,
    color: COLORS.brown,
    bold: true,
    face: FONTS.display,
    align: "center",
  });
  addFooter(slide, "Sources : README, LoginPage, SEO copy, AvailableApplications");
}

async function slideSolution(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "La réponse", 3);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "l'ent regroupe les usages essentiels dans une seule interface.", {
    left: 78,
    top: 186,
    width: 760,
    height: 116,
    size: 42,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Le projet se positionne comme un client alternatif : il ne remplace pas les services universitaires, il les relie dans une expérience plus claire.", {
    left: 78,
    top: 312,
    width: 780,
    height: 92,
    size: 19,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
  addCard(slide, {
    left: 78,
    top: 462,
    width: 338,
    height: 250,
    accent: COLORS.lime,
    title: "Pilotage",
    body: "Moyenne générale, moyenne de promo et dernière note remontent dans la même vue au lieu d'obliger à ouvrir Notes9 séparément.",
  });
  addCard(slide, {
    left: 450,
    top: 462,
    width: 338,
    height: 250,
    accent: COLORS.aqua,
    title: "Timing",
    body: "Le prochain cours, l'emploi du temps ADE et le planning détaillé remontent dans le dashboard avec le bon contexte étudiant.",
  });
  addCard(slide, {
    left: 822,
    top: 462,
    width: 338,
    height: 250,
    accent: COLORS.gold,
    title: "Navigation",
    body: "Le catalogue d'applications universitaires devient consultable, recherchable et personnalisable avec favoris.",
  });
  addTimelineStep(slide, {
    left: 112,
    top: 848,
    width: 292,
    label: "Connexion ENT",
    body: "L'utilisateur passe par la même authentification CAS que les services existants.",
    accent: COLORS.lime,
  });
  addTimelineStep(slide, {
    left: 474,
    top: 848,
    width: 292,
    label: "Onboarding",
    body: "Année, promo, groupe TD ou TP aident l'app à afficher le bon planning et les bons raccourcis.",
    accent: COLORS.aqua,
  });
  addTimelineStep(slide, {
    left: 836,
    top: 848,
    width: 292,
    label: "Dashboard",
    body: "Une page unique devient le point d'entrée du quotidien étudiant, sur desktop comme sur mobile.",
    accent: COLORS.coral,
  });
  addShape(slide, "rect", {
    left: 404,
    top: 922,
    width: 54,
    height: 2,
    fill: COLORS.line,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "rect", {
    left: 766,
    top: 922,
    width: 54,
    height: 2,
    fill: COLORS.line,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addBadge(slide, "Notes + ADE + services + météo + PWA", {
    left: 78,
    top: 1278,
    width: 378,
    fill: COLORS.paper,
  });
  addFooter(slide, "Promesse produit issue du README et de l'interface de connexion.");
}

async function slideMobile(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "Mobile-first", 4);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "Une expérience conçue pour être ouverte vite, partout.", {
    left: 78,
    top: 186,
    width: 520,
    height: 118,
    size: 42,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addBulletList(slide, [
    "PWA installable sur iOS, Android et ordinateur.",
    "Page d'accueil unique pour garder l'essentiel visible.",
    "Onboarding pour aligner la vue avec la promo, le TD ou le TP.",
    "Mode clair et sombre pour une consultation quotidienne.",
  ], {
    left: 82,
    top: 348,
    width: 470,
    gap: 80,
    size: 20,
  });
  addShape(slide, "roundRect", {
    left: 632,
    top: 156,
    width: 520,
    height: 1080,
    fill: "#F5F3ED",
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addBadge(slide, "Exemple d'installation sur écran d'accueil", {
    left: 668,
    top: 190,
    width: 286,
    fill: COLORS.paper,
  });
  await addImage(slide, ASSETS.pwaInvite, {
    left: 654,
    top: 244,
    width: 476,
    height: 968,
    fit: "cover",
    alt: "Capture PWA mobile",
  });
  addShape(slide, "roundRect", {
    left: 78,
    top: 760,
    width: 470,
    height: 260,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Ce que cela change", {
    left: 104,
    top: 792,
    width: 220,
    height: 24,
    size: 17,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addText(slide, "l'ent adopte le langage des apps du quotidien : une ouverture directe, des repères simples, des gestes familiers et un accès rapide aux infos qui comptent.", {
    left: 104,
    top: 834,
    width: 408,
    height: 132,
    size: 18,
    color: COLORS.ink,
    face: FONTS.body,
  });
  addBadge(slide, "Usage : entre deux cours, dans les transports, en entrant en amphi", {
    left: 78,
    top: 1068,
    width: 470,
    fill: COLORS.aqua,
    color: COLORS.ink,
  });
  addFooter(slide, "Le repo mentionne explicitement la PWA installable et la compatibilité mobile.");
}

async function slideServices(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "Catalogue", 5);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "Tout l'écosystème universitaire devient plus navigable.", {
    left: 78,
    top: 186,
    width: 740,
    height: 104,
    size: 42,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Le projet agrège le marketplace ENT et les portlets visibles pour l'utilisateur, avec recherche et favoris dans la même page.", {
    left: 78,
    top: 304,
    width: 700,
    height: 84,
    size: 18,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
  addBadge(slide, "32+ icônes de services sont déjà embarquées dans le projet", {
    left: 78,
    top: 406,
    width: 380,
    fill: COLORS.paper,
  });

  const startX = 78;
  const startY = 484;
  const cols = 4;
  const cardW = 256;
  const cardH = 174;
  const xGap = 22;
  const yGap = 22;

  for (let index = 0; index < ASSETS.serviceIcons.length; index += 1) {
    const [label, iconPath] = ASSETS.serviceIcons[index];
    const col = index % cols;
    const row = Math.floor(index / cols);
    const left = startX + col * (cardW + xGap);
    const top = startY + row * (cardH + yGap);
    addShape(slide, "roundRect", {
      left,
      top,
      width: cardW,
      height: cardH,
      fill: COLORS.paper,
      lineFill: COLORS.line,
      lineWidth: 1,
    });
    addShape(slide, "roundRect", {
      left: left + 20,
      top: top + 20,
      width: 68,
      height: 68,
      fill: COLORS.creamDark,
      lineFill: "#00000000",
      lineWidth: 0,
    });
    await addImage(slide, iconPath, {
      left: left + 30,
      top: top + 30,
      width: 48,
      height: 48,
      fit: "contain",
      alt: label,
    });
    addText(slide, label, {
      left: left + 20,
      top: top + 108,
      width: cardW - 40,
      height: 44,
      size: 18,
      color: COLORS.ink,
      bold: true,
      face: FONTS.display,
    });
  }

  addShape(slide, "roundRect", {
    left: 862,
    top: 230,
    width: 300,
    height: 200,
    fill: COLORS.lime,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, "Recherche, tri, raccourcis et favoris aident à transformer un catalogue brut en espace de travail personnel.", {
    left: 888,
    top: 266,
    width: 248,
    height: 112,
    size: 19,
    color: COLORS.brown,
    bold: true,
    face: FONTS.display,
  });
  addFooter(slide, "Icônes réelles extraites du projet pour montrer la largeur du catalogue.");
}

async function slidePrivacy(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "Confidentialité", 6);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "La proposition de valeur reste compatible avec une vraie exigence de sobriété des données.", {
    left: 78,
    top: 186,
    width: 760,
    height: 130,
    size: 40,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Le repo insiste sur un principe simple : relayer les services existants sans construire une base applicative qui copie les comptes étudiants.", {
    left: 78,
    top: 326,
    width: 680,
    height: 90,
    size: 18,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
  addCard(slide, {
    left: 78,
    top: 482,
    width: 330,
    height: 224,
    accent: COLORS.lime,
    title: "Pas de base dédiée",
    body: "Le projet ne maintient pas de base applicative pour stocker les comptes étudiants.",
  });
  addCard(slide, {
    left: 438,
    top: 482,
    width: 330,
    height: 224,
    accent: COLORS.aqua,
    title: "Pas de secrets dans le navigateur",
    body: "Les identifiants ENT ne sont pas sérialisés côté client et ne finissent pas dans le cookie de session.",
  });
  addCard(slide, {
    left: 798,
    top: 482,
    width: 330,
    height: 224,
    accent: COLORS.gold,
    title: "Session en mémoire",
    body: "Pour conserver la compatibilité ADE, certains secrets peuvent rester temporairement en mémoire côté serveur pendant la session active.",
  });
  addShape(slide, "roundRect", {
    left: 78,
    top: 792,
    width: 1050,
    height: 250,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Mesures complémentaires", {
    left: 104,
    top: 824,
    width: 220,
    height: 24,
    size: 17,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addBulletList(slide, [
    "Caches sensibles nettoyés à la déconnexion et après échec de rafraîchissement.",
    "Menu debug réservé au développement, hors build de production.",
    "Rate limiting basique sur l'entrée de connexion.",
    "HTTPS et SESSION_SECRET fort restent nécessaires pour un déploiement sérieux.",
  ], {
    left: 108,
    top: 878,
    width: 950,
    gap: 38,
    size: 16,
  });
  addShape(slide, "ellipse", {
    left: 904,
    top: 202,
    width: 220,
    height: 220,
    fill: "#CDFFF56E",
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "roundRect", {
    left: 966,
    top: 266,
    width: 96,
    height: 128,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Trust", {
    left: 985,
    top: 314,
    width: 58,
    height: 18,
    size: 16,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
    align: "center",
    autoFit: null,
  });
  addFooter(slide, "Points directement documentés dans le README et la revue sécurité du projet.");
}

async function slideArchitecture(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addPageHeader(slide, "Architecture", 7);
  await addBrandMark(slide, { left: 78, top: 106, compact: true });
  addText(slide, "Une base technique moderne, légère et ouverte.", {
    left: 78,
    top: 186,
    width: 660,
    height: 108,
    size: 42,
    color: COLORS.ink,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "Frontend React 19, backend Express 5, PWA installable et intégrations réelles avec CAS, ENT, ADE, Planning, Notes9 et Open-Meteo.", {
    left: 78,
    top: 304,
    width: 700,
    height: 82,
    size: 18,
    color: COLORS.inkSoft,
    face: FONTS.body,
  });
  addShape(slide, "roundRect", {
    left: 78,
    top: 452,
    width: 620,
    height: 602,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Flux principal", {
    left: 104,
    top: 484,
    width: 200,
    height: 22,
    size: 17,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });

  const flowBoxes = [
    { left: 132, top: 560, width: 196, height: 82, label: "Étudiant", fill: COLORS.lime },
    { left: 390, top: 560, width: 196, height: 82, label: "l'ent", fill: COLORS.aqua },
    { left: 390, top: 704, width: 196, height: 82, label: "CAS / ENT", fill: COLORS.paper },
    { left: 132, top: 848, width: 196, height: 82, label: "ADE / Planning", fill: COLORS.paper },
    { left: 390, top: 848, width: 196, height: 82, label: "Notes9", fill: COLORS.paper },
  ];

  for (const box of flowBoxes) {
    addShape(slide, "roundRect", {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      fill: box.fill,
      lineFill: COLORS.line,
      lineWidth: 1,
    });
    addText(slide, box.label, {
      left: box.left,
      top: box.top + 26,
      width: box.width,
      height: 28,
      size: 22,
      color: COLORS.ink,
      bold: true,
      face: FONTS.display,
      align: "center",
      autoFit: null,
    });
  }

  addShape(slide, "rect", { left: 328, top: 600, width: 50, height: 2, fill: COLORS.line, lineFill: "#00000000", lineWidth: 0 });
  addShape(slide, "rect", { left: 488, top: 642, width: 2, height: 50, fill: COLORS.line, lineFill: "#00000000", lineWidth: 0 });
  addShape(slide, "rect", { left: 226, top: 786, width: 2, height: 50, fill: COLORS.line, lineFill: "#00000000", lineWidth: 0 });
  addShape(slide, "rect", { left: 488, top: 786, width: 2, height: 50, fill: COLORS.line, lineFill: "#00000000", lineWidth: 0 });

  addShape(slide, "roundRect", {
    left: 748,
    top: 452,
    width: 414,
    height: 256,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Stack", {
    left: 774,
    top: 484,
    width: 100,
    height: 22,
    size: 17,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addBulletList(slide, [
    "React 19 + Tailwind CSS 4 + Vite 7",
    "Node.js + Express 5",
    "PWA via service worker",
    "Code source publié sous AGPL-3.0",
  ], {
    left: 778,
    top: 538,
    width: 342,
    gap: 48,
    size: 18,
  });

  addShape(slide, "roundRect", {
    left: 748,
    top: 742,
    width: 414,
    height: 312,
    fill: COLORS.lime,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addText(slide, "Signal produit", {
    left: 776,
    top: 782,
    width: 180,
    height: 22,
    size: 17,
    color: COLORS.brown,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addText(slide, "Le projet a déjà une base présentable : intégrations réelles, branding distinctif, logique mobile et posture open source assumée.", {
    left: 776,
    top: 832,
    width: 354,
    height: 154,
    size: 24,
    color: COLORS.brown,
    bold: true,
    face: FONTS.display,
  });
  addFooter(slide, "Portée actuelle honnêtement documentée : tests surtout menés sur le BUT MMI à Lannion.");
}

async function slideClosing(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = COLORS.cream;
  addShape(slide, "rect", {
    left: 0,
    top: 0,
    width: 464,
    height: H,
    fill: COLORS.lime,
    lineFill: "#00000000",
    lineWidth: 0,
  });
  addShape(slide, "ellipse", {
    left: 236,
    top: 1060,
    width: 340,
    height: 340,
    fill: "#FFFFFF66",
    lineFill: "#00000000",
    lineWidth: 0,
  });
  await addBrandMark(slide, { left: 78, top: 82 });
  addText(slide, "Moins de friction.\nPlus de visibilité.\nUne meilleure entrée\ndans la vie étudiante numérique.", {
    left: 78,
    top: 208,
    width: 320,
    height: 320,
    size: 48,
    color: COLORS.brown,
    bold: true,
    face: FONTS.display,
  });
  addText(slide, "l'ent montre qu'un portail étudiant peut être plus simple, plus direct et plus agréable sans renier les services existants.", {
    left: 78,
    top: 574,
    width: 300,
    height: 160,
    size: 21,
    color: COLORS.brown,
    face: FONTS.body,
  });
  addBadge(slide, "Projet indépendant", { left: 78, top: 770, width: 174, fill: "#FFFFFFA8", color: COLORS.brown });
  addBadge(slide, "Open source", { left: 260, top: 770, width: 138, fill: "#FFFFFFA8", color: COLORS.brown });

  addText(slide, "Pourquoi il compte", {
    left: 528,
    top: 108,
    width: 220,
    height: 28,
    size: 16,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addCard(slide, {
    left: 528,
    top: 164,
    width: 620,
    height: 172,
    accent: COLORS.aqua,
    title: "Pour les étudiants",
    body: "Un produit plus rassurant à ouvrir chaque jour, qui rapproche l'information utile et réduit le coût cognitif du parcours ENT.",
  });
  addCard(slide, {
    left: 528,
    top: 366,
    width: 620,
    height: 172,
    accent: COLORS.gold,
    title: "Pour l'établissement",
    body: "Une preuve de concept concrète sur ce que peut être une expérience étudiante plus contemporaine et mobile-first.",
  });
  addCard(slide, {
    left: 528,
    top: 568,
    width: 620,
    height: 172,
    accent: COLORS.coral,
    title: "Pour le projet",
    body: "Une base crédible pour itérer, élargir la compatibilité au-delà du BUT MMI et transformer un prototype utile en vitrine forte.",
  });
  addShape(slide, "roundRect", {
    left: 528,
    top: 816,
    width: 620,
    height: 300,
    fill: COLORS.paper,
    lineFill: COLORS.line,
    lineWidth: 1,
  });
  addText(slide, "Repères finaux", {
    left: 556,
    top: 850,
    width: 180,
    height: 22,
    size: 17,
    color: COLORS.olive,
    bold: true,
    face: FONTS.mono,
    autoFit: null,
  });
  addBulletList(slide, [
    "Client non officiel, indépendant et non affilié à l'Université de Rennes.",
    "GitHub : tom-things/l-ent",
    "Stack moderne, PWA installable, logique privacy-first.",
  ], {
    left: 560,
    top: 910,
    width: 540,
    gap: 54,
    size: 18,
  });
  addFooter(slide, "Booklet marketing réalisé à partir des éléments réels du repo l'ent.");
}

async function saveBlobToFile(blob, outputPath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(outputPath, bytes);
}

async function build() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await slideCover(presentation);
  await slideProblem(presentation);
  await slideSolution(presentation);
  await slideMobile(presentation);
  await slideServices(presentation);
  await slidePrivacy(presentation);
  await slideArchitecture(presentation);
  await slideClosing(presentation);

  for (let index = 0; index < presentation.slides.items.length; index += 1) {
    const previewBlob = await presentation.export({
      slide: presentation.slides.items[index],
      format: "png",
      scale: 1,
    });
    await saveBlobToFile(previewBlob, path.join(PREVIEW_DIR, `slide-${String(index + 1).padStart(2, "0")}.png`));
  }

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUT_DIR, "l-ent-marketing-booklet.pptx");
  await pptxBlob.save(pptxPath);
  console.log(pptxPath);
}

await build();
