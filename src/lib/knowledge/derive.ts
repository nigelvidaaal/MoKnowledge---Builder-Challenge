// Post-merge steps that need several extractors: people's photos and content starters.

import type { BrandImage, ContentStarter, FieldSource, KnowledgeBase, Offering } from "@/types/knowledge";
import { looksLikePersonName } from "@/lib/extractors/text";

export const DERIVED: FieldSource = { method: "derived", confidence: "medium" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "Kay C." -> "Kay C.", but a 200-character quote -> its first 140 characters + "…". */
const shorten = (s: string, max = 140) => (s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, "")}…` : s);

/** ["a","b","c"] -> "a, b and c". */
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The photo whose alt text is the person's name, or whose file name contains it. */
function photoFor(name: string, images: BrandImage[]): BrandImage | undefined {
  const full = slug(name);
  const first = full.split("-")[0];
  const file = (img: BrandImage) => slug(new URL(img.url).pathname.split("/").pop() ?? "");
  return (
    images.find((img) => img.alt && slug(img.alt) === full) ??
    images.find((img) => file(img).includes(full)) ??
    images.find((img) => first.length >= 3 && file(img).replace(/-?(jpe?g|png|webp)$/, "") === first)
  );
}

/** Attach matching headshots to people, then drop headshots from the gallery. */
export function attachPeoplePhotos(kb: KnowledgeBase): void {
  const images = kb.branding.images ?? [];
  const used = new Set<string>();
  for (const person of kb.people) {
    if (person.photo) continue;
    const match = photoFor(person.name, images.filter((img) => !used.has(img.url)));
    if (match) {
      person.photo = match.url;
      used.add(match.url);
    }
  }
  kb.branding.images = images.filter((img) => !used.has(img.url) && !(img.alt && looksLikePersonName(img.alt))).slice(0, 24);
}

/** Content ideas for each app, each quoting the real facts it's built on. */
export function buildContentStarters(kb: KnowledgeBase): ContentStarter[] {
  const out: ContentStarter[] = [];
  const name = kb.foundation.name ?? "the business";
  const cta = kb.market.ctas[0];
  const ctaLine = cta ? ` End with “${cta}”.` : "";
  const place = kb.foundation.serviceLocations[0] ?? null;
  const offerings = kb.offerings.filter((o) => o.name);
  const people = kb.people.filter((p) => p.name && p.title);
  const faqs = kb.extras.faqs;
  const reviews = kb.extras.testimonials.filter((t) => t.quote);
  const existingTitles = new Set(kb.extras.contentThemes.map((t) => slug(t)));
  const thisYear = new Date().getFullYear();

  // ---------- MoSocial: short, visual, frequent ----------
  for (const t of reviews.slice(0, 2)) {
    const who = t.author ?? "a recent customer";
    out.push({
      app: "MoSocial",
      type: "Customer spotlight",
      title: `What ${who} said about ${name}`,
      angle: `Quote the review: “${shorten(t.quote)}” Pair it with a real job-site photo and thank ${who} by first name.${ctaLine}`,
      basedOn: [`Testimonial from ${who}`],
    });
  }
  const person = people[0];
  if (person) {
    out.push({
      app: "MoSocial",
      type: "Meet the team",
      title: `Meet ${person.name}, our ${person.title}`,
      angle: `Introduce ${person.name.split(" ")[0]} with their photo${person.description ? ` and one detail from their bio: “${shorten(person.description, 120)}”` : ""}. Ask followers to say hi in the comments.`,
      basedOn: [`Key person: ${person.name}`],
    });
  }
  const featured = offerings.find((o) => o.description) ?? offerings[0];
  if (featured) {
    out.push({
      app: "MoSocial",
      type: "Service highlight",
      title: `${featured.name}: what's included`,
      angle: `${featured.description ? `Explain in two lines: “${shorten(featured.description, 120)}” ` : ""}${featured.features.length ? `List up to three features: ${list(featured.features.slice(0, 3))}. ` : ""}${featured.pricing ? `Mention “${featured.pricing}”.` : ""}${ctaLine}`.trim(),
      basedOn: [`Offering: ${featured.name}`],
    });
  }
  if (kb.foundation.yearFounded) {
    const years = thisYear - kb.foundation.yearFounded;
    out.push({
      app: "MoSocial",
      type: "Milestone",
      title: `${years} years serving ${place ?? "our community"}`,
      angle: `Celebrate ${years} years since ${kb.foundation.yearFounded}. Share an old photo next to a new one${kb.extras.trustSignals[0] ? ` and a proof point: “${shorten(kb.extras.trustSignals[0], 100)}”` : ""}.`,
      basedOn: [`Founded ${kb.foundation.yearFounded}`],
    });
  }
  const season = kb.extras.seasonalMessaging[0];
  if (season) {
    out.push({
      app: "MoSocial",
      type: "Seasonal",
      title: "Timely reminder",
      angle: `Build the post around this offer from the site: “${shorten(season)}”.${ctaLine}`,
      basedOn: ["Seasonal messaging"],
    });
  }

  // ---------- MoMail: a reason to open, one clear action ----------
  const priced = offerings.find((o) => o.pricing);
  if (priced) {
    out.push({
      app: "MoMail",
      type: "Offer email",
      title: `Subject: ${priced.pricing} on ${priced.name}`,
      angle: `Lead with the offer, explain who it's for in two sentences, then one button.${ctaLine}`,
      basedOn: [`Offering: ${priced.name}`, `Pricing: ${priced.pricing}`],
    });
  }
  const faq = faqs[0];
  if (faq) {
    out.push({
      app: "MoMail",
      type: "FAQ email",
      title: `Subject: ${faq.question}`,
      angle: `Answer it in three short paragraphs, starting from the site's own answer: “${shorten(faq.answer)}”.${ctaLine}`,
      basedOn: [`FAQ: ${faq.question}`],
    });
  }
  if (reviews.length || kb.extras.trustSignals.some((t) => /★|review/i.test(t))) {
    out.push({
      app: "MoMail",
      type: "Review request",
      title: `Subject: How did we do?`,
      angle: `Thank recent customers, show one existing review as an example${reviews[0]?.author ? ` (${reviews[0].author}'s)` : ""}, and link to the review page.`,
      basedOn: reviews[0] ? [`Testimonial from ${reviews[0].author ?? "a customer"}`] : ["Review rating"],
    });
  }
  if (offerings.length >= 2) {
    out.push({
      app: "MoMail",
      type: "Newsletter",
      title: `Subject: This month at ${name}`,
      angle: `Three short blocks: one tip about ${offerings[0].name.toLowerCase()}, one about ${offerings[1].name.toLowerCase()}, and one customer quote or team photo.${ctaLine}`,
      basedOn: [`Offering: ${offerings[0].name}`, `Offering: ${offerings[1].name}`],
    });
  }

  // ---------- MoBlogs: answer real questions, target local search ----------
  const articleFaqs = faqs.filter((f) => !existingTitles.has(slug(f.question))).slice(0, 3);
  for (const f of articleFaqs) {
    out.push({
      app: "MoBlogs",
      type: "Answer article",
      title: f.question,
      angle: `Expand the site's answer into a full guide (what it depends on, typical timeline or cost, when to call a pro): “${shorten(f.answer)}”.`,
      basedOn: [`FAQ: ${f.question}`],
    });
  }
  for (const o of offerings.slice(0, 2)) {
    const title = `${o.name}${place ? ` in ${place}` : ""}: what to expect`;
    if (existingTitles.has(slug(title))) continue;
    out.push({
      app: "MoBlogs",
      type: "Local service guide",
      title,
      angle: `Walk through the process step by step${o.features.length ? `, covering ${list(o.features.slice(0, 3))}` : ""}${o.pricing ? `, and explain “${o.pricing}”` : ""}. Use the city name naturally for local search.`,
      basedOn: [`Offering: ${o.name}`, ...(place ? [`Service area: ${place}`] : [])],
    });
  }
  const pair = comparablePair(offerings);
  if (pair) {
    const [a, b] = pair;
    out.push({
      app: "MoBlogs",
      type: "Comparison",
      title: `${a.name} vs. ${b.name}: which do you need?`,
      angle: `Compare who each is for, using only the details on the site${a.description || b.description ? " (both service descriptions are in the knowledge base)" : ""}.`,
      basedOn: [`Offering: ${a.name}`, `Offering: ${b.name}`],
    });
  }

  return out;
}

/** Two offerings worth comparing, i.e. whose names share a real word. */
function comparablePair(offerings: Offering[]): [Offering, Offering] | null {
  const STOP = new Set(["service", "services", "and", "the", "for", "with", "your", "our", "options", "system", "systems"]);
  const words = (o: Offering) => new Set(o.name.toLowerCase().split(/\W+/).filter((w) => w.length >= 4 && !STOP.has(w)));
  // Short names only: long names that share a word usually aren't alternatives.
  const short = offerings.filter((o) => o.name.split(/\s+/).length <= 3);
  offerings = short;
  for (let i = 0; i < offerings.length; i++) {
    for (let j = i + 1; j < offerings.length; j++) {
      const a = words(offerings[i]);
      if ([...words(offerings[j])].some((w) => a.has(w))) return [offerings[i], offerings[j]];
    }
  }
  return null;
}

export function deriveAll(kb: KnowledgeBase): void {
  attachPeoplePhotos(kb);
  const starters = buildContentStarters(kb);
  kb.extras.contentStarters = starters;
  if (starters.length) kb.sources["extras.contentStarters"] = DERIVED;
}
