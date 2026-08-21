/// <reference types="node" />

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageDepthEnvironmentCatalog } from "../src/themes/image-depth/environmentCatalog.ts";

type ImageDimensions = {
  width: number;
  height: number;
};

const WEBP_RIFF = "RIFF";
const WEBP_WEBP = "WEBP";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const scriptFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptFilePath), "..");
function toPublicAssetFilePath(urlPath: string): string {
  const normalized = urlPath.replace(/^\//, "");
  return path.join(repoRoot, "public", normalized);
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (buffer[index] !== PNG_SIGNATURE[index]) {
      return null;
    }
  }

  if (buffer.length < 24) {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType !== "IHDR") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 16) {
    return null;
  }

  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);

  if (riff !== WEBP_RIFF || webp !== WEBP_WEBP) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;

    if (chunkDataEnd > buffer.length) {
      return null;
    }

    if (chunkType === "VP8X" && chunkSize >= 10) {
      const widthMinusOne = readUInt24LE(buffer, chunkDataStart + 4);
      const heightMinusOne = readUInt24LE(buffer, chunkDataStart + 7);
      return {
        width: widthMinusOne + 1,
        height: heightMinusOne + 1,
      };
    }

    if (chunkType === "VP8 " && chunkSize >= 10) {
      const width = buffer.readUInt16LE(chunkDataStart + 6) & 0x3fff;
      const height = buffer.readUInt16LE(chunkDataStart + 8) & 0x3fff;
      return { width, height };
    }

    if (chunkType === "VP8L" && chunkSize >= 5) {
      const bits = buffer.readUInt32LE(chunkDataStart + 1);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    offset = chunkDataEnd + (chunkSize % 2 === 1 ? 1 : 0);
  }

  return null;
}

async function readImageDimensions(filePath: string): Promise<ImageDimensions | null> {
  const bytes = await readFile(filePath);

  if (filePath.toLowerCase().endsWith(".png")) {
    return parsePngDimensions(bytes);
  }

  if (filePath.toLowerCase().endsWith(".webp")) {
    return parseWebpDimensions(bytes);
  }

  return null;
}

async function main() {
  const errors: string[] = [];
  const idCounts = new Map<string, number>();
  const displayNameCounts = new Map<string, number>();

  for (const environment of imageDepthEnvironmentCatalog) {
    idCounts.set(environment.id, (idCounts.get(environment.id) ?? 0) + 1);
    displayNameCounts.set(
      environment.displayName,
      (displayNameCounts.get(environment.displayName) ?? 0) + 1,
    );

    const colorPath = toPublicAssetFilePath(environment.asset.colorImageUrl);
    const depthPath = toPublicAssetFilePath(environment.asset.depthMapUrl);

    let colorDimensions: ImageDimensions | null = null;
    let depthDimensions: ImageDimensions | null = null;

    try {
      colorDimensions = await readImageDimensions(colorPath);
      if (!colorDimensions) {
        errors.push(`${environment.id}: unable to read color image dimensions (${colorPath}).`);
      }
    } catch {
      errors.push(`${environment.id}: missing color asset (${colorPath}).`);
    }

    try {
      depthDimensions = await readImageDimensions(depthPath);
      if (!depthDimensions) {
        errors.push(`${environment.id}: unable to read depth image dimensions (${depthPath}).`);
      }
    } catch {
      errors.push(`${environment.id}: missing depth asset (${depthPath}).`);
    }

    if (colorDimensions && depthDimensions) {
      if (
        colorDimensions.width !== depthDimensions.width ||
        colorDimensions.height !== depthDimensions.height
      ) {
        errors.push(
          `${environment.id}: color/depth dimensions differ (${colorDimensions.width}x${colorDimensions.height} vs ${depthDimensions.width}x${depthDimensions.height}).`,
        );
      }

      const colorRatio = colorDimensions.width / colorDimensions.height;
      const depthRatio = depthDimensions.width / depthDimensions.height;
      if (Math.abs(colorRatio - depthRatio) > 1e-6) {
        errors.push(
          `${environment.id}: color/depth aspect ratios differ (${colorRatio.toFixed(8)} vs ${depthRatio.toFixed(8)}).`,
        );
      }
    }
  }

  for (const [id, count] of idCounts.entries()) {
    if (count > 1) {
      errors.push(`Duplicate environment id detected: ${id} (${count} entries).`);
    }
  }

  for (const [displayName, count] of displayNameCounts.entries()) {
    if (count > 1) {
      errors.push(`Duplicate environment display name detected: ${displayName} (${count} entries).`);
    }
  }

  if (errors.length > 0) {
    console.error("Environment catalog validation failed:");
    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });
    process.exit(1);
  }

  console.log(`Environment catalog validation passed for ${imageDepthEnvironmentCatalog.length} environments.`);
}

void main();
