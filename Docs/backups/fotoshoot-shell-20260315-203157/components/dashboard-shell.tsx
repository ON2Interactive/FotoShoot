"use client";

import { useEffect, useRef, useState } from "react";

type MobilePanel = "left" | "center" | "right";
type UploadedImage = {
  id: string;
  name: string;
  url: string;
};

const toolbarItems = [
  { label: "Upload", icon: <UploadIcon /> },
  { label: "Save", icon: <SaveIcon /> },
  { label: "Preview", icon: <PreviewIcon /> },
  { label: "Share", icon: <ShareIcon /> },
  { label: "Code", icon: <CodeIcon /> },
  { label: "AI", icon: <WandIcon /> },
];

export default function DashboardShell() {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("center");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImageRef = useRef<HTMLImageElement>(null);
  const uploadedImagesRef = useRef<UploadedImage[]>([]);
  const [activeImageWidth, setActiveImageWidth] = useState<number | null>(null);

  const activeImage = uploadedImages.find((image) => image.id === activeImageId) ?? null;

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, []);

  useEffect(() => {
    const element = activeImageRef.current;

    if (!element) {
      setActiveImageWidth(null);
      return;
    }

    const updateWidth = () => {
      setActiveImageWidth(element.clientWidth || null);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, [activeImage]);

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const nextImages = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: URL.createObjectURL(file),
      }));

    if (nextImages.length === 0) {
      return;
    }

    setUploadedImages((current) => {
      const merged = [...current, ...nextImages];
      if (!activeImageId) {
        setActiveImageId(nextImages[0].id);
      }
      return merged;
    });
  }

  function handleDelete(imageId: string) {
    setUploadedImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }

      const next = current.filter((image) => image.id !== imageId);

      if (activeImageId === imageId) {
        setActiveImageId(next[0]?.id ?? null);
      }

      return next;
    });
  }

  return (
    <div className="workspace-shell">
      <input
        ref={fileInputRef}
        className="workspace-file-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          handleUpload(event.target.files);
          event.target.value = "";
        }}
      />

      <header className="workspace-header">
        <div className="workspace-header-brand">
          <div className="workspace-header-badge">FS</div>
          <div className="workspace-header-copy">
            <span>FotoShoot</span>
            <small>Nano Banana 2 workspace</small>
          </div>
        </div>

        <div className="workspace-header-actions">
          {toolbarItems.map((item) => (
            <button
              key={item.label}
              aria-label={item.label}
              className="workspace-toolbar-icon"
              type="button"
              onClick={item.label === "Upload" ? () => fileInputRef.current?.click() : undefined}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </header>

      <div className="workspace-mobile-tabs" role="tablist" aria-label="Panels">
        <button
          className={`workspace-mobile-tab${activeMobilePanel === "left" ? " is-active" : ""}`}
          type="button"
          onClick={() => setActiveMobilePanel("left")}
        >
          Upload
        </button>
        <button
          className={`workspace-mobile-tab${activeMobilePanel === "center" ? " is-active" : ""}`}
          type="button"
          onClick={() => setActiveMobilePanel("center")}
        >
          Canvas
        </button>
        <button
          className={`workspace-mobile-tab${activeMobilePanel === "right" ? " is-active" : ""}`}
          type="button"
          onClick={() => setActiveMobilePanel("right")}
        >
          Output
        </button>
      </div>

      <div className="workspace-layout-frame">
        <aside className={`workspace-sidebar workspace-sidebar-left${activeMobilePanel === "left" ? " is-mobile-active" : ""}`}>
          <div className="workspace-empty-panel" aria-hidden="true" />
        </aside>

        <main className={`workspace-main${activeMobilePanel === "center" ? " is-mobile-active" : ""}`}>
          <div className="workspace-main-surface">
            <div className="workspace-center-stack">
              {activeImage ? (
                <div className="workspace-image-stage">
                  <div className="workspace-image-frame">
                    <img
                      ref={activeImageRef}
                      alt={activeImage.name}
                      className="workspace-stage-image"
                      src={activeImage.url}
                    />

                    <div className="workspace-prompt-panel" style={activeImageWidth ? { width: `${activeImageWidth}px` } : undefined}>
                      <label className="workspace-prompt-field">
                        <textarea
                          className="workspace-prompt-input"
                          placeholder="Describe what you want to generate from this image..."
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                        />
                        <button aria-label="Send prompt" className="workspace-prompt-submit" type="button">
                          <PaperPlaneIcon />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="workspace-image-empty">
                  <p>Select an uploaded image to preview it here.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className={`workspace-sidebar workspace-sidebar-right workspace-utility${activeMobilePanel === "right" ? " is-mobile-active" : ""}`}>
          <div className="workspace-assets-panel">
            {uploadedImages.length > 0 ? (
              uploadedImages.map((image) => (
                <div key={image.id} className={`workspace-asset-row${image.id === activeImageId ? " is-active" : ""}`}>
                  <button className="workspace-asset-select" type="button" onClick={() => setActiveImageId(image.id)}>
                    <img alt={image.name} className="workspace-asset-thumb" src={image.url} />
                    <span className="workspace-asset-name">{image.name}</span>
                  </button>
                  <button
                    aria-label={`Delete ${image.name}`}
                    className="workspace-asset-delete"
                    type="button"
                    onClick={() => handleDelete(image.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            ) : (
              <div className="workspace-assets-empty">
                <p>Uploaded images will appear here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 10L12 6L16 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4H16L19 7V19H5V5C5 4.44772 5.44772 4 6 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 4V9H15V4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 15H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.75 12C4.72 8.51 8.07 6.25 12 6.25C15.93 6.25 19.28 8.51 21.25 12C19.28 15.49 15.93 17.75 12 17.75C8.07 17.75 4.72 15.49 2.75 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 8L19 4M19 4H15M19 4V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6C5 5.44772 5.44772 5 6 5H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 8L5 12L9 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8L19 12L15 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20L14 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 5V2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 10H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 6.5L19.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 13.5L19.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7L17 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 7L8 19H16L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5L19.5 4.5L14 19.5L11 13L4 11.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
