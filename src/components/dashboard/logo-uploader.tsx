"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, Upload, Trash2 } from "lucide-react";
import { uploadLogo, removeLogo, type LogoState } from "@/app/(dashboard)/dashboard/settings/logo-actions";
import { Button } from "@/components/ui/button";
import { shrinkLogo } from "@/lib/image-resize";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: LogoState = {};

export function LogoUploader({ logoUrl }: { logoUrl?: string | null }) {
  const [state, action] = useFormState(uploadLogo, initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Current logo = freshly uploaded > local preview > saved.
  const current = state.logoUrl ?? logoUrl ?? null;

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Logo</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Appears on your donation page, campaigns, receipts and emails. PNG, JPG or WebP — large
        images are resized for you automatically.
      </p>

      {state.error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Logo updated.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-32 place-items-center overflow-hidden rounded-lg border border-border bg-secondary/40">
          {preview || current ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview ?? current ?? ""}
              alt="Logo preview"
              className="max-h-14 max-w-[120px] object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>

        <form action={action} className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="block max-w-[220px] text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
            onChange={async (e) => {
              const input = e.currentTarget;
              const f = input.files?.[0];
              setNote(null);
              if (!f) {
                setPreview(null);
                return;
              }
              setPreview(URL.createObjectURL(f));
              // Resize in the browser before upload, so a logo straight from a
              // designer doesn't bounce off the server's size limit.
              setPreparing(true);
              try {
                const small = await shrinkLogo(f);
                if (small !== f && typeof DataTransfer !== "undefined") {
                  const dt = new DataTransfer();
                  dt.items.add(small);
                  input.files = dt.files;
                  setNote(
                    `Resized from ${Math.round(f.size / 1024)} KB to ${Math.round(small.size / 1024)} KB.`
                  );
                }
              } finally {
                setPreparing(false);
              }
            }}
          />
          <SubmitButton size="sm" disabled={preparing}>
            <Upload className="size-4" /> {preparing ? "Preparing…" : "Upload"}
          </SubmitButton>
          {note && <span className="w-full text-xs text-muted-foreground">{note}</span>}
        </form>

        {current && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await removeLogo();
                setPreview(null);
                if (inputRef.current) inputRef.current.value = "";
              })
            }
          >
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
