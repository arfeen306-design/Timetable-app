import { useState } from "react";
import "./ShareSheet.css";

interface ShareSheetProps {
  blob: Blob;
  filename: string;
  title: string;
  recipientName?: string;
  onClose: () => void;
}

export default function ShareSheet({ blob, filename, title, recipientName, onClose }: ShareSheetProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileSizeKB = Math.round(blob.size / 1024);

  // Download the file locally
  function handleDownload() {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  // Upload to temp share URL, then open mailto
  async function handleEmail() {
    const tempUrl = await getOrUploadUrl();
    if (!tempUrl) { handleDownload(); return; }
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(
      `${recipientName ? `Dear ${recipientName},\n\n` : ""}Please find the document here: ${tempUrl}\n\nThis link expires in 24 hours.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // Upload to temp share URL, then open WhatsApp
  async function handleWhatsApp() {
    const tempUrl = await getOrUploadUrl();
    if (!tempUrl) { handleDownload(); return; }
    const text = encodeURIComponent(
      `${title}${recipientName ? ` for ${recipientName}` : ""}: ${tempUrl}`
    );
    // Use wa.me for mobile, web.whatsapp.com for desktop
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const waUrl = isMobile
      ? `https://wa.me/?text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;
    window.open(waUrl, "_blank");
  }

  async function getOrUploadUrl(): Promise<string | null> {
    if (shareUrl) return shareUrl;
    setUploading(true);
    try {
      // Try Web Share API first (mobile with file support)
      const pdfFile = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ title, files: [pdfFile] });
        onClose();
        return null; // native share handled it
      }
      // Fallback: upload to backend for temp URL
      const token = localStorage.getItem("timetable_token");
      const form = new FormData();
      form.append("file", blob, filename);
      const res = await fetch("/api/share/upload-pdf", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setShareUrl(data.url);
      return data.url;
    } catch {
      // If upload fails, fall back to direct download
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleCopyLink() {
    const url = await getOrUploadUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-sheet" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-header">
          <div className="share-file-info">
            <span className="share-file-icon">📄</span>
            <div>
              <div className="share-filename">{filename}</div>
              <div className="share-filesize">{fileSizeKB} KB</div>
            </div>
          </div>
          <button className="share-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="share-divider" />

        {/* Actions */}
        <div className="share-actions">
          <button className="share-action-btn share-email" onClick={handleEmail} disabled={uploading}>
            <span className="share-action-icon">✉️</span>
            <span>Share via Email</span>
          </button>

          <button className="share-action-btn share-whatsapp" onClick={handleWhatsApp} disabled={uploading}>
            <span className="share-action-icon">💬</span>
            <span>Share via WhatsApp</span>
          </button>

          <button className="share-action-btn share-download" onClick={handleDownload}>
            <span className="share-action-icon">⬇️</span>
            <span>Download only</span>
          </button>
        </div>

        <div className="share-divider" />

        {/* Copy link */}
        <div className="share-link-row">
          <span className="share-link-icon">🔗</span>
          <span className="share-link-text">Copy shareable link</span>
          <button className="share-copy-btn" onClick={handleCopyLink} disabled={uploading}>
            {uploading ? "Uploading…" : copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="share-link-note">Link expires in 24 hours</div>
      </div>
    </div>
  );
}
