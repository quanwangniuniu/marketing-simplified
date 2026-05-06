export type SecurityTocItem = {
  id: string;
  label: string;
};

/** In-page anchors for `/security`; keep ids in sync with `SecurityPage` sections. */
export const securityToc: SecurityTocItem[] = [
  { id: 'overview', label: 'Security at a glance' },
  { id: 'data-handling', label: 'Data handling' },
  { id: 'identity-access', label: 'Identity and access' },
  { id: 'connected-accounts', label: 'Connected accounts and tokens' },
  { id: 'infrastructure-encryption', label: 'Infrastructure and encryption' },
  { id: 'logging-backups', label: 'Logging, monitoring, and availability' },
  { id: 'customer-controls', label: 'What your organization controls' },
  { id: 'faq', label: 'Security FAQ' },
  { id: 'contact', label: 'Contact and next steps' },
];
