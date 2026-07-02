import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export type ReceiptData = {
  serialNumber: string;
  documentType: "official" | "confirmation" | "annual";
  donorName: string;
  donorAddress: string;
  orgName: string;
  orgAddress: string;
  orgRegNumber?: string | null;
  amount: number;
  advantageValue: number;
  eligibleAmount: number;
  placeIssued?: string | null;
  dateDonationReceived: string;
  dateIssued: string;
  signatoryName?: string | null;
  year: number;
  // white-label / customization
  brandColor?: string | null; // hex, e.g. #0d9488
  logoUrl?: string | null;
  message?: string | null; // custom thank-you / note
  footer?: string | null; // custom footer line
};

const DEFAULT_BRAND = "#4f46e5";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const HEX = /^#?[0-9a-fA-F]{6}$/;
function brandOf(color?: string | null): string {
  if (!color) return DEFAULT_BRAND;
  return HEX.test(color) ? (color.startsWith("#") ? color : `#${color}`) : DEFAULT_BRAND;
}

const s = StyleSheet.create({
  page: { padding: 0, fontSize: 10, color: INK, fontFamily: "Helvetica", lineHeight: 1.5 },
  accent: { height: 6 },
  body: { padding: 48 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { height: 38, maxWidth: 180, objectFit: "contain", marginBottom: 8 },
  orgName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK },
  orgMeta: { fontSize: 9, color: MUTED, marginTop: 2 },
  badge: { fontSize: 8, color: "#ffffff", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  title: { marginTop: 28, fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, textTransform: "uppercase", letterSpacing: 0.5 },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 2 },
  message: { marginTop: 12, fontSize: 10, color: INK },
  rule: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 16 },
  twoCol: { flexDirection: "row", justifyContent: "space-between" },
  col: { width: "48%" },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10, color: INK, marginBottom: 8 },
  amountBox: { marginTop: 16, borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 16 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  eligibleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  eligibleLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  eligibleValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigBlock: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginTop: 28, paddingTop: 4 },
  customFooter: { marginTop: 24, fontSize: 9, color: INK },
  footer: { marginTop: 16, fontSize: 8, color: MUTED, lineHeight: 1.4 },
});

function money(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const official = data.documentType !== "confirmation";
  const hasAdvantage = data.advantageValue > 0;
  const brand = brandOf(data.brandColor);

  return (
    <Document
      title={`Receipt ${data.serialNumber}`}
      author={data.orgName}
      subject={official ? "Official Donation Receipt" : "Payment Confirmation"}
    >
      <Page size="A4" style={s.page}>
        <View style={[s.accent, { backgroundColor: brand }]} />
        <View style={s.body}>
          <View style={s.headerRow}>
            <View>
              {data.logoUrl ? <Image src={data.logoUrl} style={s.logo} /> : null}
              <Text style={s.orgName}>{data.orgName}</Text>
              <Text style={s.orgMeta}>{data.orgAddress}</Text>
              {official && data.orgRegNumber ? (
                <Text style={s.orgMeta}>Charity registration no. {data.orgRegNumber}</Text>
              ) : null}
            </View>
            <Text style={[s.badge, { backgroundColor: brand }]}>{data.serialNumber}</Text>
          </View>

          <Text style={s.title}>
            {official
              ? data.documentType === "annual"
                ? "Official Donation Receipt — Annual"
                : "Official Receipt for Income Tax Purposes"
              : "Payment Confirmation"}
          </Text>
          <Text style={s.subtitle}>
            {official
              ? "Issued by a registered charity under the Income Tax Act (Canada)."
              : "This is a confirmation of payment. It is NOT an official tax receipt."}
          </Text>

          {data.message ? <Text style={s.message}>{data.message}</Text> : null}

          <View style={s.rule} />

          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Donated by</Text>
              <Text style={s.value}>{data.donorName}</Text>
              <Text style={s.label}>Address</Text>
              <Text style={s.value}>{data.donorAddress}</Text>
            </View>
            <View style={s.col}>
              <Text style={s.label}>Date donation received</Text>
              <Text style={s.value}>{data.dateDonationReceived}</Text>
              <Text style={s.label}>Date receipt issued</Text>
              <Text style={s.value}>{data.dateIssued}</Text>
              {data.placeIssued ? (
                <>
                  <Text style={s.label}>Place issued</Text>
                  <Text style={s.value}>{data.placeIssued}</Text>
                </>
              ) : null}
            </View>
          </View>

          <View style={s.amountBox}>
            <View style={s.amountRow}>
              <Text>Total amount received</Text>
              <Text>{money(data.amount)}</Text>
            </View>
            {hasAdvantage ? (
              <View style={s.amountRow}>
                <Text>Value of advantage received</Text>
                <Text>− {money(data.advantageValue)}</Text>
              </View>
            ) : null}
            <View style={s.eligibleRow}>
              <Text style={s.eligibleLabel}>
                {official ? "Eligible amount of gift for tax purposes" : "Amount paid"}
              </Text>
              <Text style={[s.eligibleValue, { color: brand }]}>{money(data.eligibleAmount)}</Text>
            </View>
          </View>

          {official ? (
            <View style={s.sigRow}>
              <View style={s.sigBlock}>
                <View style={s.sigLine}>
                  <Text style={s.label}>Authorized signature</Text>
                  <Text style={s.value}>{data.signatoryName ?? ""}</Text>
                </View>
              </View>
              <View style={s.sigBlock}>
                <View style={s.sigLine}>
                  <Text style={s.label}>Canada Revenue Agency</Text>
                  <Text style={s.value}>canada.ca/charities-giving</Text>
                </View>
              </View>
            </View>
          ) : null}

          {data.footer ? <Text style={s.customFooter}>{data.footer}</Text> : null}

          <Text style={s.footer}>
            {official
              ? `For information on charitable donations and tax credits, visit the Canada Revenue Agency at canada.ca/charities-giving. Retain this receipt for your records. Tax year ${data.year}.`
              : `This document confirms a payment to ${data.orgName} and cannot be used to claim a charitable tax credit. ${data.orgName} is not a registered charity.`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** Render a receipt to a PDF buffer (keeps JSX out of the route handler). */
export function renderReceiptPdf(data: ReceiptData) {
  return renderToBuffer(<ReceiptDocument data={data} />);
}
