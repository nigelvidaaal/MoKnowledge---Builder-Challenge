// Categories given from knowledge output. 
// Everything under `extras` is the "think bigger" layer: data that makes
// MoSocial, MoMail and MoBlogs produce better content.
//
// Every field's origin is tracked in `sources`, keyed by a dotted path
// like "foundation.yearFounded". That lets the UI show where a value came
// from and lets an LLM know which facts are safe to state.

// how a value was obtained 
export type SourceMethod =
  | "json-ld" // structured data embedded by the site
  | "meta" // tags often written by an SEO plugin
  | "html" // page structure: headings, nav, links, forms
  | "pattern" // regex over visible text ("since 1980", "LLC")
  | "css" // data from css 
  | "ai_mock" // placeholder for an LLM-generated value (clearly labeled)
  | "user"; // typed or edited by the person reviewing 

export type Confidence = "high" | "medium" | "low";

export interface FieldSource {
  method: SourceMethod;
  confidence: Confidence;
  /** Page the value was found on, when it came from a page. */
  url?: string;
}

export type SocialPlatform =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "yelp"
  | "google";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface Person {
  name: string;
  title: string | null;
  gender: string | null;
  description: string | null;
}

export interface Offering {
  name: string;
  /** e.g. "Service", "Product", "Insurance", "Property Listing" */
  category: string | null;
  description: string | null;
  features: string[];
  /** Free text: "Free Estimate", "Per Project", "$149/month" */
  pricing: string | null;
  url: string | null;
}

export interface Testimonial {
  quote: string;
  author: string | null;
  rating: number | null;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface KnowledgeBase {
  id: string;
  sourceUrl: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  /** Pages the scraper actually read. */
  scrapedPages: string[];

  foundation: {
    name: string | null;
    overview: string | null;
    website: string | null;
    industry: string | null;
    businessModel: string | null;
    companyRole: string | null;
    yearFounded: number | null;
    legalEntityType: string | null;
    employeeCount: string | null;
    mainAddress: string | null;
    otherLocations: string[];
    serviceLocations: string[];
    altNames: string[];
    phone: string | null;
    email: string | null;
  };

  positioning: {
    pitch: string | null;
    foundingStory: string | null;
  };

  market: {
    buyers: string[];
    customerNeeds: string | null;
    idealPersona: string | null;
    industryGroupings: string[];
    industryOutlook: string | null;
    channels: string[];
    funnels: string[];
    ctas: string[];
    suppliers: string[];
  };

  branding: {
    writingStyle: string | null;
    artStyle: string | null;
    fonts: string[];
    colors: string[]; // hex, most used first
    logos: string[]; // absolute URLs
  };

  onlinePresence: {
    socials: SocialLink[];
  };

  people: Person[];
  offerings: Offering[];

  /** Beyond MoFlo's baseline: inputs that improve generated content. */
  extras: {
    
    /** Real sentences from the site, used as few-shot voice examples. */
    voiceSamples: string[];
    uniqueSellingPoints: string[];
    testimonials: Testimonial[];
    faqs: Faq[];

    /** Licenses, certifications, awards, years in business, guarantees. */
    trustSignals: string[];

    /** Recurring topics from headings and blog titles. */
    contentThemes: string[];
    pressMentions: string[];
    communityAndValues: string[];

    /** Promotions tied to a season or date. */
    seasonalMessaging: string[];
    compliance: {
      privacyPolicyUrl: string | null;
      termsUrl: string | null;
      disclaimers: string[];
    };
  };

  sources: Record<string, FieldSource>;
}

/** What an extractor returns: a partial knowledge base plus its sources. */
export interface ExtractorResult {
  data: DeepPartial<Omit<KnowledgeBase, "sources">>;
  sources: Record<string, FieldSource>;
}

// extractor only finds some fields, so it needs a type where very field at every 
// level is optional 

// extracts a union of all top-level keys from the type T
export type DeepPartial<T> = {
  // iterate over every key in that union and making every property optional 
  // to pass as a valid extraction 
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends object | null
      ? DeepPartial<NonNullable<T[K]>> | null
      : T[K];
};


