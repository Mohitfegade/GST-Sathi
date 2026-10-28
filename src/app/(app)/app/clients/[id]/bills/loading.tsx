export default function ClientBillsLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-8"
    >
      <span className="sr-only">Loading bills...</span>

      {/* Back link breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-36 rounded bg-line animate-pulse" />
      </div>

      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-md bg-line animate-pulse" />
          <div className="h-4 w-80 max-w-full rounded bg-line animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-12 w-32 rounded-lg bg-line animate-pulse" />
          <div className="h-12 w-32 rounded-lg bg-line animate-pulse" />
        </div>
      </div>

      {/* Upload Panel Skeleton */}
      <div className="rounded-xl border border-line bg-surface p-6 sm:p-8 animate-pulse space-y-4">
        <div className="flex flex-col items-center justify-center text-center space-y-3 py-8 border-2 border-dashed border-line rounded-lg bg-background">
          <div className="h-12 w-12 rounded-full bg-line" />
          <div className="space-y-1">
            <div className="h-5 w-52 mx-auto rounded bg-line" />
            <div className="h-4 w-72 max-w-full mx-auto rounded bg-line" />
          </div>
          <div className="h-12 w-36 rounded-lg bg-line mt-2" />
        </div>
      </div>

      {/* Filter and Period Toolbar Skeleton */}
      <div className="rounded-lg border border-line bg-surface p-4 animate-pulse">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="h-10 w-full sm:w-64 rounded-md bg-line" />
            <div className="h-10 w-full sm:w-44 rounded-md bg-line" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-20 rounded-full bg-line" />
            <div className="h-8 w-24 rounded-full bg-line" />
            <div className="h-8 w-24 rounded-full bg-line" />
            <div className="h-8 w-20 rounded-full bg-line" />
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
              <div className="h-6 w-24 rounded-full bg-line shrink-0" />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-line text-sm">
              <div className="h-4 w-28 rounded bg-line" />
              <div className="h-4 w-16 rounded bg-line" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="h-12 flex-1 rounded-lg bg-line" />
              <div className="h-12 w-20 rounded-lg bg-line" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Skeleton Rows (>= 768px) */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        {/* Table Header Placeholder */}
        <div className="bg-surface/50 border border-line rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="w-2/5">
            <div className="h-4 w-24 rounded bg-line" />
          </div>
          <div className="w-1/6">
            <div className="h-4 w-16 rounded bg-line" />
          </div>
          <div className="w-1/6">
            <div className="h-4 w-16 rounded bg-line" />
          </div>
          <div className="w-1/6">
            <div className="h-4 w-16 rounded bg-line" />
          </div>
          <div className="w-24 flex justify-end">
            <div className="h-4 w-12 rounded bg-line" />
          </div>
        </div>

        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="bg-surface border border-line animate-pulse rounded-lg p-4 flex items-center justify-between gap-4"
          >
            <div className="w-2/5 space-y-2">
              <div className="h-5 w-48 rounded bg-line" />
              <div className="h-4 w-32 rounded bg-line" />
            </div>
            <div className="w-1/6">
              <div className="h-5 w-24 rounded bg-line" />
            </div>
            <div className="w-1/6">
              <div className="h-6 w-24 rounded-full bg-line" />
            </div>
            <div className="w-1/6">
              <div className="h-4 w-20 rounded bg-line" />
            </div>
            <div className="w-24 flex justify-end gap-2">
              <div className="h-10 w-10 rounded-md bg-line" />
              <div className="h-10 w-10 rounded-md bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
