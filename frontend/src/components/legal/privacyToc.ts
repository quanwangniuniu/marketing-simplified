export type PrivacyTocItem = {
  id: string;
  label: string;
};

/** In-page anchors for `/privacy`; keep ids in sync with `PrivacyPage` sections. */
export const privacyToc: PrivacyTocItem[] = [
  { id: 'overview', label: '1. Overview' },
  { id: 'data-we-collect', label: '2. Data we collect' },
  { id: 'how-we-use-data', label: '3. How we use data' },
  { id: 'legal-bases', label: '4. Legal bases and permissions' },
  { id: 'sharing', label: '5. Sharing and processors' },
  { id: 'retention', label: '6. Retention and deletion' },
  { id: 'security', label: '7. Security controls' },
  { id: 'international-transfers', label: '8. International transfers' },
  { id: 'your-rights', label: '9. Your privacy rights' },
  { id: 'children', label: '10. Children and minors' },
  { id: 'changes', label: '11. Changes to this policy' },
  { id: 'contact', label: '12. Contact' },
];
