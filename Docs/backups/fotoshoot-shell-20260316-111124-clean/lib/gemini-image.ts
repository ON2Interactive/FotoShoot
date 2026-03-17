const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

export type EditMode = "upload_enhance" | "magic_wand" | "studio_shoot" | "crop_reframe" | "prompt_edit";

export async function editImageWithGemini({
  imageBase64,
  mimeType,
  mode,
  userPrompt,
}: {
  imageBase64: string;
  mimeType: string;
  mode: EditMode;
  userPrompt?: string;
}) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is missing.");
  }

  const prompt = buildPrompt(mode, userPrompt);

  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "Google Gemini request failed.");
  }

  const imagePart = findInlineImage(payload);

  if (!imagePart?.data || !imagePart.mimeType) {
    const textMessage = findTextMessage(payload);
    throw new Error(textMessage || "Gemini returned no edited image.");
  }

  return {
    imageBase64: imagePart.data,
    mimeType: imagePart.mimeType,
  };
}

function buildPrompt(mode: EditMode, userPrompt?: string) {
  if (mode === "upload_enhance") {
    return [
      "You are a professional photo editor.",
      "Enhance this uploaded photo conservatively and naturally.",
      "Straighten the image if crooked.",
      "Remove dust, scratches, sensor spots, and minor blemishes.",
      "Correct white balance, exposure, color cast, and lighting.",
      "Improve contrast, clarity, and detail without making the image look artificial.",
      "Preserve the subject, identity, clothing, framing, and scene.",
      "Do not add or remove major objects.",
      "Return one polished, realistic professional edit.",
    ].join(" ");
  }

  if (mode === "magic_wand") {
    return [
      "You are a professional photo editor and creative art director.",
      "First identify the main subject of the photo, such as the person, product, object, or pet.",
      "Keep that subject intact, sharp, and realistic.",
      "Replace only the background with a new artistic premium setting.",
      "Do not blend the old background with the new background.",
      "Do not create a transparent, ghosted, double-exposed, or layered composite look.",
      "Do not repaint the whole image unless necessary to preserve realism.",
      "The final result must look like one coherent professional photograph with a clean subject cutout and a fully redesigned background.",
      "Use tasteful editorial or studio-art-direction choices with believable lighting, perspective, and color harmony.",
      "Return one polished final image.",
    ].join(" ");
  }

  if (mode === "studio_shoot") {
    return [
      "You are a professional product photographer, stylist, and high-end retoucher.",
      "Transform this image so it looks like it was captured in a premium professional studio photoshoot.",
      "Identify the main product or subject and preserve it accurately.",
      "Upgrade the image with clean studio lighting, refined shadows, polished reflections when appropriate, and luxury commercial photography quality.",
      "Improve composition, background cleanliness, surface styling, color balance, sharpness, and overall presentation.",
      "If the original environment is distracting, replace it with a tasteful professional studio or editorial product-photography setup.",
      "Do not create a surreal or gimmicky image.",
      "Do not distort the product shape, branding, materials, or important details.",
      "The final result should look like a premium ecommerce or brand campaign product photo.",
      "Return one polished professional studio image.",
    ].join(" ");
  }

  if (mode === "crop_reframe") {
    const presetInstruction = buildCropInstruction(userPrompt);

    return [
      "You are a professional photographer, art director, and retoucher.",
      "Reframe and crop this image into a stronger professional composition.",
      "Preserve the main subject and do not degrade image quality.",
      "Improve visual balance, spacing, subject placement, and crop discipline.",
      "Do not turn this into a different image.",
      "Do not apply a stylized background transformation unless needed for a clean crop result.",
      presetInstruction,
      "Return one polished reframed image.",
    ].join(" ");
  }

  return [
    "You are a professional photographer and high-end photo retoucher.",
    "Edit this photo according to the user's request while preserving photographic quality.",
    "Interpret the request with strong professional taste.",
    "Keep the result believable unless the user explicitly asks for a stylized look.",
    "Improve composition, lighting, color, and realism.",
    "Protect facial identity and important product details.",
    "Avoid cheap-looking artifacts or overprocessing.",
    `User request: ${userPrompt || "Create a polished professional edit."}`,
  ].join(" ");
}

function buildCropInstruction(preset?: string) {
  switch (preset) {
    case "1:1":
      return "Crop to a square 1:1 composition with the subject centered or compositionally balanced.";
    case "4:5":
      return "Crop to a 4:5 portrait-friendly composition with elegant framing and strong subject emphasis.";
    case "16:9":
      return "Crop to a 16:9 wide composition while preserving the key subject and maintaining cinematic balance.";
    case "9:16":
      return "Crop to a 9:16 vertical composition optimized for story or mobile-first framing.";
    case "product":
      return "Create a clean professional product crop with consistent margins, strong centering, and premium ecommerce presentation.";
    default:
      return "Choose the best professional crop automatically based on the image content and subject.";
  }
}

function findInlineImage(payload: GeminiResponse) {
  const candidates = payload.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      const camelInlineData = part.inlineData;
      if (camelInlineData?.data && camelInlineData.mimeType?.startsWith("image/")) {
        return camelInlineData;
      }
      const snakeInlineData = part.inline_data;
      if (snakeInlineData?.data && snakeInlineData.mime_type?.startsWith("image/")) {
        return {
          data: snakeInlineData.data,
          mimeType: snakeInlineData.mime_type,
        };
      }
    }
  }

  return null;
}

function findTextMessage(payload: GeminiResponse) {
  const candidates = payload.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return null;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        inline_data?: {
          data?: string;
          mime_type?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
};
