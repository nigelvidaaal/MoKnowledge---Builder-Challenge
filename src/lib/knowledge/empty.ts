// A factory function that builds a blank KnowledgeBase.

import type { KnowledgeBase } from "@/types/knowledge";

export function emptyKnowledgeBase(sourceUrl: string): KnowledgeBase {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    sourceUrl,
    createdAt: now,
    updatedAt: now,
    scrapedPages: [],
    foundation: {
      name: null,
      overview: null,
      website: sourceUrl,
      industry: null,
      businessModel: null,
      companyRole: null,
      yearFounded: null,
      legalEntityType: null,
      employeeCount: null,
      mainAddress: null,
      otherLocations: [],
      serviceLocations: [],
      altNames: [],
      phone: null,
      email: null,
    },
    positioning: { pitch: null, foundingStory: null },
    market: {
      buyers: [],
      customerNeeds: null,
      idealPersona: null,
      industryGroupings: [],
      industryOutlook: null,
      channels: [],
      funnels: [],
      ctas: [],
      suppliers: [],
    },
    branding: { writingStyle: null, artStyle: null, fonts: [], colors: [], logos: [], images: [] },
    onlinePresence: { socials: [] },
    people: [],
    offerings: [],
    extras: {
      voiceSamples: [],
      uniqueSellingPoints: [],
      testimonials: [],
      faqs: [],
      trustSignals: [],
      contentThemes: [],
      pressMentions: [],
      communityAndValues: [],
      seasonalMessaging: [],
      contentStarters: [],
      compliance: { privacyPolicyUrl: null, termsUrl: null, disclaimers: [] },
    },
    sources: {},
  };
}
