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
  { label: "Download", icon: <DownloadIcon /> },
  { label: "Share", icon: <ShareIcon /> },
  { label: "Crop", icon: <CropIcon /> },
  { label: "AI", icon: <WandIcon /> },
];

export default function DashboardShell() {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("center");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sepia, setSepia] = useState(0);
  const [vibrance, setVibrance] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImageRef = useRef<HTMLImageElement>(null);
  const uploadedImagesRef = useRef<UploadedImage[]>([]);
  const [activeImageWidth, setActiveImageWidth] = useState<number | null>(null);

  const activeImage = uploadedImages.find((image) => image.id === activeImageId) ?? null;
  const vibranceSaturate = 100 + (vibrance - 100) * 0.65;
  const vibranceContrast = 100 + (vibrance - 100) * 0.18;
  const activeImageFilter = `brightness(${brightness}%) saturate(${saturation}%) sepia(${sepia}%) saturate(${vibranceSaturate}%) contrast(${vibranceContrast}%)`;

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
          <div className="workspace-sidebar-topbar">
            <button
              aria-label="Upload images"
              className="workspace-panel-upload"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon />
            </button>
          </div>

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
                <p />
              </div>
            )}
          </div>
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
                      style={{ filter: activeImageFilter }}
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
                  <p>Upload Photos</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className={`workspace-sidebar workspace-sidebar-right workspace-utility${activeMobilePanel === "right" ? " is-mobile-active" : ""}`}>
          <div className="workspace-controls-panel">
            <SliderControl label="Brightness" min={50} max={150} step={1} value={brightness} onChange={setBrightness} onReset={() => setBrightness(100)} />
            <SliderControl label="Saturation" min={0} max={200} step={1} value={saturation} onChange={setSaturation} onReset={() => setSaturation(100)} />
            <SliderControl label="Vibrance" min={0} max={200} step={1} value={vibrance} onChange={setVibrance} onReset={() => setVibrance(100)} />
            <SliderControl label="Sepia" min={0} max={100} step={1} value={sepia} onChange={setSepia} onReset={() => setSepia(0)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  onReset,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <label className="workspace-slider-control">
      <div className="workspace-slider-header">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        className="workspace-slider-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={onReset}
      />
    </label>
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

function DownloadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 11L12 15L16 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="19" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11L16 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 13L16 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3V17C7 18.1046 7.89543 19 9 19H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 21V7C17 5.89543 16.1046 5 15 5H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.59 3.41a1 1 0 0 0-1.05-.24l-16 6a1 1 0 0 0 .08 1.9l6.56 1.97 1.97 6.56a1 1 0 0 0 .82.7h.11a1 1 0 0 0 .89-.54l6-16a1 1 0 0 0-.38-1.15Z" />
    </svg>
  );
}
