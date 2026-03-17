import { NextResponse } from "next/server";

import { editImageWithGemini, type EditMode } from "@/lib/gemini-image";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    const arrayBuffer = await image.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const result = await editImageWithGemini({
      imageBase64,
      mimeType: image.type || "image/png",
      mode,
      userPrompt: typeof prompt === "string" ? prompt : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image edit failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isEditMode(value: FormDataEntryValue | null): value is EditMode {
  return value === "upload_enhance" || value === "magic_wand" || value === "prompt_edit";
}
