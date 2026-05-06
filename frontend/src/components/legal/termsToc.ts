export type TermsTocItem = {
  id: string;
  label: string;
};

/** In-page anchors for `/terms`; keep ids in sync with `TermsPage` sections. */
export const termsToc: TermsTocItem[] = [
  { id: 'overview', label: '1. Overview and acceptance of this agreement' },
  { id: 'service', label: '2. The service and permitted business use' },
  { id: 'accounts', label: '3. Accounts, credentials, and security obligations' },
  { id: 'customer-content', label: '4. Customer content ownership and license scope' },
  { id: 'billing', label: '5. Billing, taxes, and subscription renewals' },
  { id: 'third-party', label: '6. Third-party platforms, tools, and integrations' },
  { id: 'availability', label: '7. Service availability, maintenance, and support' },
  { id: 'intellectual-property', label: '8. Intellectual property rights and restrictions' },
  { id: 'warranties-disclaimer', label: '9. Warranty limitations and disclaimers' },
  { id: 'liability', label: '10. Limitation of liability and excluded damages' },
  { id: 'termination', label: '11. Term, suspension, and termination rights' },
  { id: 'governing-law', label: '12. Governing law and dispute framework' },
  { id: 'changes', label: '13. Changes to these terms and notifications' },
  { id: 'contact', label: '14. Contact details for legal questions' },
];
