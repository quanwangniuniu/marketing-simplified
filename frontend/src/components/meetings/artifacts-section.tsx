import type { ReactNode } from 'react';
import type { ArtifactLink } from '@/types/meeting';

interface ArtifactsSectionProps {
  artifactsCount: number;
  orderedArtifacts: ArtifactLink[];
  /** e.g. Dropdown trigger for "+ Add" */
  addControl: ReactNode;
  /** Optional search panel below title (card-style) */
  searchPanel?: ReactNode;
  rows: ReactNode;
}

export function ArtifactsSection({
  artifactsCount,
  orderedArtifacts,
  addControl,
  searchPanel,
  rows,
}: ArtifactsSectionProps) {
  return (
    <section className="py-1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-slate-900">Artifacts ({artifactsCount})</h3>
        {addControl}
      </div>

      {searchPanel}

      <div className="mt-4 grid gap-2">
        {orderedArtifacts.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground">No artifacts linked yet.</div>
        ) : (
          rows
        )}
      </div>
    </section>
  );
}
