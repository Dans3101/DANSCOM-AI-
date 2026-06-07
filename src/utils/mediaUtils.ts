
export async function downloadMediaBuffer(url: string, timeoutMs = 25000): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,audio/mp4,audio/mpeg,audio/*,video/*,*/*',
        'Referer': 'https://google.com/'
      }
    });
    if (!response.ok) {
      console.warn(`[Downloader] Fetch failed with status: ${response.status} for url: ${url}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 50) {
      console.warn(`[Downloader] Received empty/too-small buffer: ${arrayBuffer?.byteLength} bytes`);
      return null;
    }
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error('[Downloader] Buffer download error:', err.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
