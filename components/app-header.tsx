export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/8 px-4 py-4 md:px-6 lg:px-8">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[rgb(var(--color-shell-muted))]">
          Responsive web app
        </p>
        <h1 className="mt-1 text-lg font-medium text-white">Chief of Staff</h1>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[rgb(var(--color-shell-muted))]">
          Shell foundation
        </div>
      </div>
    </header>
  );
}
