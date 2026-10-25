import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center py-24 sm:py-32 bg-background">
      <Container className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          404 error
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base sm:text-lg text-muted">
          Page not found. The page you are looking for does not exist.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <Button href="/" variant="primary">
            Back to home
          </Button>
        </div>
      </Container>
    </main>
  );
}
