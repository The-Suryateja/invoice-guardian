import { createServerFn } from "@tanstack/react-start";
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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
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
      ? { type: "image_url", image_url: { url: dataUrl } }
      : { type: "file", file: { filename: invoice.file_name, file_data: dataUrl } };

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            contentPart,
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 429) throw new Error("AI rate limit reached. Please try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI extraction failed (${resp.status}): ${errText.slice(0, 300)}`);
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(stripJsonFences(raw));
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    return { extraction: parsed as any };
  });
