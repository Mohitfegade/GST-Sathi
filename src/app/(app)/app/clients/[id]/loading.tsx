export default function ClientDetailLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-8"
    >
      <span className="sr-only">Loading client details...</span>

      {/* Back link breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-28 rounded bg-line animate-pulse" />
      </div>

      {/* Detail Header Skeleton */}
      <div className="bg-surface border border-line animate-pulse rounded-lg p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 max-w-full rounded bg-line" />
            <div className="h-5 w-40 max-w-full rounded bg-line" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-28 rounded-lg bg-line" />
          </div>
        </div>

        {/* Client Meta Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
          <div className="h-6 w-36 rounded-full bg-line" />
          <div className="h-6 w-28 rounded-full bg-line" />
          <div className="h-6 w-24 rounded-full bg-line" />
          <div className="h-6 w-32 rounded-full bg-line" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="bg-surface border border-line animate-pulse rounded-lg p-1.5 flex gap-2 overflow-x-auto">
        <div className="h-10 w-28 rounded-md bg-line shrink-0" />
        <div className="h-10 w-24 rounded-md bg-line shrink-0" />
        <div className="h-10 w-28 rounded-md bg-line shrink-0" />
        <div className="h-10 w-24 rounded-md bg-line shrink-0" />
      </div>

      {/* Main Content Placeholder */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-line animate-pulse rounded-lg p-6 space-y-3">
            <div className="h-5 w-32 rounded bg-line" />
            <div className="h-8 w-20 rounded bg-line" />
            <div className="h-4 w-40 rounded bg-line" />
          </div>
          <div className="bg-surface border border-line animate-pulse rounded-lg p-6 space-y-3">
            <div className="h-5 w-28 rounded bg-line" />
            <div className="h-8 w-24 rounded bg-line" />
            <div className="h-4 w-36 rounded bg-line" />
          </div>
          <div className="bg-surface border border-line animate-pulse rounded-lg p-6 space-y-3">
            <div className="h-5 w-36 rounded bg-line" />
            <div className="h-8 w-20 rounded bg-line" />
            <div className="h-4 w-44 rounded bg-line" />
          </div>
        </div>

        {/* Owner Access Panel Placeholder */}
        <div className="bg-surface border border-line animate-pulse rounded-lg p-6 space-y-4">
          <div className="h-6 w-48 rounded bg-line" />
          <div className="h-4 w-3/4 max-w-lg rounded bg-line" />
          <div className="pt-2 flex flex-wrap gap-3">
            <div className="h-12 w-40 rounded-lg bg-line" />
            <div className="h-12 w-32 rounded-lg bg-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
