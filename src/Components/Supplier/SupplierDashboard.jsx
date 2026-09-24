import { LogOut } from "lucide-react";

/**
 * Screen shown after a supplier signs in. For now it only shows the
 * supplier's name; more sections can be added inside <main> later.
 *
 * session: { customerId, customerName, mobileNumber }
 * onLogout: called when the supplier clicks "Log out".
 */
export default function SupplierDashboard({ session, onLogout }) {
  const name = session?.customerName?.trim() || "Supplier";

  return (
    <div className="min-h-screen w-full bg-[#F3EFE6]">
      <header className="bg-[#1B2430]">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <img
            src="/gripstyle-logo.png"
            alt="GripStyle Supply"
            className="h-10 w-auto brightness-0 invert"
          />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-md border border-[#3A4553] px-3.5 py-2 text-sm font-medium text-[#F3EFE6] hover:bg-[#262F3D] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-mono uppercase tracking-wider text-[#8A5A1E]">
          Supplier portal
        </p>
        <h1 className="mt-2 text-3xl font-medium text-[#1B2430] tracking-tight">
          {name}
        </h1>
        {session?.mobileNumber && (
          <p className="mt-2 text-sm text-[#5B6472]">
            Signed in with {session.mobileNumber}
          </p>
        )}
      </main>
    </div>
  );
}