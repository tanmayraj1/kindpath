import { MailWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { getDeliveryFailures } from "@/lib/queries/comms";
import { ResendMessageButton } from "@/components/dashboard/resend-message-button";

/**
 * Receipts and billing notices that never reached the donor.
 *
 * A donor whose receipt email failed is owed a tax receipt they don't have.
 * Surfacing this is the difference between an org discovering it now and
 * discovering it at tax time.
 */
export async function DeliveryFailures({ orgId }: { orgId: string }) {
  const { total, rows } = await getDeliveryFailures(orgId);
  if (total === 0) return null;

  return (
    <Card className="border-warning/40">
      <CardHeader className="flex-row items-center gap-2">
        <MailWarning className="size-5 text-warning" aria-hidden />
        <CardTitle>
          {total} message{total === 1 ? "" : "s"} didn&apos;t reach {total === 1 ? "its" : "their"}{" "}
          recipient
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          These donors have a receipt or billing notice on file that was never delivered. Their
          receipt is still valid and downloadable from the Receipts page. Try again below — if it
          fails a second time, correct the address on the donor&apos;s record first.
        </p>
        <Table>
          <Thead>
            <Th>Donor</Th>
            <Th>Message</Th>
            <Th>Date</Th>
            <Th className="text-right">Why</Th>
            <Th className="text-right">Retry</Th>
          </Thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <span className="font-medium">{r.donorName}</span>
                  {r.donorEmail && (
                    <span className="block text-xs text-muted-foreground">{r.donorEmail}</span>
                  )}
                </Td>
                <Td className="text-muted-foreground">{r.subject}</Td>
                <Td className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Td>
                <Td className="text-right">
                  <Badge variant={r.status === "failed" ? "destructive" : "warning"}>
                    {r.status === "failed" ? "Rejected" : "Never sent"}
                  </Badge>
                  {r.error && (
                    <span className="mt-1 block max-w-56 truncate text-xs text-muted-foreground">
                      {r.error}
                    </span>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <ResendMessageButton notificationId={r.id} />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}
