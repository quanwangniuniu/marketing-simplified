import { redirect } from 'next/navigation';

type SettingsRedirectProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function integrationsHref(searchParams: SettingsRedirectProps['searchParams'] = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }

  const query = params.toString();
  return query ? `/integrations?${query}` : '/integrations';
}

export default function SettingsRedirectPage({ searchParams }: SettingsRedirectProps) {
  redirect(integrationsHref(searchParams));
}
