// The ordered list of all extractors.

import type { Extractor } from "./types";
import { brandingExtractor } from "./branding";
import { detailsExtractor } from "./details";
import { jsonLdExtractor } from "./jsonLd";
import { metaExtractor } from "./meta";
import { socialProofExtractor } from "./socialProof";
import { socialsExtractor } from "./socials";
import { structureExtractor } from "./structure";
import { voiceExtractor } from "./voice";
import { imagesExtractor } from "./images";

export const EXTRACTORS: Extractor[] = [
  //   1. Structured data the business published itself: most reliable.
  jsonLdExtractor,
  //   2. Social profile links.
  socialsExtractor,
  //   3. Contact details from links, then regex patterns.
  detailsExtractor,
  //   4. Colors, fonts and logo from CSS and HTML.
  brandingExtractor,
  //   5. Offerings, CTAs, funnels, people and themes from page layout.
  structureExtractor,
  //   6. Testimonials, FAQs, trust signals and other extras.
  socialProofExtractor,
  //   7. The company's own sentences and founding story.
  voiceExtractor,
  //   8. Real photos (team, projects, services) for the brand photo library.
  imagesExtractor,
  //   9. Meta tags: weakest, runs last so it only fills gaps.
  metaExtractor,
];
