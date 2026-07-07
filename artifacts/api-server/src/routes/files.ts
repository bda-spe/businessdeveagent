import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  uploadedFilesTable,
  requirementsTable,
  extractedValuesTable,
} from "@workspace/db";
import {
  ListFilesResponse,
  UploadFileBody,
  UploadFileResponse,
  DeleteFileParams,
  ScanDocumentsResponse,
  ListExtractedValuesResponse,
  UpdateExtractedValueParams,
  UpdateExtractedValueBody,
  UpdateExtractedValueResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import { extractBusinessKnowledge } from "../lib/aiService";

const router: IRouter = Router();

router.get("/files", requireBusiness, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.businessId, req.business!.id))
    .orderBy(uploadedFilesTable.createdAt);
  res.json(ListFilesResponse.parse(rows));
});

router.post("/files", requireBusiness, async (req, res): Promise<void> => {
  const parsed = UploadFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // TODO: Deep document parsing (PDF/DOCX/image OCR) is not implemented.
  // The client sends plain-text content in textContent for now.
  const summary = parsed.data.textContent
    ? parsed.data.textContent.slice(0, 200)
    : null;
  const [row] = await db
    .insert(uploadedFilesTable)
    .values({
      businessId: req.business!.id,
      filename: parsed.data.filename,
      sizeBytes: parsed.data.sizeBytes,
      fileType: parsed.data.fileType,
      category: parsed.data.category ?? null,
      textContent: parsed.data.textContent ?? null,
      summary,
    })
    .returning();
  await logActivity(
    req.business!.id,
    "file_uploaded",
    `Document "${row.filename}" uploaded`,
  );
  res.status(201).json(UploadFileResponse.parse(row));
});

router.delete("/files/:id", requireBusiness, async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(uploadedFilesTable)
    .where(
      and(
        eq(uploadedFilesTable.id, params.data.id),
        eq(uploadedFilesTable.businessId, req.business!.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/files/scan", requireBusiness, async (req, res): Promise<void> => {
  const bid = req.business!.id;
  const [files, reqs] = await Promise.all([
    db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.businessId, bid)),
    db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.businessId, bid)),
  ]);

  const extracted = await extractBusinessKnowledge({
    business: {
      name: req.business!.name,
      industry: req.business!.industry,
      serviceArea: req.business!.serviceArea,
      customerType: req.business!.customerType,
    },
    requirements: reqs.map((r) => ({ key: r.key, label: r.label })),
    documents: files.map((f) => ({
      filename: f.filename,
      textContent: f.textContent,
    })),
  });

  await db
    .delete(extractedValuesTable)
    .where(eq(extractedValuesTable.businessId, bid));

  const inserted = await db
    .insert(extractedValuesTable)
    .values(
      extracted.map((e) => ({
        businessId: bid,
        requirementKey: e.requirementKey,
        requirementLabel: e.requirementLabel,
        extractedValue: e.extractedValue || null,
        sourceDocument: e.sourceDocument,
        confidenceScore: e.confidenceScore,
        approved: false,
      })),
    )
    .returning();

  await logActivity(
    bid,
    "documents_scanned",
    `BDA scanned ${files.length} document(s) and extracted ${inserted.length} value(s)`,
  );
  res.json(ScanDocumentsResponse.parse(inserted));
});

router.get(
  "/extracted-values",
  requireBusiness,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(extractedValuesTable)
      .where(eq(extractedValuesTable.businessId, req.business!.id))
      .orderBy(extractedValuesTable.id);
    res.json(ListExtractedValuesResponse.parse(rows));
  },
);

router.patch(
  "/extracted-values/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = UpdateExtractedValueParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateExtractedValueBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .update(extractedValuesTable)
      .set(parsed.data)
      .where(
        and(
          eq(extractedValuesTable.id, params.data.id),
          eq(extractedValuesTable.businessId, req.business!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Extracted value not found" });
      return;
    }
    res.json(UpdateExtractedValueResponse.parse(row));
  },
);

export default router;
