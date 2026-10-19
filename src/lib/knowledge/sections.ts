// Config for how every section and field is shown and edited.

import type { KnowledgeBase } from "@/types/knowledge";
import { getPath } from "./path";

export type FieldKind = "text" | "textarea" | "number" | "list" | "colors" | "images" | "records";

export interface RecordColumn {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "list" | "image";
  rows?: number;
  wide?: boolean;
}

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  help?: string;
  placeholder?: string;
  columns?: RecordColumn[];
  blank?: Record<string, unknown>;
  /** For textareas: the minimum height in lines, for fields people write long text in. */
  rows?: number;
  /** Nice to have, not expected: doesn't stop a section from counting as complete. */
  optional?: boolean;
  /** For kind "records": how one item is named and listed in the master list. */
  item?: { label: string; titleKey: string; subtitleKey?: string | string[] };
}

export interface SectionDef {
  id: string;
  title: string;
  description: string;
  beyondBaseline?: boolean;
  fields: FieldDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: "foundation",
    title: "Company foundation",
    description: "Who the business is and where it operates.",
    fields: [
      { path: "foundation.name", label: "Company name", kind: "text" },
      { path: "foundation.overview", label: "Overview", kind: "textarea" },
      { path: "foundation.website", label: "Website", kind: "text" },
      { path: "foundation.industry", label: "Industry", kind: "text" },
      { path: "foundation.businessModel", label: "Business model", kind: "textarea" },
      { path: "foundation.companyRole", label: "Company role", kind: "text", optional: true },
      { path: "foundation.yearFounded", label: "Year founded", kind: "number" },
      { path: "foundation.legalEntityType", label: "Legal entity type", kind: "text", placeholder: "LLC, Inc…", optional: true },
      { path: "foundation.employeeCount", label: "Employee count", kind: "text", optional: true },
      { path: "foundation.phone", label: "Phone", kind: "text" },
      { path: "foundation.email", label: "Email", kind: "text" },
      { path: "foundation.mainAddress", label: "Main address", kind: "text" },
      { path: "foundation.otherLocations", label: "Other locations", kind: "list", optional: true },
      { path: "foundation.serviceLocations", label: "Service locations", kind: "list" },
      { path: "foundation.altNames", label: "Alternative names", kind: "list", optional: true },
    ],
  },
  {
    id: "positioning",
    title: "Positioning",
    description: "Why a customer should choose them.",
    fields: [
      { path: "positioning.pitch", label: "Pitch", kind: "textarea" },
      { path: "positioning.foundingStory", label: "Founding story", kind: "textarea", rows: 10 },
    ],
  },
  {
    id: "market",
    title: "Market & customers",
    description: "Who they sell to and how customers reach them.",
    fields: [
      { path: "market.buyers", label: "Target buyers", kind: "list" },
      { path: "market.customerNeeds", label: "Customer needs", kind: "textarea" },
      { path: "market.idealPersona", label: "Ideal customer persona", kind: "textarea" },
      { path: "market.industryGroupings", label: "Industry groupings", kind: "list", optional: true },
      { path: "market.industryOutlook", label: "Industry outlook", kind: "textarea", optional: true },
      { path: "market.channels", label: "Channels", kind: "list" },
      { path: "market.funnels", label: "Funnels", kind: "list" },
      { path: "market.ctas", label: "Calls to action", kind: "list" },
      { path: "market.suppliers", label: "Suppliers & partners", kind: "list", optional: true },
    ],
  },
  {
    id: "branding",
    title: "Branding & style",
    description: "How the brand looks and sounds.",
    fields: [
      { path: "branding.writingStyle", label: "Writing style", kind: "textarea" },
      { path: "branding.artStyle", label: "Art style", kind: "textarea", optional: true },
      { path: "branding.colors", label: "Brand colors", kind: "colors" },
      { path: "branding.fonts", label: "Fonts", kind: "list" },
      { path: "branding.logos", label: "Logo URLs", kind: "list", optional: true },
      {
        path: "branding.images",
        label: "Brand photos",
        kind: "images",
        optional: true,
        help: "Real photos from the site for MoSocial posts. Remove any that aren't the business's own work.",
      },
    ],
  },
  {
    id: "onlinePresence",
    title: "Online presence",
    description: "Where the business is active online.",
    fields: [
      {
        path: "onlinePresence.socials",
        label: "Social profiles",
        kind: "records",
        columns: [
          { key: "platform", label: "Platform", kind: "text" },
          { key: "url", label: "URL", kind: "text", wide: true },
        ],
        blank: { platform: "", url: "" },
        item: { label: "profile", titleKey: "platform", subtitleKey: "url" },
      },
    ],
  },
  {
    id: "people",
    title: "Key people",
    description: "The faces and names customers know.",
    fields: [
      {
        path: "people",
        label: "People",
        kind: "records",
        columns: [
          { key: "name", label: "Name", kind: "text" },
          { key: "title", label: "Title", kind: "text" },
          { key: "gender", label: "Gender", kind: "text" },
          { key: "description", label: "Description", kind: "textarea", wide: true, rows: 8 },
          { key: "photo", label: "Photo", kind: "image", wide: true },
        ],
        blank: { name: "", title: null, gender: null, description: null, photo: null },
        item: { label: "person", titleKey: "name", subtitleKey: "title" },
      },
    ],
  },
  {
    id: "offerings",
    title: "Offerings",
    description: "Products and services, with features and pricing.",
    fields: [
      {
        path: "offerings",
        label: "Offerings",
        kind: "records",
        columns: [
          { key: "name", label: "Name", kind: "text" },
          { key: "category", label: "Category", kind: "text" },
          { key: "pricing", label: "Pricing", kind: "text" },
          { key: "description", label: "Description", kind: "textarea", wide: true },
          { key: "features", label: "Features", kind: "list", wide: true },
          { key: "url", label: "Page URL", kind: "text", wide: true },
        ],
        blank: { name: "", category: null, description: null, features: [], pricing: null, url: null },
        item: { label: "offering", titleKey: "name", subtitleKey: "category" },
      },
    ],
  },
  {
    id: "voice",
    title: "Voice & differentiators",
    description: "The company's own words, used as examples so generated content sounds like them.",
    beyondBaseline: true,
    fields: [
      { path: "extras.voiceSamples", label: "Voice samples", kind: "list", help: "Real sentences from the site. Writers imitate examples better than adjectives." },
      { path: "extras.uniqueSellingPoints", label: "Differentiators", kind: "list" },
      { path: "extras.contentThemes", label: "Content themes", kind: "list", help: "Topics they already talk about. Good starting points for blog posts." },
      { path: "extras.seasonalMessaging", label: "Seasonal & promotional messaging", kind: "list", optional: true },
    ],
  },
  {
    id: "proof",
    title: "Social proof & trust",
    description: "Evidence to cite instead of vague claims.",
    beyondBaseline: true,
    fields: [
      {
        path: "extras.testimonials",
        label: "Testimonials",
        kind: "records",
        columns: [
          { key: "quote", label: "Quote", kind: "textarea", wide: true },
          { key: "author", label: "Author", kind: "text" },
          { key: "rating", label: "Rating", kind: "number" },
        ],
        blank: { quote: "", author: null, rating: null },
        item: { label: "testimonial", titleKey: "author", subtitleKey: "quote" },
      },
      { path: "extras.trustSignals", label: "Trust signals", kind: "list", help: "Licenses, warranties, ratings, years in business." },
      { path: "extras.pressMentions", label: "Press mentions", kind: "list", optional: true },
      { path: "extras.communityAndValues", label: "Community & values", kind: "list", optional: true },
    ],
  },
  {
    id: "faqs",
    title: "Customer questions",
    description: "Each question is a ready-made post, email or article topic.",
    beyondBaseline: true,
    fields: [
      {
        path: "extras.faqs",
        label: "FAQs",
        kind: "records",
        columns: [
          { key: "question", label: "Question", kind: "text", wide: true },
          { key: "answer", label: "Answer", kind: "textarea", wide: true },
        ],
        blank: { question: "", answer: "" },
        item: { label: "question", titleKey: "question", subtitleKey: "answer" },
      },
    ],
  },
  {
    id: "starters",
    title: "Content starters",
    description: "Ready ideas for MoSocial, MoMail and MoBlogs, built only from the facts above. Edit, delete or rebuild them.",
    beyondBaseline: true,
    fields: [
      {
        path: "extras.contentStarters",
        label: "Ideas",
        kind: "records",
        columns: [
          { key: "title", label: "Headline or subject", kind: "text", wide: true },
          { key: "app", label: "App", kind: "text" },
          { key: "type", label: "Type", kind: "text" },
          { key: "angle", label: "How to write it", kind: "textarea", wide: true, rows: 4 },
          { key: "basedOn", label: "Based on these facts", kind: "list", wide: true },
        ],
        blank: { app: "MoSocial", type: "", title: "", angle: "", basedOn: [] },
        item: { label: "idea", titleKey: "title", subtitleKey: ["app", "type"] },
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance",
    description: "Legal language that generated content must respect.",
    beyondBaseline: true,
    fields: [
      { path: "extras.compliance.privacyPolicyUrl", label: "Privacy policy", kind: "text" },
      { path: "extras.compliance.termsUrl", label: "Terms of service", kind: "text" },
      { path: "extras.compliance.disclaimers", label: "Disclaimers", kind: "list", optional: true },
    ],
  },
];

/** "full": every expected field has a value. "partial": some do. */
export type SectionState = "full" | "partial" | "empty";

export interface SectionStatus {
  state: SectionState;
  filled: number;
  total: number;
}

const hasValue = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");

export function sectionStatus(kb: KnowledgeBase, section: SectionDef): SectionStatus {
  const expected = section.fields.filter((f) => !f.optional);
  const filledExpected = expected.filter((f) => hasValue(getPath(kb, f.path))).length;
  const filledAny = section.fields.filter((f) => hasValue(getPath(kb, f.path))).length;
  const state: SectionState =
    expected.length > 0 && filledExpected === expected.length ? "full" : filledAny > 0 ? "partial" : "empty";
  return { state, filled: filledAny, total: section.fields.length };
}
