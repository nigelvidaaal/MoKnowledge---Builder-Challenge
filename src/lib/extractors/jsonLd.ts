// Extractor 1: schema.org JSON-LD (the most reliable source).

import type { Faq, FieldSource, Offering, Person, Testimonial } from "@/types/knowledge";
import type { Extractor } from "./types";
import { result } from "./types";
import { formatPhone, looksLikePersonName } from "./text";

type Json = Record<string, unknown>;

/** Types that describe the business itself. */
const ORG_TYPES = /Organization|LocalBusiness|Corporation|Store|Agency|Service|Contractor|Company/i;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function typesOf(node: Json): string[] {
  return asArray(node["@type"] as string | string[]).map(String);
}

/** Collects every JSON object, including those nested in "@graph" arrays. */
function collectNodes(raw: unknown, out: Json[] = []): Json[] {
  for (const item of asArray(raw)) {
    if (typeof item !== "object" || item === null) continue;
    const node = item as Json;
    out.push(node);
    // WordPress SEO plugins nest every node inside "@graph", so walk into it.
    if (node["@graph"]) collectNodes(node["@graph"], out);
  }
  return out;
}

function formatAddress(addr: unknown): string | null {
  if (typeof addr === "string") return addr.trim() || null;
  const a = (Array.isArray(addr) ? addr[0] : addr) as Json | undefined;
  if (!a || typeof a !== "object") return null;
  const parts = [a.streetAddress, a.addressLocality, [a.addressRegion, a.postalCode].filter(Boolean).join(" ")]
    .map(str)
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export const jsonLdExtractor: Extractor = {
  name: "json-ld",
  run(ctx) {
    const nodes: { node: Json; url: string }[] = [];

    for (const page of ctx.pages) {
      page.$('script[type="application/ld+json"]').each((_, el) => {
        try {
          const parsed = JSON.parse(page.$(el).contents().text());
          for (const node of collectNodes(parsed)) nodes.push({ node, url: page.url });
        } catch {
          // Some sites ship malformed JSON-LD. Skip it rather than fail the scrape.
        }
      });
    }

    const out = result();
    const src = (url: string): FieldSource => ({ method: "json-ld", confidence: "high", url });
    const set = (path: string, url: string) => (out.sources[path] = src(url));

    const foundation: NonNullable<typeof out.data.foundation> = {};
    const people: Person[] = [];
    const offerings: Offering[] = [];
    const faqs: Faq[] = [];
    const testimonials: Testimonial[] = [];

    for (const { node, url } of nodes) {
      const types = typesOf(node);
      const looksLikeBusiness = !!(node.address || node.telephone);
      const isOrg =
        !!str(node.name) &&
        !types.includes("WebSite") &&
        !types.includes("Person") &&
        (types.some((t) => ORG_TYPES.test(t)) || looksLikeBusiness);

      if (isOrg) {
        if (!foundation.name && str(node.name)) {
          foundation.name = str(node.name);
          set("foundation.name", url);
        }
        if (!foundation.overview && str(node.description)) {
          foundation.overview = str(node.description);
          set("foundation.overview", url);
        }
        const year = str(node.foundingDate)?.match(/\d{4}/)?.[0];
        if (year && !foundation.yearFounded) {
          foundation.yearFounded = Number(year);
          set("foundation.yearFounded", url);
        }
        const address = formatAddress(node.address);
        if (address && !foundation.mainAddress) {
          foundation.mainAddress = address;
          set("foundation.mainAddress", url);
        }
        if (!foundation.phone && str(node.telephone)) {
          foundation.phone = formatPhone(str(node.telephone)!);
          set("foundation.phone", url);
        }
        if (!foundation.email && str(node.email)) {
          foundation.email = str(node.email)!.replace(/^mailto:/, "");
          set("foundation.email", url);
        }
        // numberOfEmployees can be a number or an object like { value: 25 }; handle both.
        const employees = str((node.numberOfEmployees as Json)?.value ?? node.numberOfEmployees);
        if (employees) {
          foundation.employeeCount = employees;
          set("foundation.employeeCount", url);
        }
        // The specific @type ("Plumber", "InsuranceAgency") is a strong industry hint.
        const specific = types.find((t) => !/^(Organization|LocalBusiness|Corporation)$/i.test(t));
        if (specific && !foundation.industry) {
          foundation.industry = specific.replace(/([a-z])([A-Z])/g, "$1 $2");
          out.sources["foundation.industry"] = { method: "json-ld", confidence: "medium", url };
        }
        const alt = asArray(node.alternateName as string | string[]).map(str).filter((s): s is string => !!s);
        if (alt.length) {
          foundation.altNames = alt;
          set("foundation.altNames", url);
        }
        const areas = asArray(node.areaServed as unknown[])
          // areaServed items can be plain text or objects like { "@type": "City", name: "Austin" }.
          .map((a) => str(a) ?? str((a as Json)?.name))
          .filter((s): s is string => !!s);
        if (areas.length) {
          foundation.serviceLocations = areas;
          set("foundation.serviceLocations", url);
        }
        for (const f of asArray(node.founder as Json | Json[])) {
          // Founder can be a Person object; keep it only if the name looks like a real person.
          if (str(f?.name) && looksLikePersonName(str(f.name)!)) {
            people.push({ name: str(f.name)!, title: "Founder", gender: null, description: null });
          }
        }
        // logo can be a URL string or an ImageObject with a url property.
        const logo = str(node.logo) ?? str((node.logo as Json)?.url);
        if (logo) {
          out.data.branding = { logos: [new URL(logo, url).toString()] };
          set("branding.logos", url);
        }
        const rating = node.aggregateRating as Json | undefined;
        for (const r of asArray(node.review as Json | Json[])) {
          const quote = str(r?.reviewBody);
          if (quote) {
            testimonials.push({
              quote,
              // author can be { name: "Kay C." } or just "Kay C.".
              author: str((r.author as Json)?.name ?? r.author),
              rating: Number((r.reviewRating as Json)?.ratingValue) || null,
            });
          }
        }
        if (rating && str(rating.ratingValue)) {
          out.data.extras = {
            ...(out.data.extras ?? {}),
            // Turn aggregateRating into a readable trust signal: "4.9★ average from 120 reviews".
            trustSignals: [`${str(rating.ratingValue)}★ average from ${str(rating.reviewCount ?? rating.ratingCount) ?? "multiple"} reviews`],
          };
          set("extras.trustSignals", url);
        }
      }

      // WordPress SEO plugins add the post author as a Person.
      if (types.includes("Person") && str(node.name) && looksLikePersonName(str(node.name)!)) {
        people.push({ name: str(node.name)!, title: str(node.jobTitle), gender: null, description: str(node.description) });
      }

      if (types.some((t) => /^(Service|Product|Offer)$/.test(t)) && str(node.name)) {
        offerings.push({
          name: str(node.name)!,
          category: types[0],
          description: str(node.description),
          features: [],
          pricing: str((node.offers as Json)?.price) ?? null,
          url: str(node.url),
        });
      }

      // An FAQPage lists Question nodes in mainEntity, each with an acceptedAnswer.
      if (types.includes("FAQPage")) {
        for (const q of asArray(node.mainEntity as Json | Json[])) {
          const question = str(q?.name);
          const answer = str((q?.acceptedAnswer as Json)?.text);
          if (question && answer) faqs.push({ question, answer: answer.replace(/<[^>]+>/g, "") });
        }
      }
    }

    if (Object.keys(foundation).length) out.data.foundation = foundation;
    if (people.length) {
      out.data.people = people;
      out.sources["people"] = src(ctx.home.url);
    }
    if (offerings.length) {
      out.data.offerings = offerings;
      out.sources["offerings"] = src(ctx.home.url);
    }
    if (faqs.length || testimonials.length) {
      out.data.extras = { ...(out.data.extras ?? {}), faqs, testimonials };
      if (faqs.length) out.sources["extras.faqs"] = src(ctx.home.url);
      if (testimonials.length) out.sources["extras.testimonials"] = src(ctx.home.url);
    }
    return out;
  },
};
