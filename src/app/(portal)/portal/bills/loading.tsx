export default function PortalBillsLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="space-y-6 max-w-4xl"
    >
      <span className="sr-only">Loading bills...</span>

      {/* Back link breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-5 w-32 rounded bg-line animate-pulse" />
      </div>

      {/* Title & Guidance Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-52 sm:w-64 rounded-md bg-line animate-pulse" />
        <div className="h-4 w-72 sm:w-96 max-w-full rounded bg-line animate-pulse" />
      </div>

      {/* Business Info Banner Skeleton */}
      <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse">
        <div className="space-y-1.5">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="h-5 w-40 rounded bg-line" />
        </div>
        <div className="h-8 w-44 rounded bg-line self-start sm:self-auto" />
      </div>

      {/* Primary Upload CTA Card Skeleton */}
      <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-4 animate-pulse">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-background border border-line flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-line" />
        </div>
        <div className="space-y-2 max-w-md w-full">
          <div className="h-6 w-48 mx-auto rounded bg-line" />
          <div className="h-4 w-64 max-w-full mx-auto rounded bg-line" />
        </div>
        <div className="pt-2 w-full max-w-xs">
          <div className="h-12 w-full rounded-lg bg-line" />
        </div>
      </div>

      {/* Month / Period Switcher Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="h-10 w-24 rounded-full bg-line animate-pulse shrink-0" />
        <div className="h-10 w-24 rounded-full bg-line animate-pulse shrink-0" />
        <div className="h-10 w-24 rounded-full bg-line animate-pulse shrink-0" />
      </div>

      {/* Recent Uploaded Bills List Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-line animate-pulse" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between gap-3 animate-pulse"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-line shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-4 w-3/4 max-w-xs rounded bg-line" />
                  <div className="h-3 w-1/2 max-w-[140px] rounded bg-line" />
                </div>
              </div>
              <div className="h-6 w-20 rounded-full bg-line shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
