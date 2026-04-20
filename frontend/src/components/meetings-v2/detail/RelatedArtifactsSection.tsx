'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Link2, Plus, X, ExternalLink } from 'lucide-react';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { ArtifactLink, KnowledgeNavigationLink } from '@/types/meeting';
import AddArtifactDialog from './AddArtifactDialog';

interface Props {
  projectId: number;
  meetingId: number;
  relatedDecisions: KnowledgeNavigationLink[];
  relatedTasks: KnowledgeNavigationLink[];
  generatedDecisions: KnowledgeNavigationLink[];
  generatedTasks: KnowledgeNavigationLink[];
  artifacts: ArtifactLink[];
  readOnly: boolean;
  onMutated: () => void;
}

function v2Url(link: KnowledgeNavigationLink, kind: 'decision' | 'task', projectId: number): string {
  const base = kind === 'decision' ? '/decisions-v2' : '/tasks-v2';
  return `${base}/${link.id}?project_id=${projectId}`;
}

export default function RelatedArtifactsSection({
  projectId,
  meetingId,
  relatedDecisions,
  relatedTasks,
  generatedDecisions,
  generatedTasks,
  artifacts,
  readOnly,
  onMutated,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const remove = async (artifactLinkId: number) => {
    setRemovingId(artifactLinkId);
    try {
      await MeetingsAPI.removeArtifact(projectId, meetingId, artifactLinkId);
      toast.success('Artifact unlinked');
      onMutated();
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Could not remove artifact.');
    } finally {
      setRemovingId(null);
    }
  };

  const findArtifactLink = (
    kind: 'decision' | 'task',
    id: number,
  ): ArtifactLink | undefined =>
    artifacts.find(
      (a) => a.artifact_type.toLowerCase() === kind && a.artifact_id === id,
    );

  const renderRow = (
    link: KnowledgeNavigationLink,
    kind: 'decision' | 'task',
  ) => {
    const artifactLink = findArtifactLink(kind, link.id);
    return (
      <li key={`${kind}-${link.id}`} className="group flex items-center gap-2">
        <Link
          href={v2Url(link, kind, projectId)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-gray-800 transition hover:bg-gray-50"
        >
          <span className="truncate">{link.title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
        {!readOnly && artifactLink && (
          <button
            type="button"
            onClick={() => remove(artifactLink.id)}
            disabled={removingId === artifactLink.id}
            aria-label={`Unlink ${kind}`}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Linked references
          </h2>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            <span>Link</span>
          </button>
        )}
      </header>
      <p className="mb-4 text-xs text-gray-500">
        Existing decisions or tasks you reference but did <span className="font-medium text-gray-700">not</span> create here.
        Use <span className="font-medium text-gray-700">+ Link</span> to attach an existing artifact.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Decisions
          </h3>
          {relatedDecisions.length === 0 ? (
            <p className="text-xs italic text-gray-400">No linked decisions.</p>
          ) : (
            <ul className="space-y-1">{relatedDecisions.map((l) => renderRow(l, 'decision'))}</ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Tasks
          </h3>
          {relatedTasks.length === 0 ? (
            <p className="text-xs italic text-gray-400">No linked tasks.</p>
          ) : (
            <ul className="space-y-1">{relatedTasks.map((l) => renderRow(l, 'task'))}</ul>
          )}
        </div>
      </div>

      <AddArtifactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        meetingId={meetingId}
        existingArtifacts={artifacts.map((a) => ({
          artifact_type: a.artifact_type,
          artifact_id: a.artifact_id,
        }))}
        generatedDecisionIds={generatedDecisions.map((d) => d.id)}
        generatedTaskIds={generatedTasks.map((t) => t.id)}
        onCreated={() => onMutated()}
      />
    </section>
  );
}
