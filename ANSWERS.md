# Answers to the required questions

## 1. What approach did you take to scraping and structuring the knowledge base data?

I split the problem into three steps: **crawl, extract, merge**.

**Crawl.** A homepage alone misses most of what matters (the story is on About, services have their own pages, the team is on a staff page), so the crawler picks up to 12 pages per site. It reads `robots.txt` and the sitemap, then reads the site's **main menu**, because SMBs organize their site there: links under "Services" are services, links under "About" hold the story and team. Every other link is scored by how likely it is to hold facts, and form pages (quotes, careers, payments) are penalized. It fetches politely: 4 pages at a time with timeouts and a size cap, respecting robots.txt rules (including wildcards and Crawl-delay).

**Extract.** Nine extractors each look for one kind of information, from most to least reliable. (check knowledge.ts)

**Merge.** Results are merged into one knowledge base.The reviewer can see where each value came from and what to double-check. A final step connects facts across extractors (team photos to people) and builds content ideas.

The structure follows MoFlo's knowledge output categories (foundation, positioning, market, branding, online presence, people, offerings), plus an `extras` section for what goes beyond them.

## 2. What information beyond the baseline did you include, and why?

- **Voice samples:** real sentences from the site. A model copies examples much better than it follows "friendly and professional".
- **Testimonials:** real customer words for social posts and email proof, instead of invented praise.
- **FAQs:** each question is a ready topic for a blog post or email, in the customer's own wording.
- **Trust signals and differentiators:** years in business, licenses, warranties, ratings. Concrete claims instead of "trusted and reliable".
- **Content themes, seasonal promos, community and press:** what the business already talks about and when.
- **Compliance:** disclaimers and policy links that generated content must not contradict, which matters a lot for insurance, finance or mortgage clients.
- **Brand photo library:** the company's own team and job-site photos, with stock images labeled. Team members also get their headshots automatically when the site captions them with names.
- **Content starters:** ready ideas for each app (a customer spotlight post, an FAQ email, a local service guide…) that quote the exact facts they use. They're built by rules, not AI, so nothing is invented.
- **Provenance for every field:** a reviewer can verify quickly, and a model can be told which facts are safe to state.

## 3. How would your knowledge base design improve the outputs of MoSocial, MoMail, and MoBlogs specifically?

**MoSocial** needs lots of short, specific, visual posts. Testimonials become customer spotlights, team members with photos become "meet the team" posts, the founding year becomes a milestone post, seasonal promos become timely posts, and the brand colors, fonts and real photos keep the visuals on brand. Voice samples keep captions sounding like the owner.

**MoMail** needs a reason to open and one clear action. The CTAs the business already uses ("Request a free estimate") end every email; pricing and offers give subject lines; FAQs become nurture emails; testimonials and trust signals become proof blocks; and compliance disclaimers stop the email from promising something the business legally can't.

**MoBlogs** needs real topics and authority. FAQs give a topic list in the customer's own words, offerings with features give one article per service, service locations support local search, and key people give real authors.

The content starters show this directly: instead of only describing the company, the knowledge base hands each app concrete things to write, with the facts to use. And across all three, the source tags tell a model which facts it can state as true.

## 4. What would you improve or change about MoKnowledge if you had more time?

- **Real LLM calls** using the prompts already written in `src/prompts`, showing the quoted evidence next to every AI-filled field so a reviewer can accept or reject each one.
- **A headless-browser fallback** for sites that only render with JavaScript.
- **Re-scrape with "what changed"**: compare a new scrape with the saved version and let the reviewer accept new services, ended promotions or new team members without losing their edits.
- **Beyond the website**: Google Business Profile (hours, reviews), review sites, state business registries and license lookups.

## 5. What was the most challenging part of this assignment?

This is my first time working with Typescript and Supabase. Although, I have experience using React and Postgres, some syntax on both the language and db were hard to understand and grasp, not to mention my "way of thinking" on converting lines of code from JS/C++ mentality. 

The concept of web scraping itself, this is also my first time dealing with such. I had to research about MoFlo and how web scraping actually works, App routers and etc. 
Although I must admit, it was stressful and yet also fun! I learned a lot from this challenge and actually taught me real-world scenarios where I had to step up with something very uncharted. 
