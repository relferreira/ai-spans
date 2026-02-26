import { AiObservabilityPage } from 'ai-spans/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AiObservabilityPage
      basePath="/admin/ai-observability"
      searchParams={await searchParams}
      authCheck={async () => {
        // BYO auth: local demo leaves this open.
      }}
    />
  );
}
