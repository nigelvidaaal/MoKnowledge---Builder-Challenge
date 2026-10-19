// Cleans up what the user typed and blocks URLs we should never fetch.

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Regex matching localhost and private network ranges. */
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i;

export function validateUrl(input: string): UrlCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a website address." };

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, error: "That doesn't look like a website address." };
  }

  if (!/^https?:$/.test(url.protocol)) return { ok: false, error: "Only http and https sites can be scraped." };
  if (!url.hostname.includes(".")) return { ok: false, error: "Include the full domain, like example.com." };
  if (PRIVATE_HOST.test(url.hostname)) return { ok: false, error: "That address isn't a public website." };

  url.hash = "";
  return { ok: true, url: url.toString() };
}
