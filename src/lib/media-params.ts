/* Media upload params: never pass `undefined` to the multipart serializer —
   masto's flattenForFormData keeps it and FormData turns it into "undefined". */

export interface MediaCreateParams {
  file: File;
  description?: string;
}

export function mediaCreateParams(file: File, description?: string): MediaCreateParams {
  const clean = description?.trim();
  if (!clean) return { file };
  return { file, description: clean };
}
