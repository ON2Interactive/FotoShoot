"use client";

import { useEffect, useRef, useState } from "react";

type MobilePanel = "left" | "center" | "right";
type EditMode = "upload_enhance" | "magic_wand" | "studio_shoot" | "crop_reframe" | "prompt_edit";
type ImageStatus = "idle" | "processing" | "error";
type CropPreset = "auto" | "1:1" | "4:5" | "16:9" | "9:16" | "product";
type ExportPayload = {
  imageBase64: string;
  mimeType: string;
  filename: string;
};

type AccountSummary = {
  email: string;
  name: string;
  avatarUrl: string | null;
  creditsBalance: number;
  trialCreditsRemaining: number;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
};

type UploadedImage = {
  id: string;
  name: string;
  url: string;
  originalUrl: string;
  originalFile: File;
  currentFile: File;
  status: ImageStatus;
  activeJob: EditMode | null;
  error: string | null;
};

type PersistedImageRecord = {
  id: string;
  name: string;
  originalFile: File;
  currentFile: File;
  status: ImageStatus;
  activeJob: EditMode | null;
  error: string | null;
};

type PersistedWorkspaceSession = {
  id: string;
  updatedAt: number;
  activeMobilePanel: MobilePanel;
  activeImageId: string | null;
  prompt: string;
  brightness: number;
  saturation: number;
  contrast: number;
  warmth: number;
  sepia: number;
  images: PersistedImageRecord[];
};

const WORKSPACE_DB_NAME = "fotoshoot-workspace";
const WORKSPACE_STORE_NAME = "sessions";
const WORKSPACE_DB_VERSION = 1;
const WORKSPACE_LAST_SESSION_KEY = "fotoshoot:last-session-id";
const WORKSPACE_DEFAULT_SESSION_ID = "default";

const toolbarItems = [
  { label: "Download", icon: <DownloadIcon /> },
  { label: "Reset", icon: <ResetIcon /> },
  { label: "Share", icon: <ShareIcon /> },
  { label: "Crop", icon: <CropIcon /> },
  { label: "Studio", icon: <StudioIcon /> },
  { label: "AI", icon: <WandIcon /> },
];

const cropOptions: Array<{ label: string; preset: CropPreset }> = [
  { label: "Auto", preset: "auto" },
  { label: "1:1", preset: "1:1" },
  { label: "4:5", preset: "4:5" },
  { label: "16:9", preset: "16:9" },
  { label: "9:16", preset: "9:16" },
  { label: "Product", preset: "product" },
];

const studioQuickPresets = [
  {
    label: "Ecommerce",
    prompt:
      "Create a clean ecommerce product shot with bright balanced lighting, grounded shadow, simple backdrop, and retailer-safe composition.",
  },
  {
    label: "Studio",
    prompt:
      "Create a premium studio product shot with refined lighting, polished surface styling, controlled reflections, and luxury brand presentation.",
  },
  {
    label: "Editorial",
    prompt:
      "Create an editorial product image with soft directional shadows, elevated composition, and tasteful premium atmosphere.",
  },
  {
    label: "Marketplace",
    prompt:
      "Create a marketplace-ready image on a clean white background with accurate product isolation, realistic grounding, and centered composition.",
  },
  {
    label: "Lifestyle",
    prompt:
      "Create a natural lifestyle product image with believable ambient light, realistic environment styling, and commercial realism.",
  },
];

