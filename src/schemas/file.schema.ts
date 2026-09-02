import { z } from "zod";

export const uploadFileSchema = z.object({
  folderId: z.uuid().nullable().optional(),
})