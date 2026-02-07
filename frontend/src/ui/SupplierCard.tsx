import type { Supplier } from "../api/suppliers";

export default function SupplierCard({
  supplier,
  onOpen,
}: {
  supplier: Supplier;
  onOpen?: () => void;
}) {
  return (
    <div className="supplier-card">
      <div className="supplier-left">
        <div className="supplier-logo">
          <img src={supplier.logo} alt={supplier.name} onError={(e) => (e.currentTarget.src = "/media/usc.svg")} />
        </div>

        <div className="supplier-meta">
          <div className="supplier-name">{supplier.name}</div>
          <div className="supplier-sub">{supplier.subtitle}</div>
        </div>
      </div>

      <button type="button" className="supplier-open" onClick={onOpen} title="Открыть">
        Открыть
      </button>
    </div>
  );
}
