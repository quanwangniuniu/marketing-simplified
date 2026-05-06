export type CookiePolicyTocItem = {
  id: string;
  label: string;
};

/** In-page anchors for `/cookie-policy`; keep ids in sync with `CookiePolicyPage` sections. */
export const cookiePolicyToc: CookiePolicyTocItem[] = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'what-are-cookies', label: '2. What are cookies?' },
  { id: 'types-of-cookies', label: '3. Types of cookies we use' },
  { id: 'how-we-use-cookies', label: '4. How we use cookies' },
  { id: 'third-party', label: '5. Third-party cookies' },
  { id: 'your-choices', label: '6. Your choices and controls' },
  { id: 'changes', label: '7. Changes to this notice' },
  { id: 'related', label: '8. Related policies' },
];
