'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { useBuildUrl } from '@/lib/buildUrl';

interface Connection {
  id: number;
  slug?: string | null;
  project_seq: number;
  title?: string | null;
}

interface Edge {
  from_seq: number;
  to_seq: number;
}

interface Props {
  decisionId: number | string | null;
  projectId: number | string | null;
  mySeq: number | null;
}

export default function DecisionConnectionsAside({ decisionId, projectId, mySeq }: Props) {
  const buildUrl = useBuildUrl();
  const [connected, setConnected] = useState<Connection[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!decisionId) return;
    let cancelled = false;
    setLoading(true);
    DecisionAPI.getConnections(decisionId, projectId)
      .then((res: any) => {
        if (cancelled) return;
        setConnected(res?.connected ?? []);
        setEdges(res?.edges ?? []);
      })
      .catch(() => {
        // swallow; connections are optional aside
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [decisionId, projectId]);

  if (loading || connected.length === 0) return null;

  const parents = edges
    .filter((e) => e.to_seq === mySeq)
    .map((e) => connected.find((c) => c.project_seq === e.from_seq))
    .filter(Boolean) as Connection[];

  const children = edges
    .filter((e) => e.from_seq === mySeq)
    .map((e) => connected.find((c) => c.project_seq === e.to_seq))
    .filter(Boolean) as Connection[];

  const linkHref = (c: Connection) => buildUrl(`/decisions/${c.slug ?? c.id}`);

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:rounded-xl">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Connections
      </h3>
      {parents.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Parents
          </div>
          <ul className="mt-1 space-y-1">
            {parents.map((c) => (
              <li key={c.id} className="text-sm">
                <Link
                  href={linkHref(c)}
                  className="break-words text-gray-700 transition hover:text-[#3CCED7]"
                >
                  #{c.project_seq} {c.title || 'Untitled'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children.length > 0 && (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            Children
          </div>
          <ul className="mt-1 space-y-1">
            {children.map((c) => (
              <li key={c.id} className="text-sm">
                <Link
                  href={linkHref(c)}
                  className="break-words text-gray-700 transition hover:text-[#3CCED7]"
                >
                  #{c.project_seq} {c.title || 'Untitled'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
