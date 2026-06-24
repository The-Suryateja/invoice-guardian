import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload invoice — InvoiceGuard" }] }),
  component: UploadPage,
});

const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function UploadPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const onFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      try {
        let i = 0;
        for (const file of list) {
          i += 1;
          setProgress(`Uploading ${i} of ${list.length}: ${file.name}`);
          if (!ACCEPT.includes(file.type)) {
            toast.error(`${file.name}: unsupported file type`);
            continue;
          }
          if (file.size > MAX_BYTES) {
            toast.error(`${file.name}: exceeds 10MB`);
            continue;
          }
          const ext = file.name.split(".").pop() ?? "bin";
          const objectId = crypto.randomUUID();
          const path = `${user.id}/${objectId}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("invoices")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) {
            toast.error(`${file.name}: ${upErr.message}`);
            continue;
          }

          const { error: insErr } = await supabase.from("invoices").insert({
            user_id: user.id,
            file_path: path,
            file_name: file.name,
            file_mime: file.type,
            file_size_bytes: file.size,
            status: "uploaded",
          });
          if (insErr) {
            toast.error(`${file.name}: ${insErr.message}`);
            continue;
          }
        }
        toast.success("Upload complete");
        navigate({ to: "/invoices" });
      } finally {
        setUploading(false);
        setProgress("");
      }
    },
    [navigate, user.id],
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Upload invoices</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        PDF, JPG, PNG, or WEBP — up to 10MB each. You can drop multiple files at once.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card px-6 py-16 text-center transition-colors",
          dragging ? "border-primary bg-accent/40" : "border-border",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
        </div>
        <p className="mt-4 text-sm font-medium">
          {uploading ? progress : "Drag and drop invoice files here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">or</p>
        <Button
          variant="outline"
          className="mt-3"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <FileText className="size-4" />
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Already uploaded files appear on the{" "}
        <Link to="/invoices" className="text-primary hover:underline">
          Invoices
        </Link>{" "}
        page. AI extraction starts in the next phase.
      </p>
    </div>
  );
}
