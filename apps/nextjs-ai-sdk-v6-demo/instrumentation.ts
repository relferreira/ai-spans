export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAiObservability } = await import('ai-spans/next');
    await registerAiObservability();
  }
}
