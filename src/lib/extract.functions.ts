import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const EXTRACTION_PROMPT = `You are an invoice data extraction system. Extract structured data from the invoice provided.

Return ONLY valid JSON matching exactly this shape (no markdown, no prose, no code fences):
{
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "vendor": { "name": string | null, "gstin": string | null, "address": string | null },
  "buyer": { "name": string | null, "gstin": string | null },
  "line_items": [ { "description": string, "quantity": number | null, "unit_price": number | null, "amount": number } ],
  "subtotal": number | null,
  "tax": { "cgst": number | null, "sgst": number | null, "igst": number | null, "total_tax": number | null },
  "total_amount": number,
  "currency": string,
  "extraction_confidence": number
}

Rules:
- Use null for any field you cannot read with confidence. Never guess or hallucinate values.
- Normalize all dates to ISO YYYY-MM-DD.
- Strip currency symbols and thousands separators. Amounts must be plain numbers (e.g. 1234.50).
- Currency defaults to "INR" if not otherwise indicated.
- extraction_confidence is your self-assessed confidence between 0 and 1 for the overall extraction.
- Line items: include every row. If a row lacks an amount, skip it.`;

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return t.trim();
}

export const extractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

    const { supabase, userId } = context;

    const { data: invoice, error: fetchErr } = await supabase
      .from("invoices")
      .select("id, file_path, file_mime, file_name, user_id")
      .eq("id", data.invoiceId)
      .single();
    if (fetchErr || !invoice) throw new Error(fetchErr?.message ?? "Invoice not found");
    if (invoice.user_id !== userId) throw new Error("Forbidden");

    const { data: blob, error: dlErr } = await supabase.storage
      .from("invoices")
      .download(invoice.file_path);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "Could not download file");

    const buf = new Uint8Array(await blob.arrayBuffer());
    // Base64 encode
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as unknown as number[]);
    }
    const b64 = btoa(binary);
    const mime = invoice.file_mime || "application/octet-stream";
    const dataUrl = `data:${mime};base64,${b64}`;

    const isImage = mime.startsWith("image/");
    const contentPart = isImage
      ? { type: "image_url" as const, image_url: { url: dataUrl } }
      : { type: "file" as const, file: { filename: invoice.file_name, file_data: dataUrl } };

    const openai = new OpenAI({ apiKey });

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              contentPart,
            ] as never,
          },
        ],
        response_format: { type: "json_object" },
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
      if (status === 401) throw new Error("Invalid OpenAI API key.");
      throw new Error(
        `AI extraction failed${status ? ` (${status})` : ""}: ${
          err instanceof Error ? err.message.slice(0, 300) : "unknown error"
        }`,
      );
    }

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      throw new Error("AI returned invalid JSON");
    }


    return { extraction: parsed as any };
  });
