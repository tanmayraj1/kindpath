"use client";

import {
  updateMembershipPlan,
  updateCampaign,
  updateEvent,
  updateTicketType,
  updatePledge,
  updateVolunteer,
  updateTeamMember,
} from "@/app/(dashboard)/dashboard/actions";
import { EditDialog } from "@/components/ui/edit-dialog";

/**
 * Edit buttons for the entities that were previously create-only.
 *
 * Grouped in one client module so each list page adds a single import rather
 * than a bespoke dialog per row. They all post to their own server action, which
 * re-checks tenancy before writing.
 */

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`; a Date or ISO string is not accepted. */
function forDateTimeInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function forDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function EditMembershipPlanButton({
  plan,
  members,
}: {
  plan: { id: string; name: string; description: string | null; amount: number; frequency: string };
  members: number;
}) {
  return (
    <EditDialog
      title="Edit membership plan"
      description={
        members > 0
          ? `${members} member${members === 1 ? " is" : "s are"} on this plan. Changing the amount here sets the price for NEW members — existing members keep the amount they agreed to, because we won't bill someone on terms they didn't accept.`
          : "Nobody has joined this plan yet, so changes take effect immediately."
      }
      action={updateMembershipPlan}
      values={{ id: plan.id }}
      fields={[
        { name: "name", label: "Plan name", value: plan.name, required: true },
        { name: "amount", kind: "number", label: "Amount (CAD)", value: plan.amount, required: true, step: "0.01", min: "1" },
        {
          name: "frequency",
          kind: "select",
          label: "Billed",
          value: plan.frequency,
          options: [
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "quarterly", label: "Quarterly" },
            { value: "annual", label: "Annually" },
          ],
        },
        { name: "description", kind: "textarea", label: "Description", value: plan.description, rows: 3 },
      ]}
    />
  );
}

export function EditCampaignButton({
  campaign,
  funds,
}: {
  campaign: {
    id: string;
    title: string;
    goal: number;
    fundId?: string | null;
    deadline?: Date | string | null;
    accent?: string | null;
    description?: string | null;
  };
  funds: { id: string; name: string }[];
}) {
  return (
    <EditDialog
      title="Edit campaign"
      description="The campaign's public link stays the same, so anything already shared or printed keeps working."
      action={updateCampaign}
      values={{ id: campaign.id }}
      fields={[
        { name: "title", label: "Title", value: campaign.title, required: true },
        { name: "goalAmount", kind: "number", label: "Goal (CAD)", value: campaign.goal, required: true, step: "1", min: "1" },
        {
          name: "fundId",
          kind: "select",
          label: "Fund",
          value: campaign.fundId ?? "none",
          options: [{ value: "none", label: "No specific fund" }, ...funds.map((f) => ({ value: f.id, label: f.name }))],
        },
        { name: "deadline", kind: "date", label: "Deadline", value: forDateInput(campaign.deadline), hint: "Leave blank for no deadline." },
        { name: "description", kind: "textarea", label: "Description", value: campaign.description, rows: 4 },
      ]}
    />
  );
}

export function EditEventButton({
  event,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startsAt: Date | string | null;
  };
}) {
  return (
    <EditDialog
      title="Edit event"
      description="Updates the public event page immediately. Tickets already sold keep their receipts and stay valid."
      action={updateEvent}
      values={{ id: event.id }}
      fields={[
        { name: "title", label: "Title", value: event.title, required: true },
        { name: "startsAt", kind: "text", label: "Starts at", value: forDateTimeInput(event.startsAt), hint: "Format: YYYY-MM-DDTHH:mm" },
        { name: "location", label: "Location", value: event.location },
        { name: "description", kind: "textarea", label: "Description", value: event.description, rows: 4 },
      ]}
    />
  );
}

export function EditTicketTypeButton({
  ticket,
  eventId,
}: {
  ticket: { id: string; name: string; price: number; advantageValue: number };
  eventId: string;
}) {
  return (
    <EditDialog
      title="Edit ticket type"
      description="The advantage is the value the attendee receives (a meal, a seat). It is subtracted from the amount eligible for a tax receipt, so it must be less than the price."
      action={updateTicketType}
      values={{ id: ticket.id, eventId }}
      fields={[
        { name: "name", label: "Ticket name", value: ticket.name, required: true },
        { name: "price", kind: "number", label: "Price (CAD)", value: ticket.price, required: true, step: "0.01", min: "1" },
        { name: "advantage", kind: "number", label: "Advantage value (CAD)", value: ticket.advantageValue, step: "0.01", min: "0" },
      ]}
    />
  );
}

export function EditPledgeButton({
  pledge,
  campaigns,
}: {
  pledge: {
    id: string;
    donorName: string;
    donorEmail: string | null;
    amount: number;
    campaign?: string | null;
    campaignId?: string | null;
    dueDate: Date | string | null;
    note: string | null;
  };
  campaigns: { id: string; title: string }[];
}) {
  return (
    <EditDialog
      title="Edit pledge"
      action={updatePledge}
      values={{ id: pledge.id }}
      fields={[
        { name: "donorName", label: "Donor name", value: pledge.donorName, required: true },
        { name: "donorEmail", kind: "email", label: "Donor email", value: pledge.donorEmail },
        { name: "amount", kind: "number", label: "Amount (CAD)", value: pledge.amount, required: true, step: "0.01", min: "1" },
        {
          name: "campaignId",
          kind: "select",
          label: "Campaign",
          value: pledge.campaignId ?? "none",
          options: [{ value: "none", label: "No campaign" }, ...campaigns.map((c) => ({ value: c.id, label: c.title }))],
        },
        { name: "dueDate", kind: "date", label: "Due date", value: forDateInput(pledge.dueDate) },
        { name: "note", kind: "textarea", label: "Note", value: pledge.note, rows: 3 },
      ]}
    />
  );
}

export function EditVolunteerButton({
  volunteer,
}: {
  volunteer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string | null;
  };
}) {
  return (
    <EditDialog
      title="Edit volunteer"
      action={updateVolunteer}
      values={{ id: volunteer.id }}
      fields={[
        { name: "firstName", label: "First name", value: volunteer.firstName, required: true },
        { name: "lastName", label: "Last name", value: volunteer.lastName, required: true },
        { name: "email", kind: "email", label: "Email", value: volunteer.email, required: true },
        { name: "phone", label: "Phone", value: volunteer.phone },
        { name: "role", label: "Role", value: volunteer.role, hint: "e.g. Greeter, Kitchen, Youth leader." },
      ]}
    />
  );
}

export function EditTeamMemberButton({
  member,
}: {
  member: { id: string; name: string; email: string };
}) {
  return (
    <EditDialog
      title="Edit team member"
      description={`Corrects the display name for ${member.email}. The email address is their sign-in identity and can't be changed here — that would lock them out of an account still listed as theirs.`}
      action={updateTeamMember}
      values={{ id: member.id }}
      fields={[{ name: "name", label: "Name", value: member.name, required: true }]}
    />
  );
}
