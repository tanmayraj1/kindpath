import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * KindPath's own subscription invoice — a business document for the customer's
 * books, not a donation receipt. It must show the tax rate and amount separately
 * so a registered charity can claim its input tax credits / public service body
 * rebate, and it must carry KindPath's own GST/HST registration number.
 */
export type InvoiceData = {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  billTo: { name: string; address: string };
  planLabel: string;
  periodLabel: string;
  subtotal: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  /** KindPath's GST/HST number. Absent until registered — flagged, not faked. */
  supplierTaxNumber?: string | null;
};

const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const BRAND = "#4f46e5";

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 10, color: INK, fontFamily: "Helvetica", lineHeight: 1.5 },
  accent: { height: 6, backgroundColor: BRAND },
  body: { padding: 48 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: INK },
  meta: { fontSize: 9, color: MUTED, marginTop: 2 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  number: { fontSize: 10, color: MUTED, marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 20 },
  twoCol: { flexDirection: "row", justifyContent: "space-between" },
  col: { width: "48%" },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10, marginBottom: 8 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 6,
    marginTop: 12,
  },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  cellDesc: { width: "70%" },
  cellAmt: { width: "30%", textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: "50%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: INK,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND },
  paidStamp: {
    position: "absolute",
    top: 300,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 96,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    opacity: 0.14,
    transform: "rotate(-24deg)",
  },
  footer: { marginTop: 32, fontSize: 8, color: MUTED, lineHeight: 1.5 },
});

function money(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const paid = data.status === "paid";

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author="KindPath" subject="Subscription invoice">
      <Page size="A4" style={s.page}>
        <View style={s.accent} />
        {paid ? (
          <Text style={s.paidStamp} fixed>
            PAID
          </Text>
        ) : null}
        <View style={s.body}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.brand}>KindPath</Text>
              <Text style={s.meta}>Donation management for Canadian charities</Text>
              {data.supplierTaxNumber ? (
                <Text style={s.meta}>GST/HST no. {data.supplierTaxNumber}</Text>
              ) : null}
            </View>
            <View>
              <Text style={s.title}>Invoice</Text>
              <Text style={s.number}>{data.invoiceNumber}</Text>
              <Text style={s.number}>{data.issuedAt}</Text>
            </View>
          </View>

          <View style={s.rule} />

          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Billed to</Text>
              <Text style={s.value}>{data.billTo.name}</Text>
              <Text style={s.value}>{data.billTo.address}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Billing period</Text>
              <Text style={s.value}>{data.periodLabel}</Text>
              <Text style={s.label}>Status</Text>
              <Text style={s.value}>{paid ? "Paid — thank you" : "Payment due on receipt"}</Text>
            </View>
          </View>

          <View style={s.tableHead}>
            <Text style={[s.cellDesc, s.label]}>Description</Text>
            <Text style={[s.cellAmt, s.label]}>Amount</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cellDesc}>{data.planLabel}</Text>
            <Text style={s.cellAmt}>{money(data.subtotal)}</Text>
          </View>

          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text>Subtotal</Text>
              <Text>{money(data.subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text>{data.taxLabel}</Text>
              <Text>{money(data.taxAmount)}</Text>
            </View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Total (CAD)</Text>
              <Text style={s.grandValue}>{money(data.total)}</Text>
            </View>
          </View>

          <Text style={s.footer}>
            {data.supplierTaxNumber
              ? "Tax shown is charged under the Excise Tax Act. Retain this invoice for your records."
              : "KindPath is not currently registered for GST/HST; the tax line above is shown for reference only."}
            {"\n"}
            Questions about this invoice? Reply to the email it arrived with, or contact KindPath support.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}
