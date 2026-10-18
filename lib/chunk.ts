// Text chunking: ~1000 chars per chunk with 200-char overlap, paragraph-aware.

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_MAX = 1000;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into overlapping chunks. Splits on paragraph boundaries first,
 * then on sentence boundaries, and only hard-splits mid-word as a last resort.
 * Each chunk is at most `maxChars` characters; consecutive chunks share
 * `overlap` characters so context survives chunk boundaries.
 */
export function chunkText(
  text: string,
  { maxChars = DEFAULT_MAX, overlap = DEFAULT_OVERLAP }: ChunkOptions = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  // Split into paragraphs, then build chunks greedily.
  const paragraphs = normalized.split(/\n{2,}|\n/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;
    if ((current + "\n\n" + p).trim().length <= maxChars) {
      current = current ? current + "\n\n" + p : p;
      continue;
    }
    // Paragraph doesn't fit: flush current, then split the paragraph by sentences.
    pushCurrent();
    const sentences = p.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [p];
    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;
      if ((current + " " + sentence).trim().length <= maxChars) {
        current = current ? current + " " + sentence : sentence;
      } else {
        pushCurrent();
        // Single sentence still too long: hard-split it.
        if (sentence.length > maxChars) {
          for (let i = 0; i < sentence.length; i += maxChars - overlap) {
            const piece = sentence.slice(i, i + maxChars).trim();
            if (piece) chunks.push(piece);
          }
        } else {
          current = sentence;
        }
      }
    }
    pushCurrent();
  }
  pushCurrent();

  // Add overlap: prepend the tail of the previous chunk to each chunk,
  // trimming the tail so no chunk exceeds maxChars.
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const room = maxChars - chunk.length - 1; // 1 for the joining space
    if (room <= 0) return chunk;
    const tail = prev.slice(Math.max(0, prev.length - Math.min(overlap, room)));
    return (tail + " " + chunk).trim();
  });
}
