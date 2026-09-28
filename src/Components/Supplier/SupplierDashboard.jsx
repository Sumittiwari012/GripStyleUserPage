import ProductPerformance from "./SupplierPerformance";

/**
 * Rendered by SupplierLoginPage once the supplier is signed in.
 * `session` is { customerId, customerName, mobileNumber } from VerifyLoginOtp
 * (customerId is the supplier id); `onLogout` clears the saved session.
 */
export default function SupplierDashboard({ session, onLogout }) {
  return (
    <ProductPerformance
      supplierId={session?.customerId}
      supplierName={session?.customerName}
      onLogout={onLogout}
    />
  );
}