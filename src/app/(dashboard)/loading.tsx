export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-cream-100" />
        <div className="h-8 w-56 rounded-2xl bg-white/80 shadow-sm" />
        <div className="h-4 w-72 rounded-full bg-cream-50" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
          >
            <div className="h-14 w-14 rounded-[22px] bg-cream-100" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded-full bg-cream-100" />
              <div className="h-4 w-full rounded-full bg-cream-50" />
              <div className="h-4 w-4/5 rounded-full bg-cream-50" />
            </div>
            <div className="h-11 w-full rounded-[22px] bg-cream-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
