export default function ClientsLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-8"
    >
      <span className="sr-only">Loading clients list...</span>

      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-md bg-line animate-pulse" />
          <div className="h-4 w-72 max-w-full rounded bg-line animate-pulse" />
        </div>
        <div className="h-12 w-36 rounded-lg bg-line animate-pulse" />
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="rounded-lg border border-line bg-surface p-4 animate-pulse">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 w-full sm:w-80 rounded-md bg-line" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-20 rounded-full bg-line" />
            <div className="h-8 w-24 rounded-full bg-line" />
            <div className="h-8 w-24 rounded-full bg-line" />
          </div>
        </div>
      </div>

      {/* Mobile Skeleton Cards (< 768px) */}
      <div className="flex flex-col gap-4 md:hidden">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="bg-surface border border-line animate-pulse rounded-lg p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-3/4 rounded bg-line" />
                <div className="h-4 w-1/2 rounded bg-line" />
              </div>
              <div className="h-6 w-24 rounded-full bg-line" />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
              <div className="h-5 w-32 rounded bg-line" />
              <div className="h-5 w-24 rounded bg-line" />
              <div className="h-5 w-20 rounded bg-line" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Skeleton Rows (>= 768px) */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="bg-surface border border-line animate-pulse rounded-lg p-4 flex items-center justify-between gap-4"
          >
            <div className="w-1/3 space-y-2">
              <div className="h-5 w-48 rounded bg-line" />
              <div className="h-4 w-32 rounded bg-line" />
            </div>
            <div className="w-1/4">
              <div className="h-5 w-36 rounded bg-line" />
            </div>
            <div className="w-1/6">
              <div className="h-5 w-24 rounded bg-line" />
            </div>
            <div className="w-1/6">
              <div className="h-6 w-28 rounded-full bg-line" />
            </div>
            <div className="w-16 flex justify-end">
              <div className="h-8 w-12 rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
