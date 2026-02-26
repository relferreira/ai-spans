import { AiTracePage } from 'ai-spans/ui';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ traceId: string }>;

export default async function Page({ params }: { params: Params }) {
  const { traceId } = await params;

  return (
    <AiTracePage
      traceId={traceId}
      basePath="/admin/ai-observability"
      authCheck={async () => {
        // BYO auth: local demo leaves this open.
      }}
    />
  );
}
