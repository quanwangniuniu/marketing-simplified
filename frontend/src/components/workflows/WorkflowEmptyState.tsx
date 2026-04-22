"use client";

export default function WorkflowEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6">
        <svg
          className="mx-auto h-24 w-24"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="30" cy="30" r="12" fill="#3B82F6" />
          <circle cx="90" cy="30" r="8" fill="#6366F1" />
          <circle cx="30" cy="90" r="10" fill="#3B82F6" />
          <circle cx="90" cy="90" r="14" fill="#3B82F6" />
          <circle cx="60" cy="60" r="8" fill="#1E293B" />
          <circle cx="75" cy="45" r="6" fill="#6366F1" />
          <line
            x1="30"
            y1="30"
            x2="60"
            y2="60"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <line
            x1="90"
            y1="30"
            x2="60"
            y2="60"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <line
            x1="30"
            y1="90"
            x2="60"
            y2="60"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <line
            x1="90"
            y1="90"
            x2="75"
            y2="45"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <line
            x1="75"
            y1="45"
            x2="60"
            y2="60"
            stroke="#94A3B8"
            strokeWidth="2"
          />
        </svg>
      </div>

      <h3 className="text-xl font-semibold text-gray-900">
        Make work flow your way
      </h3>

      <p className="mt-3 max-w-md text-sm text-gray-600 leading-relaxed">
        Workflows represent your team's process and control how people progress
        your project's work.
      </p>

      <p className="mt-4 max-w-md text-sm text-gray-600 leading-relaxed">
        Here, you can add statuses, which appear as drop zones for the cards on
        your project's board. You can create pathways between statuses called
        transitions, and automate repetitive actions using rules.
      </p>

      <p className="mt-4 text-sm font-medium text-gray-700">
        Select a status to reveal more details.
      </p>

      <a
        href="#"
        className="mt-6 inline-block text-sm font-medium text-[#3CCED7] hover:text-[#1a9ba3]"
      >
        Learn more
      </a>
    </div>
  );
}
