// Generates the placeholder product and hero illustrations in frontend/public.
// Replace them with real photos by uploading images in the admin panel.
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../frontend/public/", import.meta.url);
mkdirSync(new URL("products/", out), { recursive: true });

const cats = {
  1: { bg: ["#fde4ec", "#f9c9d9"], fg: "#7a4a35", name: "cake" },
  2: { bg: ["#fbefd9", "#f1d6a6"], fg: "#7a4a35", name: "bread" },
  3: { bg: ["#fff1dc", "#f6d9ae"], fg: "#8a5a3a", name: "pastry" },
  4: { bg: ["#f7e6e0", "#efc9bd"], fg: "#6d3f2a", name: "cookie" },
};
const products = [
  ["Chocolate Truffle Cake", 1], ["Red Velvet Cake", 1], ["Strawberry Shortcake", 1], ["Lemon Drizzle Cake", 1],
  ["Sourdough Loaf", 2], ["Multigrain Loaf", 2], ["Garlic Rosemary Focaccia", 2], ["Cinnamon Raisin Bread", 2],
  ["Butter Croissant", 3], ["Pain au Chocolat", 3], ["Almond Danish", 3], ["Blueberry Muffin", 3],
  ["Chocolate Chip Cookies", 4], ["Oatmeal Raisin Cookies", 4], ["Pink Rose Macarons", 4],
];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function icon(kind, v) {
  const brown = "#8a5a3a", dark = "#5b3524", pink = "#f4a9c0", cream = "#fff6e8";
  const r = v === 0 ? 0 : v === 1 ? 12 : -10;
  if (kind === "cake")
    return `<g transform="rotate(${r} 300 320)"><ellipse cx="300" cy="400" rx="190" ry="40" fill="#e8cdb8"/>
      <rect x="150" y="270" width="300" height="130" rx="18" fill="${brown}"/><rect x="150" y="270" width="300" height="46" rx="18" fill="${dark}"/>
      <rect x="150" y="330" width="300" height="14" fill="${cream}"/>
      <ellipse cx="300" cy="270" rx="150" ry="30" fill="${pink}"/>
      <circle cx="240" cy="258" r="14" fill="#d9467a"/><circle cx="300" cy="250" r="14" fill="#d9467a"/><circle cx="360" cy="258" r="14" fill="#d9467a"/></g>`;
  if (kind === "bread")
    return `<g transform="rotate(${r} 300 320)"><ellipse cx="300" cy="400" rx="200" ry="36" fill="#e8cdb8"/>
      <path d="M110 380 C100 250 190 200 300 200 C410 200 500 250 490 380 Z" fill="#d79a52"/>
      <path d="M200 240 L240 330 M290 220 L320 330 M380 240 L400 330" stroke="#f3d29a" stroke-width="14" stroke-linecap="round" fill="none"/></g>`;
  if (kind === "pastry")
    return `<g transform="rotate(${r} 300 320)"><ellipse cx="300" cy="410" rx="200" ry="34" fill="#e8cdb8"/>
      <path d="M110 380 Q130 250 300 240 Q470 250 490 380 Q400 340 300 350 Q200 340 110 380Z" fill="#e0a85a"/>
      <path d="M170 300 Q300 270 430 300 M150 340 Q300 305 450 340" stroke="#f3cf8f" stroke-width="14" fill="none" stroke-linecap="round"/></g>`;
  return `<g transform="rotate(${r} 300 320)"><ellipse cx="300" cy="410" rx="200" ry="34" fill="#e8cdb8"/>
      <circle cx="240" cy="330" r="86" fill="#d9a066"/><circle cx="370" cy="350" r="76" fill="#e1ad73"/>
      <g fill="${dark}"><circle cx="215" cy="310" r="9"/><circle cx="265" cy="350" r="9"/><circle cx="240" cy="290" r="8"/><circle cx="360" cy="330" r="9"/><circle cx="395" cy="370" r="8"/></g>
      <circle cx="450" cy="300" r="30" fill="${pink}"/></g>`;
}

for (const [name, cat] of products) {
  const c = cats[cat];
  const slug = slugify(name);
  for (let v = 0; v < 3; v++) {
    const file = v === 0 ? `${slug}.svg` : `${slug}-${v + 1}.svg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${name}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset="1" stop-color="${c.bg[1]}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="${v === 1 ? 120 : 480}" cy="120" r="${60 + v * 10}" fill="#ffffff" opacity=".35"/>
${icon(c.name, v)}
<text x="300" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="${c.fg}">${name}</text>
</svg>`;
    writeFileSync(new URL(`products/${file}`, out), svg);
  }
}

writeFileSync(new URL("hero.svg", out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 640" role="img" aria-label="Fresh baked goods">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde4ec"/><stop offset="1" stop-color="#f6d9ae"/></linearGradient></defs>
<rect width="800" height="640" rx="48" fill="url(#g)"/>
<circle cx="610" cy="130" r="90" fill="#fff" opacity=".4"/><circle cx="130" cy="520" r="70" fill="#fff" opacity=".35"/>
<ellipse cx="400" cy="500" rx="270" ry="50" fill="#e8cdb8"/>
<rect x="220" y="320" width="360" height="170" rx="24" fill="#8a5a3a"/><rect x="220" y="320" width="360" height="56" rx="24" fill="#5b3524"/>
<rect x="220" y="400" width="360" height="16" fill="#fff6e8"/>
<ellipse cx="400" cy="320" rx="180" ry="38" fill="#f4a9c0"/>
<circle cx="330" cy="304" r="18" fill="#d9467a"/><circle cx="400" cy="294" r="18" fill="#d9467a"/><circle cx="470" cy="304" r="18" fill="#d9467a"/>
<path d="M120 500 C112 420 170 390 230 390 C290 390 340 420 330 500Z" fill="#d79a52"/>
</svg>`);
console.log("images written");
