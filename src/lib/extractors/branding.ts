// Extractor 5: brand colors, fonts and logos.

import type { Extractor } from "./types";
import { result } from "./types";
import { rankByFrequency } from "./text";

const HEX = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;

const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;

// A CSS variable whose name contains primary/brand/accent/...
const BRAND_VAR = /--[\w-]*(?:primary|brand|accent|secondary|main|theme)[\w-]*\s*:\s*(#[0-9a-f]{3,6}\b|rgba?\([^)]*\))/gi;
/** System and fallback fonts (sans-serif, Arial, Helvetica...). */
const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
  "ui-monospace", "-apple-system", "blinkmacsystemfont", "inherit", "initial", "unset", "arial",
  "helvetica", "helvetica neue", "times new roman", "segoe ui", "roboto", "apple color emoji",
  "segoe ui emoji", "segoe ui symbol", "noto color emoji", "georgia", "verdana", "tahoma",
  "courier new", "var", "font awesome", "fontawesome", "dashicons", "eicons", "icomoon",
]);

/** Icon fonts (Divi's ETmodules, Font Awesome, form plugins) aren't brand typography. */
const ICON_FONT = /icon|modules|awesome|glyph|dashicons|eicons|gform|slick|swiper|fontello|ionicons|material symbols/i;

function toHex(color: string): string | null {
  const c = color.trim().toLowerCase();
  if (c.startsWith("#")) {
    // Expand short hex: #abc -> #aabbcc (each digit doubled).
    if (c.length === 4) return "#" + [...c.slice(1)].map((ch) => ch + ch).join("");
    return c.length === 7 ? c : null;
  }
  const m = c.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (!m) return null;
  return "#" + m.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("");
}

/** Default colors shipped by popular themes and page builders. */
const THEME_DEFAULTS = new Set([
  "#2ea3f2", "#7cda24", "#e09900", "#e02b20", "#29c4a9", // Divi (incl. safe-mode badge)
  "#dc3232", "#46b450", "#ffb900", "#00a0d2", // Contact Form 7 validation
  "#0073aa", "#00a0d2", "#23282d", "#cf2e2e", "#ff6900", "#fcb900", "#7bdcb5", "#00d084", "#8ed1fc", "#0693e3", "#abb8c3", "#9b51e0", "#f78da7", "#e6db55", "#fffbcc", "#007cba", "#006ba1", "#005a87", // WordPress
  "#007bff", "#6c757d", "#28a745", "#dc3545", "#ffc107", "#17a2b8", "#0d6efd", "#198754", // Bootstrap
  "#6ec1e4", "#54595f", "#7a7a7a", "#61ce70", // Elementor
  "#4285f4", "#34a853", "#fbbc05", "#ea4335", "#1877f2", "#3b5998", "#1da1f2", "#0a66c2", "#ff0000", "#e4405f", // Google / social icons
]);

/** Greys (including white and black) have nearly equal R, G and B. */
function isNeutral(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // If the three channels are nearly equal, the color is a grey (or white/black).
  return Math.max(r, g, b) - Math.min(r, g, b) < 18;
}

export const brandingExtractor: Extractor = {
  name: "branding",
  run(ctx) {
    const { home } = ctx;
    const $ = home.$;

    // ---- Colors ----
    const css = [
      ...$("style").map((_, el) => $(el).text()).get(),
      ...$("[style]").map((_, el) => $(el).attr("style") ?? "").get(),
      ...ctx.stylesheets,
    ].join("\n");

    const found: string[] = [];
    for (const m of css.match(HEX) ?? []) {
      const hex = toHex(m);
      if (hex) found.push(hex);
    }
    for (const m of css.matchAll(RGB)) {
      const hex = toHex(m[0]);
      if (hex) found.push(hex);
    }
    // Named brand variables and the browser theme color count 5x.
    const strong = [...css.matchAll(BRAND_VAR)].map((m) => m[1]);
    const themeColor = $('meta[name="theme-color"]').attr("content");
    if (themeColor) strong.push(themeColor);
    for (const c of strong) {
      const hex = toHex(c);
      // Add strong colors 5 times so they rank above colors that just appear often.
      if (hex) for (let i = 0; i < 5; i++) found.push(hex);
    }

    const ranked = rankByFrequency(found.filter((h) => !THEME_DEFAULTS.has(h)));
    const brand = ranked.filter((h) => !isNeutral(h)).slice(0, 4);
    const neutrals = ranked.filter(isNeutral).slice(0, 2);
    const colors = [...brand, ...neutrals];

    // ---- Fonts ----
    const fonts: string[] = [];
    $('link[href*="fonts.googleapis.com"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      // Google Fonts links: css2 (family=A&family=B) and v1 (family=A|B).
      for (const m of decodeURIComponent(href).matchAll(/family=([^&]+)/g)) {
        for (const part of m[1].split("|")) {
          // "Open+Sans:300,400" -> "Open Sans": drop the weights after :, turn + into spaces.
          const name = part.split(":")[0].replace(/\+/g, " ").trim();
          if (name && !fonts.includes(name)) fonts.push(name);
        }
      }
    });
    const declared: string[] = [];
    for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      for (const raw of m[1].split(",")) {
        const name = raw.replace(/["']/g, "").replace(/!important/, "").trim();
        // Skip generic, icon and placeholder fonts.
        if (name && !GENERIC_FONTS.has(name.toLowerCase()) && !ICON_FONT.test(name) && !name.startsWith("var(") && !/placeholder/i.test(name) && name.length < 40) {
          declared.push(name);
        }
      }
    }
    for (const f of rankByFrequency(declared)) {
      if (!fonts.some((x) => x.toLowerCase() === f.toLowerCase())) fonts.push(f);
    }

    // ---- Logos ----
    const logos: string[] = [];
    const logoImg = (scope: string) =>
      $(`${scope} img`)
        .filter((_, el) => {
          const a = $(el);
          return /logo/i.test(`${a.attr("src")} ${a.attr("alt")} ${a.attr("class")} ${a.attr("id")} ${a.parent().attr("class")}`);
        })
        .first();
    // Prefer a logo in the header; otherwise search the whole page.
    const img = logoImg("header").length ? logoImg("header") : logoImg("body");
    // Lazy-loading sites put the real URL in data-src or srcset instead of src.
    const src = img.attr("src") ?? img.attr("data-src") ?? img.attr("srcset")?.split(" ")[0];
    if (src && !src.startsWith("data:")) logos.push(new URL(src, home.url).toString());
    // The site icon (favicon) as a backup logo; last() usually picks the largest size.
    const icon = $('link[rel="apple-touch-icon"], link[rel="icon"]').last().attr("href");
    if (icon && !icon.startsWith("data:")) logos.push(new URL(icon, home.url).toString());

    const out = result({ branding: {} });
    const src_ = (confidence: "high" | "medium" | "low") => ({ method: "css" as const, confidence, url: home.url });
    if (colors.length) {
      out.data.branding!.colors = colors;
      out.sources["branding.colors"] = src_("medium");
    }
    if (fonts.length) {
      out.data.branding!.fonts = fonts.slice(0, 4);
      out.sources["branding.fonts"] = src_(fonts.length && $('link[href*="fonts.googleapis.com"]').length ? "high" : "medium");
    }
    if (logos.length) {
      out.data.branding!.logos = logos;
      out.sources["branding.logos"] = { method: "html", confidence: "high", url: home.url };
    }
    return out;
  },
};
