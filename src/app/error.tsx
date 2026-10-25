"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log error for observability
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center py-24 sm:py-32 bg-background">
      <Container className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Error
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base sm:text-lg text-muted">
          Something went wrong. Please try again.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button onClick={() => reset()} variant="primary">
            Try again
          </Button>
          <Button href="/" variant="secondary">
            Back to home
          </Button>
        </div>
      </Container>
    </main>
  );
}
