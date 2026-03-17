import { NextResponse } from "next/server";
import sharp from "sharp";

import { getCurrentUser } from "@/lib/auth/current-user";
import { editImageWithGemini, type EditMode } from "@/lib/gemini-image";
import { consumeGenerationCredit } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const mode = formData.get("mode");
    const prompt = formData.get("prompt");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    if (!isEditMode(mode)) {
      return NextResponse.json({ error: "Invalid edit mode." }, { status: 400 });
    }

    const debitResult = await consumeGenerationCredit({
      userId: current.user.id,
      reason: `AI generation: ${mode}`,
    });

    if (!debitResult.ok) {
      return NextResponse.json({ error: "No credits remaining. Top up or choose a plan to continue." }, { status: 402 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const result = await editImageWithGemini({
      imageBase64,
      mimeType: image.type || "image/png",
      mode,
      userPrompt: typeof prompt === "string" ? prompt : undefined,
    });

    const finalResult =
      mode === "crop_reframe" && typeof prompt === "string"
        ? await enforceCropPreset(result, prompt)
        : result;

    return NextResponse.json(finalResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image edit failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isEditMode(value: FormDataEntryValue | null): value is EditMode {
  return value === "upload_enhance" || value === "magic_wand" || value === "studio_shoot" || value === "crop_reframe" || value === "prompt_edit";
}


async function enforceCropPreset(
  result: { imageBase64: string; mimeType: string },
  preset: string,
) {
  const aspectRatio = getAspectRatioForPreset(preset);

  if (!aspectRatio) {
    return result;
  }

  const inputBuffer = Buffer.from(result.imageBase64, "base64");
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return result;
  }

  const sourceRatio = metadata.width / metadata.height;
  let extractWidth = metadata.width;
  let extractHeight = metadata.height;

  if (sourceRatio > aspectRatio) {
    extractWidth = Math.round(metadata.height * aspectRatio);
  } else {
    extractHeight = Math.round(metadata.width / aspectRatio);
  }

  const left = Math.max(0, Math.floor((metadata.width - extractWidth) / 2));
  const top = Math.max(0, Math.floor((metadata.height - extractHeight) / 2));
  const format = getSharpFormat(result.mimeType);

  const cropped = await image
    .extract({ left, top, width: extractWidth, height: extractHeight })
    .toFormat(format)
    .toBuffer();

  return {
    imageBase64: cropped.toString("base64"),
    mimeType: getMimeTypeForFormat(format),
  };
}

function getAspectRatioForPreset(preset: string) {
  switch (preset) {
    case "1:1":
      return 1;
    case "4:5":
      return 4 / 5;
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "product":
      return 1;
    default:
      return null;
  }
}

function getSharpFormat(mimeType: string): keyof sharp.FormatEnum {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpeg";
}

function getMimeTypeForFormat(format: keyof sharp.FormatEnum) {
  switch (format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
