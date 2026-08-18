import { Chip } from "@/components/ui/chip";
import { formatCurrency } from "@/lib/format";
import { SupplierSpend } from "@/lib/dashboard-data";

export function TopSuppliersTable({ suppliers }: { suppliers: SupplierSpend[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Leverancier</th>
            <th>BTW-nummer</th>
            <th className="num">Facturen</th>
            <th className="num">Besteed (excl. btw)</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((entry) => (
            <tr key={entry.supplier.name}>
              <td>{entry.supplier.name}</td>
              <td>
                {entry.supplier.vatNumber ? (
                  entry.supplier.vatNumber
                ) : (
                  <Chip tone="gray">onbekend</Chip>
                )}
              </td>
              <td className="num">{entry.invoiceCount}</td>
              <td className="num">{formatCurrency(entry.ytdSpendExVat, entry.currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
