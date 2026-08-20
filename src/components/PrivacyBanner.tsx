export function PrivacyBanner() {
  return (
    <div className="border-b border-emerald-500/20 bg-emerald-500/5">
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs text-emerald-200/90">
        <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-400" />
        Your Instagram export is processed locally in your browser and is not uploaded to a server.
      </p>
    </div>
  );
}
