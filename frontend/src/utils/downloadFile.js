import api from './api';
import toast from 'react-hot-toast';

/**
 * Download a PDF (or any binary) from an authenticated API endpoint and trigger
 * a browser "Save As". Uses the shared `api` axios instance so the JWT (and its
 * refresh flow) is applied automatically.
 *
 * @param {string} url       API path relative to API_BASE, e.g. '/exports/consultant/referrals/123'
 * @param {string} fallback  Filename to use if the server sends no Content-Disposition
 */
export async function downloadPdf(url, fallback = 'carebridge-download.pdf') {
  const toastId = toast.loading('Preparing download…');
  try {
    const res = await api.get(url, { responseType: 'blob' });

    // The server may return a JSON error body even though we asked for a blob.
    const contentType = res.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const text = await res.data.text();
      let message = 'Download failed';
      try {
        message = JSON.parse(text).message || message;
      } catch {
        /* ignore parse error */
      }
      throw new Error(message);
    }

    // Prefer the server-provided filename.
    let filename = fallback;
    const disposition = res.headers['content-disposition'];
    if (disposition) {
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      if (match) filename = decodeURIComponent(match[1]);
    }

    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);

    toast.success('Download ready', { id: toastId });
  } catch (err) {
    toast.error(err?.message || 'Download failed', { id: toastId });
  }
}
