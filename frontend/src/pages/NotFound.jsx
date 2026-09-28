import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function NotFound() {
  const [scanLine, setScanLine] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine((previous) => (previous >= 100 ? 0 : previous + 1));
    }, 35);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      {/* Background Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px)
          `,
          backgroundSize: "45px 45px",
        }}
      />

      {/* Ambient Glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />

      {/* Radar Circles */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/[0.08]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/[0.08]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/[0.08]" />

      {/* Radar Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-400/[0.06]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[520px] -translate-x-1/2 -translate-y-1/2 bg-cyan-400/[0.06]" />

      {/* Radar Sweep */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[2px] origin-bottom -translate-x-1/2 -translate-y-full bg-gradient-to-t from-cyan-400/50 to-transparent"
        style={{
          transform: `translateX(-50%) translateY(-100%) rotate(${scanLine * 3.6}deg)`,
        }}
      />

      {/* Top System Bar */}
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-white/[0.06] bg-slate-950/50 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06]">
            <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            <div className="absolute inset-2 rounded-full border border-cyan-300/30" />
          </div>

          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-white">
              ANTIDRONE
            </div>
            <div className="text-[9px] uppercase tracking-[0.25em] text-slate-500">
              Defense Intelligence System
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          System Online
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Error Code */}
          <div className="relative mx-auto mb-8">
            <div className="absolute inset-0 flex items-center justify-center blur-3xl">
              <span className="text-[150px] font-black text-cyan-400/10">
                404
              </span>
            </div>

            <div className="relative">
              <div className="mb-3 flex items-center justify-center gap-3">
                <span className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-400/50" />

                <span className="rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-3 py-1 text-[9px] font-medium uppercase tracking-[0.25em] text-rose-300">
                  Navigation Error
                </span>

                <span className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-400/50" />
              </div>

              <h1 className="select-none text-[120px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.12)] sm:text-[170px]">
                404
              </h1>
            </div>
          </div>

          {/* Message Card */}
          <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-slate-950/60 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7 text-cyan-300"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m0 3.75h.008M10.29 3.86 2.82 17.25A1.5 1.5 0 0 0 4.12 19.5h15.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Target Location Not Found
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              The requested route could not be located in the AntiDrone
              navigation system. The resource may have been moved, removed,
              or the coordinates may be incorrect.
            </p>

            {/* System Status */}
            <div className="mt-7 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  Status
                </div>
                <div className="mt-1 text-xs font-medium text-emerald-300">
                  ONLINE
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  Signal
                </div>
                <div className="mt-1 text-xs font-medium text-cyan-300">
                  LOST
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                  Code
                </div>
                <div className="mt-1 text-xs font-medium text-rose-300">
                  404
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 21v-6h6v6"
                  />
                </svg>
                Return Home
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-white/[0.03] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.05] hover:text-cyan-200"
              >
                Operator Login
              </Link>
            </div>
          </div>

          {/* Bottom System Message */}
          <div className="mt-7 flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.2em] text-slate-600">
            <span className="h-1 w-1 rounded-full bg-cyan-400/60" />
            AntiDrone Navigation Protocol
            <span className="text-slate-700">•</span>
            Route Recovery Ready
            <span className="h-1 w-1 rounded-full bg-cyan-400/60" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default NotFound;

