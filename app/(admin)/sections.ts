// Every admin destination, grouped by what it is. The sidebar, the group
// overview pages and each page's own header all read from here, so a page's
// name and purpose are written once.

export type PageInfo = { href: string; label: string; purpose: string };
export type Group = { slug: "content" | "generation" | "access"; title: string; purpose: string; pages: PageInfo[] };

export const OVERVIEW: PageInfo = {
  href: "/",
  label: "Overview",
  purpose: "How much bit is producing, whether people like it, and who and what is doing the work.",
};

export const GROUPS: Group[] = [
  {
    slug: "content",
    title: "Content",
    purpose: "What users produced: the images, the captions generated from them, and the votes on those captions.",
    pages: [
      { href: "/media", label: "Media", purpose: "Every AI caption. Edit, publish, unpublish or delete, and trace how each one was made." },
      { href: "/images", label: "Images", purpose: "Every image as a thumbnail. Open one to see and manage all of its captions." },
      { href: "/votes", label: "Votes", purpose: "Every upvote and downvote people cast on captions. Read only." },
    ],
  },
  {
    slug: "generation",
    title: "Generation",
    purpose: "How the AI produces captions: the prompt chains, the models they call, the reference material, and the raw calls.",
    pages: [
      { href: "/chains", label: "Chains", purpose: "The prompt chains and their steps, and how often each one is picked." },
      { href: "/models", label: "Models", purpose: "The LLM providers and the exact model versions chains can call." },
      { href: "/content", label: "Terms & Examples", purpose: "The vocabulary and good/bad example captions fed into prompts." },
      { href: "/responses", label: "Responses", purpose: "Every generation request with each LLM call's prompt and raw output." },
    ],
  },
  {
    slug: "access",
    title: "Access",
    purpose: "Who gets in: the people who have signed up, and the domains and addresses allowed to.",
    pages: [
      { href: "/people", label: "Users", purpose: "Everyone who has signed in to bit, with what they've uploaded, generated and voted." },
      { href: "/access", label: "Domains & Emails", purpose: "The sign-up allowlist: email domains and individual addresses." },
    ],
  },
];

export function groupHref(slug: Group["slug"]) {
  return `/groups/${slug}`;
}

export function pageInfo(href: string): PageInfo | undefined {
  if (href === OVERVIEW.href) return OVERVIEW;
  for (const g of GROUPS) {
    const p = g.pages.find((x) => x.href === href);
    if (p) return p;
  }
}
