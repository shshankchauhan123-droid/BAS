import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("antidrone_access_token");
    localStorage.removeItem("antidrone_user");

    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <header className="border-b border-white/[0.06] bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em]">
              ANTIDRONE
            </div>

            <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Administration Control
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:border-rose-400/30 hover:text-rose-300"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-2xl border border-violet-400/10 bg-slate-950/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-violet-400">
            Administrator Access
          </div>

          <h1 className="text-3xl font-bold">
            AntiDrone Admin Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Welcome to the AntiDrone administration area. Administrative
            controls, user management, system monitoring, and configuration
            will be added here.
          </p>

          <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="text-xs uppercase tracking-[0.15em] text-slate-500">
              Access Level
            </div>

            <div className="mt-2 text-lg font-semibold text-violet-300">
              ADMIN
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
