// Capture a website for offline replay (npm run replay -- captures/<name>.json).
//
// 1. Open the site's homepage in a browser.
// 2. Paste this into the DevTools console and press Enter.
// 3. A capture-<site>.json file downloads when it finishes (about a minute).
//
// It saves the homepage, robots.txt, sitemaps, up to 25 same-site menu/header
// links, and the site's own stylesheets, with a pause between requests.
(async () => {
  const origin = location.origin;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (u) => {
    try {
      const r = await fetch(u, { credentials: "omit" });
      return { status: r.status, text: await r.text() };
    } catch {
      return { status: 0, text: "" };
    }
  };
  const cap = { origin, capturedAt: new Date().toISOString(), files: {} };
  const save = async (path) => {
    if (!cap.files[path]) cap.files[path] = await get(origin + path);
  };
  await save("/");
  for (const p of ["/robots.txt", "/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) await save(p);
  const doc = new DOMParser().parseFromString(cap.files["/"].text, "text/html");
  const paths = new Set();
  for (const a of doc.querySelectorAll("nav a[href], header a[href], ul[id*=menu] a[href], ul[class*=menu] a[href], footer a[href], main a[href]")) {
    try {
      const u = new URL(a.getAttribute("href"), origin);
      if (u.origin !== origin || /\.(pdf|jpe?g|png|zip)$/i.test(u.pathname)) continue;
      if (u.pathname !== "/") paths.add(u.pathname);
    } catch {}
  }
  for (const p of [...paths].slice(0, 25)) {
    await save(p);
    await sleep(400);
  }
  const sheets = [...doc.querySelectorAll('link[rel="stylesheet"][href]')]
    .map((l) => new URL(l.getAttribute("href"), origin))
    .filter((u) => u.origin === origin)
    .slice(0, 4);
  for (const u of sheets) cap.files[u.pathname + u.search] = await get(u.href);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(cap)], { type: "application/json" }));
  a.download = `capture-${location.hostname.replace(/^www\./, "").split(".")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  console.log("Captured", Object.keys(cap.files).length, "files");
})();
