import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

const EXPORT_LONG_EDGE = 2048;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const source = sharp(inputBuffer);
    const metadata = await source.metadata();

    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ error: "Could not read image dimensions." }, { status: 400 });
    }

    const width = metadata.width;
    const height = metadata.height;
    const resizeOptions =
      width >= height
        ? { width: EXPORT_LONG_EDGE }
        : { height: EXPORT_LONG_EDGE };

    const format = getSharpFormat(image.type);
    const exported = await source
      .resize({
        ...resizeOptions,
        fit: "inside",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      })
      .toFormat(format, getFormatOptions(format))
      .toBuffer();

    return NextResponse.json({
      imageBase64: exported.toString("base64"),
      mimeType: getMimeTypeForFormat(format),
      filename: buildExportFilename(image.name, format),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
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

function getFormatOptions(format: keyof sharp.FormatEnum) {
  switch (format) {
    case "png":
      return { compressionLevel: 9 };
    case "webp":
      return { quality: 92 };
    default:
      return { quality: 92, mozjpeg: true };
  }
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

function buildExportFilename(originalName: string, format: keyof sharp.FormatEnum) {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const extension = format === "png" ? "png" : format === "webp" ? "webp" : "jpg";

  return `${baseName}-2k.${extension}`;
}
