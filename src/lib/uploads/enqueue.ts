/**
 * Enqueue a confirmed document for background text/data extraction.
 *
 * THIS TASK ONLY: Stub implementation.
 * Currently marks or confirms document status as 'queued'.
 * A subsequent feature prompt replaces this with the actual queue/worker implementation.
 */
export async function enqueueExtraction(documentId: string): Promise<{ queued: boolean; documentId: string }> {
  // Stub: in this task, the document status is already set to 'queued' by confirm_document_upload RPC.
  // In the future extraction task, this will push an asynchronous job to the extraction queue.
  return {
    queued: true,
    documentId,
  };
}
