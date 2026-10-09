export function ChainError({ message }: { message: string }) {
  return (
    <div className="border border-flare bg-mist p-6">
      <span className="label text-flare">Chain unavailable</span>
      <p className="mt-2 font-medium">{message}</p>
      <p className="mt-2 text-sm text-graphite/70">
        Start the local network with <code className="bg-card px-1.5 py-0.5 font-mono text-xs">npm run chain</code>{" "}
        and deploy with <code className="bg-card px-1.5 py-0.5 font-mono text-xs">npm run deploy</code> from the
        project root.
      </p>
    </div>
  );
}