export default function DashboardShell({
  initialAccount = {
    email: "",
    name: "",
    avatarUrl: null,
    creditsBalance: 0,
    trialCreditsRemaining: 0,
    subscriptionPlan: null,
    subscriptionStatus: null,
    stripeCustomerId: null,
  },
}: {
  initialAccount?: AccountSummary;
}) {
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("center");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [warmth, setWarmth] = useState(100);
  const [sepia, setSepia] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [account, setAccount] = useState<AccountSummary>(initialAccount);
  const [settingsBusyAction, setSettingsBusyAction] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeImageRef = useRef<HTMLImageElement>(null);
  const uploadedImagesRef = useRef<UploadedImage[]>([]);
  const cropPopoverRef = useRef<HTMLDivElement>(null);
  const studioPopoverRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [activeImageWidth, setActiveImageWidth] = useState<number | null>(null);
  const [isCropPopoverOpen, setIsCropPopoverOpen] = useState(false);
  const [isStudioPopoverOpen, setIsStudioPopoverOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);

  const activeImage = uploadedImages.find((image) => image.id === activeImageId) ?? null;
  const warmthSepia = Math.max(0, Math.min(24, (warmth - 100) * 0.24));
  const warmthHue = (warmth - 100) * -0.12;
  const activeImageFilter = `brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%) sepia(${warmthSepia}%) hue-rotate(${warmthHue}deg) sepia(${sepia}%)`;
  const isPromptDisabled = !activeImage || activeImage.status === "processing" || prompt.trim().length === 0;
  const isProcessingModalOpen = activeImage?.status === "processing" || isExporting;
  const hasGenerationCredits = account.creditsBalance > 0;
  const generationLockReason = "No credits remaining. Top up or choose a plan to continue.";
  const currentPlanLabel = account.subscriptionPlan
    ? account.subscriptionPlan.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "Trial";
  const currentPlanStatus = account.subscriptionStatus
    ? account.subscriptionStatus.replaceAll("_", " ")
    : hasGenerationCredits
      ? "active"
      : "inactive";

  useEffect(() => {
    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
    }
  }, [hasGenerationCredits]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    let isCancelled = false;

    const loadWorkspace = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const sessionId = window.localStorage.getItem(WORKSPACE_LAST_SESSION_KEY) || WORKSPACE_DEFAULT_SESSION_ID;

      try {
        const session = await readWorkspaceSession(sessionId);

        if (!session || isCancelled) {
          return;
        }

        const hydratedImages = session.images.map((image) => {
          const originalUrl = URL.createObjectURL(image.originalFile);
          const currentUrl =
            image.currentFile === image.originalFile
              ? originalUrl
              : URL.createObjectURL(image.currentFile);

          return {
            id: image.id,
            name: image.name,
            originalFile: image.originalFile,
            currentFile: image.currentFile,
            originalUrl,
            url: currentUrl,
            status: image.status === "processing" ? "idle" : image.status,
            activeJob: image.status === "processing" ? null : image.activeJob,
            error: image.error,
          } satisfies UploadedImage;
        });

        setUploadedImages(hydratedImages);
        setActiveImageId(
          hydratedImages.some((image) => image.id === session.activeImageId)
            ? session.activeImageId
            : hydratedImages[0]?.id ?? null,
        );
        setActiveMobilePanel(session.activeMobilePanel);
        setPrompt(session.prompt);
        setBrightness(session.brightness);
        setSaturation(session.saturation);
        setContrast(session.contrast);
        setWarmth(session.warmth);
        setSepia(session.sepia);
      } catch {
        // Ignore corrupt local workspace state and start clean.
      } finally {
        if (!isCancelled) {
          setIsWorkspaceLoaded(true);
        }
      }
    };

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      uploadedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.url);
        if (image.originalUrl !== image.url) {
          URL.revokeObjectURL(image.originalUrl);
        }
      });
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

  useEffect(() => {
    if (!isCropPopoverOpen && !isStudioPopoverOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!cropPopoverRef.current?.contains(event.target as Node)) {
        setIsCropPopoverOpen(false);
      }
      if (!studioPopoverRef.current?.contains(event.target as Node)) {
        setIsStudioPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCropPopoverOpen, isStudioPopoverOpen]);

  useEffect(() => {
    if (!isWorkspaceLoaded || typeof window === "undefined") {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const session: PersistedWorkspaceSession = {
        id: WORKSPACE_DEFAULT_SESSION_ID,
        updatedAt: Date.now(),
        activeMobilePanel,
        activeImageId,
        prompt,
        brightness,
        saturation,
        contrast,
        warmth,
        sepia,
        images: uploadedImages.map((image) => ({
          id: image.id,
          name: image.name,
          originalFile: image.originalFile,
          currentFile: image.currentFile,
          status: image.status,
          activeJob: image.activeJob,
          error: image.error,
        })),
      };

      void writeWorkspaceSession(session);
      window.localStorage.setItem(WORKSPACE_LAST_SESSION_KEY, WORKSPACE_DEFAULT_SESSION_ID);
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    isWorkspaceLoaded,
    activeMobilePanel,
    activeImageId,
    prompt,
    brightness,
    saturation,
    contrast,
    warmth,
    sepia,
    uploadedImages,
  ]);

  async function handleUpload(files: FileList | null) {
    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    const nextImages = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => {
        const originalUrl = URL.createObjectURL(file);

        return {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url: originalUrl,
          originalUrl,
          originalFile: file,
          currentFile: file,
          status: "processing" as ImageStatus,
          activeJob: "upload_enhance" as EditMode,
          error: null,
        };
      });

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

    await Promise.allSettled(
      nextImages.map((image) =>
        runEdit({
          imageId: image.id,
          sourceFile: image.originalFile,
          mode: "upload_enhance",
        }),
      ),
    );
  }

  function handleDelete(imageId: string) {
    setUploadedImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.url);
        if (target.originalUrl !== target.url) {
          URL.revokeObjectURL(target.originalUrl);
        }
      }

      const next = current.filter((image) => image.id !== imageId);

      if (activeImageId === imageId) {
        setActiveImageId(next[0]?.id ?? null);
      }

      return next;
    });
  }

  async function handleMagicWand() {
    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
      return;
    }

    if (!activeImage || activeImage.status === "processing") {
      return;
    }

    await runEdit({
      imageId: activeImage.id,
      sourceFile: activeImage.currentFile,
      mode: "magic_wand",
    });
  }

  async function handleStudioShoot(presetPrompt?: string) {
    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
      return;
    }

    if (!activeImage || activeImage.status === "processing") {
      return;
    }

    await runEdit({
      imageId: activeImage.id,
      sourceFile: activeImage.currentFile,
      mode: "studio_shoot",
      prompt: presetPrompt,
    });
  }

  async function handlePromptSubmit() {
    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
      return;
    }

    if (!activeImage || activeImage.status === "processing" || prompt.trim().length === 0) {
      return;
    }

    await runEdit({
      imageId: activeImage.id,
      sourceFile: activeImage.currentFile,
      mode: "prompt_edit",
      prompt: prompt.trim(),
    });

    setPrompt("");
  }

  async function handleCropPreset(preset: CropPreset) {
    setIsCropPopoverOpen(false);

    if (!hasGenerationCredits) {
      setIsSettingsModalOpen(true);
      return;
    }

    if (!activeImage || activeImage.status === "processing") {
      return;
    }

    await runEdit({
      imageId: activeImage.id,
      sourceFile: activeImage.currentFile,
      mode: "crop_reframe",
      prompt: preset,
    });
  }

  function handleReset() {
    if (!activeImage || activeImage.status === "processing") {
      return;
    }

    setBrightness(100);
    setSaturation(100);
    setContrast(100);
    setWarmth(100);
    setSepia(0);
    setPrompt("");

    setUploadedImages((current) =>
      current.map((image) => {
        if (image.id !== activeImage.id) {
          return image;
        }

        if (image.url !== image.originalUrl) {
          URL.revokeObjectURL(image.url);
        }

        return {
          ...image,
          url: image.originalUrl,
          currentFile: image.originalFile,
          status: "idle",
          activeJob: null,
          error: null,
        };
      }),
    );
  }

  async function runEdit({
    imageId,
    sourceFile,
    mode,
    prompt: promptValue,
  }: {
    imageId: string;
    sourceFile: File;
    mode: EditMode;
    prompt?: string;
  }) {
    setUploadedImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              status: "processing",
              activeJob: mode,
              error: null,
            }
          : image,
      ),
    );

    const formData = new FormData();
    formData.append("image", sourceFile);
    formData.append("mode", mode);
    if (promptValue) {
      formData.append("prompt", promptValue);
    }

    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as { imageBase64: string; mimeType: string } | { error?: string })
        : null;

      if (!response.ok || !payload || !("imageBase64" in payload) || !payload.imageBase64) {
        throw new Error((payload && "error" in payload && payload.error) || "Image edit failed.");
      }

      const nextFile = base64ToFile(payload.imageBase64, payload.mimeType, sourceFile.name);
      const nextUrl = URL.createObjectURL(nextFile);

      setUploadedImages((current) =>
        current.map((image) => {
          if (image.id !== imageId) {
            return image;
          }

          if (image.url !== image.originalUrl) {
            URL.revokeObjectURL(image.url);
          }

          return {
            ...image,
            url: nextUrl,
            currentFile: nextFile,
            status: "idle",
            activeJob: null,
            error: null,
          };
        }),
      );

      setAccount((current) => ({
        ...current,
        creditsBalance: Math.max(0, current.creditsBalance - 1),
        trialCreditsRemaining: Math.max(0, current.trialCreditsRemaining - 1),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image edit failed.";
      setUploadedImages((current) =>
        current.map((image) =>
          image.id === imageId
            ? {
                ...image,
                status: "error",
                activeJob: null,
                error: message,
              }
            : image,
        ),
      );

      if (message.toLowerCase().includes("no credits")) {
        setAccount((current) => ({ ...current, creditsBalance: 0 }));
        setIsSettingsModalOpen(true);
      }
    }
  }

  function handleToolbarAction(label: string) {
    switch (label) {
      case "Upload":
        if (!hasGenerationCredits) {
          setIsSettingsModalOpen(true);
          return;
        }
        fileInputRef.current?.click();
        return;
      case "Studio":
        if (!hasGenerationCredits) {
          setIsSettingsModalOpen(true);
          return;
        }
        if (!activeImage || activeImage.status === "processing") {
          return;
        }
        setIsCropPopoverOpen(false);
        setIsStudioPopoverOpen((current) => !current);
        return;
      case "Reset":
        handleReset();
        return;
      case "Download":
        handleDownload();
        return;
      case "Share":
        setIsCropPopoverOpen(false);
        setIsStudioPopoverOpen(false);
        void handleShare();
        return;
      case "AI":
        if (!hasGenerationCredits) {
          setIsSettingsModalOpen(true);
          return;
        }
        setIsCropPopoverOpen(false);
        setIsStudioPopoverOpen(false);
        void handleMagicWand();
        return;
      case "Crop":
        if (!hasGenerationCredits) {
          setIsSettingsModalOpen(true);
          return;
        }
        if (!activeImage || activeImage.status === "processing") {
          return;
        }
        setIsStudioPopoverOpen(false);
        setIsCropPopoverOpen((current) => !current);
        return;
      default:
        setIsCropPopoverOpen(false);
        setIsStudioPopoverOpen(false);
        return;
    }
  }

  function handleDownload() {
    if (!activeImage || activeImage.status === "processing" || isExporting) {
      return;
    }

    void exportCurrentImage();
  }

  async function exportCurrentImage() {
    if (!activeImage) {
      return;
    }

    setIsExporting(true);

    const formData = new FormData();
    formData.append("image", activeImage.currentFile);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as ExportPayload | { error?: string })
        : null;

      if (!response.ok || !payload || !("imageBase64" in payload) || !payload.imageBase64) {
        throw new Error("Export failed.");
      }

      const exportFile = base64ToFile(payload.imageBase64, payload.mimeType, payload.filename);
      const exportUrl = URL.createObjectURL(exportFile);
      const link = document.createElement("a");
      link.href = exportUrl;
      link.download = payload.filename;
      link.click();
      URL.revokeObjectURL(exportUrl);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShare() {
    if (!activeImage || activeImage.status === "processing" || typeof navigator === "undefined") {
      return;
    }

    try {
      const fileShareData = {
        title: activeImage.name,
        text: "Shared from FotoShoot",
        files: [activeImage.currentFile],
      };

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [activeImage.currentFile] })) {
        await navigator.share(fileShareData);
        return;
      }

      if (typeof navigator.share === "function") {
        await navigator.share({
          title: activeImage.name,
          text: "Shared from FotoShoot",
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard?.writeText(window.location.href);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  async function refreshAccountStatus() {
    const response = await fetch("/api/account/status", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.user) {
      return;
    }

    setAccount({
      email: payload.user.email,
      name: payload.user.name,
      avatarUrl: payload.user.avatarUrl,
      creditsBalance: payload.user.creditsBalance,
      trialCreditsRemaining: payload.user.trialCreditsRemaining,
      subscriptionPlan: payload.user.subscriptionPlan,
      subscriptionStatus: payload.user.subscriptionStatus,
      stripeCustomerId: payload.user.stripeCustomerId,
    });
  }

  async function startCheckout(planKey: string) {
    setSettingsBusyAction(planKey);
    setSettingsError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.error || "Unable to start checkout.");
      }

      window.location.href = String(payload.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      setSettingsError(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
      setSettingsBusyAction(null);
    }
  }

  async function openBillingPortal() {
    setSettingsBusyAction("billing_portal");
    setSettingsError(null);

    try {
      const response = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.portalUrl) {
        throw new Error(payload?.error || "Unable to open billing portal.");
      }

      window.location.href = String(payload.portalUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open billing portal.";
      setSettingsError(message);
      if (typeof window !== "undefined") {
        window.alert(message);
      }
      setSettingsBusyAction(null);
    }
  }

  async function handleLogout() {
    setSettingsBusyAction("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
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
          void handleUpload(event.target.files);
          event.target.value = "";
        }}
      />

      <header className="workspace-header">
        <div className="workspace-header-brand">
          <div className="workspace-header-copy">
            <span>FotoShoot</span>
          </div>
        </div>

        <div className="workspace-header-actions">
          {toolbarItems.map((item) =>
            item.label === "Crop" ? (
              <div key={item.label} ref={cropPopoverRef} className="workspace-toolbar-menu">
                <button
                  aria-label={item.label}
                  className={`workspace-toolbar-icon${isCropPopoverOpen ? " is-active" : ""}`}
                  type="button"
                  disabled={!hasGenerationCredits}
                  onClick={() => handleToolbarAction(item.label)}
                >
                  {item.icon}
                </button>

                {isCropPopoverOpen ? (
                  <div className="workspace-crop-popover">
                    {cropOptions.map((option) => (
                      <button
                        key={option.preset}
                        className="workspace-crop-option"
                        type="button"
                        onClick={() => void handleCropPreset(option.preset)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : item.label === "Studio" ? (
              <div key={item.label} ref={studioPopoverRef} className="workspace-toolbar-menu">
                <button
                  aria-label={item.label}
                  className={`workspace-toolbar-icon${isStudioPopoverOpen ? " is-active" : ""}`}
                  type="button"
                  disabled={!hasGenerationCredits}
                  onClick={() => handleToolbarAction(item.label)}
                >
                  {item.icon}
                </button>

                {isStudioPopoverOpen ? (
                  <div className="workspace-crop-popover workspace-studio-popover">
                    {studioQuickPresets.map((option) => (
                      <button
                        key={option.label}
                        className="workspace-crop-option workspace-studio-option"
                        type="button"
                        onClick={() => {
                          setIsStudioPopoverOpen(false);
                          void handleStudioShoot(option.prompt);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                key={item.label}
                aria-label={item.label}
                className="workspace-toolbar-icon"
                type="button"
                disabled={(item.label === "Upload" || item.label === "AI") && !hasGenerationCredits}
                onClick={() => handleToolbarAction(item.label)}
              >
                {item.icon}
              </button>
            ),
          )}
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
              disabled={!hasGenerationCredits}
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

          <div className="workspace-sidebar-footer">
            <button
              aria-label="Settings"
              className="workspace-panel-settings"
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <SettingsIcon />
            </button>
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
                          placeholder="Describe how FotoShoot should transform this photo..."
                          value={prompt}
                          disabled={!hasGenerationCredits}
                          onChange={(event) => setPrompt(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault();
                              void handlePromptSubmit();
                            }
                          }}
                        />
                        <button
                          aria-label="Send prompt"
                          className="workspace-prompt-submit"
                          type="button"
                          disabled={isPromptDisabled || !hasGenerationCredits}
                          onClick={() => void handlePromptSubmit()}
                        >
                          <PaperPlaneIcon />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="workspace-image-empty">
                  <div>
                    <p>Upload Photos</p>
                    {!hasGenerationCredits ? <small className="workspace-credits-empty-note">{generationLockReason}</small> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className={`workspace-sidebar workspace-sidebar-right workspace-utility${activeMobilePanel === "right" ? " is-mobile-active" : ""}`}>
          <div className="workspace-controls-panel">
            <SliderControl label="Brightness" min={50} max={150} step={1} value={brightness} onChange={setBrightness} onReset={() => setBrightness(100)} />
            <SliderControl label="Saturation" min={0} max={200} step={1} value={saturation} onChange={setSaturation} onReset={() => setSaturation(100)} />
            <SliderControl label="Contrast" min={50} max={200} step={1} value={contrast} onChange={setContrast} onReset={() => setContrast(100)} />
            <SliderControl label="Warmth" min={50} max={150} step={1} value={warmth} onChange={setWarmth} onReset={() => setWarmth(100)} />
            <SliderControl label="Sepia" min={0} max={100} step={1} value={sepia} onChange={setSepia} onReset={() => setSepia(0)} />
          </div>
        </aside>
      </div>

      {isProcessingModalOpen ? (
        <div aria-hidden="true" className="workspace-loading-modal">
          <div className="workspace-loading-spinner" />
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="workspace-settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="workspace-settings-media">
            <img alt="" className="workspace-settings-image" src="/assets/Hero-Dark.png" />
            <div className="workspace-settings-image-overlay" />
            <div className="workspace-settings-badge">
              <span>FotoShoot account</span>
              <strong>{account.name || "FotoShoot User"}</strong>
              <em>{hasGenerationCredits ? `${account.creditsBalance} credits available` : "Credits depleted"}</em>
            </div>
          </div>

          <div className="workspace-settings-content">
            <button
              aria-label="Close settings"
              className="workspace-settings-close"
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
            >
              <CloseIcon />
            </button>

            <img alt="FotoShoot" className="workspace-settings-logo" src="/assets/fotoshoot-logo-white.png" />

            <div className="workspace-settings-sections">
              <section className="workspace-settings-section">
                <h2>Account Details</h2>
                <p>{account.name || "FotoShoot User"}</p>
              </section>

              <section className="workspace-settings-section">
                <h2>Current Plan</h2>
                <div className="workspace-settings-line">
                  <strong>{currentPlanLabel}</strong>
                  <span>{currentPlanStatus}</span>
                </div>
                <div className="workspace-settings-actions">
                  <button className="workspace-settings-link" type="button" disabled={settingsBusyAction !== null} onClick={() => void startCheckout("starter")}>
                    Starter
                  </button>
                  <button className="workspace-settings-link" type="button" disabled={settingsBusyAction !== null} onClick={() => void startCheckout("pro")}>
                    Pro
                  </button>
                  <button className="workspace-settings-link" type="button" disabled={settingsBusyAction !== null} onClick={() => void startCheckout("studio")}>
                    Studio
                  </button>
                  <button
                    className="workspace-settings-link workspace-settings-link-muted"
                    type="button"
                    disabled={settingsBusyAction !== null}
                    onClick={() => void openBillingPortal()}
                  >
                    Manage Billing
                  </button>
                </div>
              </section>

              <section className="workspace-settings-section">
                <h2>Credit Balance</h2>
                <div className="workspace-settings-balance">{account.creditsBalance}</div>
                <p>{account.trialCreditsRemaining} trial credits remaining</p>
              </section>

              <section className="workspace-settings-section">
                <h2>Top Up Actions</h2>
                <div className="workspace-settings-actions">
                  <button className="workspace-settings-link" type="button" disabled={settingsBusyAction !== null} onClick={() => void startCheckout("top_up_50")}>
                    Buy 50 Credits
                  </button>
                  <button className="workspace-settings-link" type="button" disabled={settingsBusyAction !== null} onClick={() => void startCheckout("top_up_100")}>
                    Buy 100 Credits
                  </button>
                  <button className="workspace-settings-link workspace-settings-link-muted" type="button" disabled={settingsBusyAction !== null} onClick={() => void refreshAccountStatus()}>
                    Refresh Balance
                  </button>
                </div>
              </section>

              <section className="workspace-settings-section">
                <h2>Help</h2>
                <div className="workspace-settings-actions">
                  <a className="workspace-settings-link" href="/help">
                    Help Center
                  </a>
                  <a className="workspace-settings-link workspace-settings-link-muted" href="/contact">
                    Contact Support
                  </a>
                </div>
              </section>

              <section className="workspace-settings-section">
                <button className="workspace-settings-link workspace-settings-link-danger" type="button" disabled={settingsBusyAction !== null} onClick={() => void handleLogout()}>
                  Logout
                </button>
              </section>

              {settingsError ? <p className="workspace-settings-error">{settingsError}</p> : null}
              {!hasGenerationCredits ? <p className="workspace-settings-warning">{generationLockReason}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function base64ToFile(base64: string, mimeType: string, originalName: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const extension = mimeType.split("/")[1] || "png";
  const safeName = originalName.replace(/\.[^.]+$/, "");

  return new File([bytes], `${safeName}.${extension}`, { type: mimeType });
}

async function openWorkspaceDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is unavailable.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Unable to open workspace database."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE_NAME)) {
        db.createObjectStore(WORKSPACE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readWorkspaceSession(sessionId: string) {
  const db = await openWorkspaceDb();

  return new Promise<PersistedWorkspaceSession | undefined>((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE_NAME, "readonly");
    const store = transaction.objectStore(WORKSPACE_STORE_NAME);
    const request = store.get(sessionId);

    request.onerror = () => reject(request.error ?? new Error("Unable to read workspace session."));
    request.onsuccess = () => resolve((request.result as PersistedWorkspaceSession | undefined) ?? undefined);

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Unable to read workspace session."));
    };
  });
}

async function writeWorkspaceSession(session: PersistedWorkspaceSession) {
  const db = await openWorkspaceDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(WORKSPACE_STORE_NAME);

    store.put(session);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Unable to save workspace session."));
    };
  });
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

function StudioIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18V20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.5 12H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 12H3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.66 6.34L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16L6.34 17.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.66 17.66L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 8L6.34 6.34" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 8V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 4L3.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 4L8.5 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 18.5C8.2 19.5 9.8 20 11.5 20C15.64 20 19 16.64 19 12.5C19 8.36 15.64 5 11.5 5C9.53 5 7.74 5.76 6.4 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19 12C19 11.47 18.95 10.95 18.86 10.45L21 8.8L18.8 5L16.24 6.03C15.45 5.38 14.51 4.93 13.5 4.73L13.12 2H10.88L10.5 4.73C9.49 4.93 8.55 5.38 7.76 6.03L5.2 5L3 8.8L5.14 10.45C5.05 10.95 5 11.47 5 12C5 12.53 5.05 13.05 5.14 13.55L3 15.2L5.2 19L7.76 17.97C8.55 18.62 9.49 19.07 10.5 19.27L10.88 22H13.12L13.5 19.27C14.51 19.07 15.45 18.62 16.24 17.97L18.8 19L21 15.2L18.86 13.55C18.95 13.05 19 12.53 19 12Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
