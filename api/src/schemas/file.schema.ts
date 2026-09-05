import { z } from "zod";

export const uploadFileSchema = z.object({
  folderId: z.uuid().nullable().optional(),
})

export const updateFileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.uuid().nullable().optional(),
}).refine(
    (d) => d.name !== undefined || d.folderId !== undefined,
    { message: "Provide at least one field to update" }
)

// step 1 of the large-file path: ask for a signed URL to upload straight to storage
export const createUploadUrlSchema = z.object({
  folderId: z.uuid().nullable().optional(),
  // checked against MAX_DIRECT_UPLOAD_BYTES so an oversized file fails before
  // the browser spends minutes pushing bytes storage will reject
  sizeBytes: z.number().int().positive().optional(),
})

// step 2: the blob is up, record it. size and mime are read back from storage
// rather than taken from the body — the client has no reason to be believed here.
export const completeUploadSchema = z.object({
  storageKey: z.string().min(1).max(512),
  name: z.string().min(1).max(255),
  folderId: z.uuid().nullable().optional(),
})
