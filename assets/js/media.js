// Imágenes de destinos y archivos de documentos.
// Modo local: URLs en state.imageUrls y archivos en IndexedDB (solo este navegador).
// Modo base central: las imágenes subidas van al bucket público "media" (su URL queda en
// state.imageUrls, visible para todos) y los documentos al bucket privado "documents".
import { imageDB, documentDB } from "./idb.js";
import { state, setUi } from "./store.js";
import { placeholderSvg, safeHttpUrl } from "./util.js";
import * as C from "./cloud.js";

const inCloud = () => state.cloud.mode === "cloud" && state.cloud.role === "admin";

const objectUrls = new Map(); // placeId → blob: URL

export function imageSrc(place) {
  if (!state.shareMode) {
    if (objectUrls.has(place.id)) return objectUrls.get(place.id);
    const url = safeHttpUrl(state.imageUrls[place.id]);
    if (url) return url;
  }
  return placeholderSvg(place.name, place.category);
}
export const hasCustomImage = (id) => objectUrls.has(id) || Boolean(state.imageUrls[id]);

export async function loadStoredImages(validIds) {
  try {
    const keys = await imageDB.keys();
    await Promise.all(keys.map(async (key) => {
      // Con varios viajes, una imagen que no es del viaje abierto puede ser de otro: no se borra.
      const blob = await imageDB.get(key);
      if (blob instanceof Blob) objectUrls.set(key, URL.createObjectURL(blob));
    }));
  } catch { /* IndexedDB no disponible: se usan URL o placeholders */ }
}

async function downscale(file, max = 1400) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

export async function saveImage(placeId, { url, file }) {
  if (file) {
    if (!file.type.startsWith("image/")) return "El archivo debe ser una imagen (JPG, PNG, WebP o GIF).";
    if (file.size > 25 * 1024 * 1024) return "La imagen supera 25 MB. Usa una más liviana.";
    const blob = await downscale(file);
    if (inCloud()) {
      const path = `images/${placeId}-${Date.now()}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/gif" ? "gif" : "jpg"}`;
      try {
        await C.uploadFile("media", path, blob);
      } catch (err) {
        return `No se pudo subir la imagen a la base (${err.message}).`;
      }
      const old = state.imageUrls[placeId];
      await clearStoredImage(placeId);
      setUi({ imageUrls: { ...state.imageUrls, [placeId]: C.publicFileUrl("media", path) } });
      removeOwnImage(old);
      return null;
    }
    try {
      await imageDB.set(placeId, blob);
    } catch {
      return "No se pudo guardar la imagen en este navegador.";
    }
    if (objectUrls.has(placeId)) URL.revokeObjectURL(objectUrls.get(placeId));
    objectUrls.set(placeId, URL.createObjectURL(blob));
    const imageUrls = { ...state.imageUrls };
    delete imageUrls[placeId];
    setUi({ imageUrls });
    return null;
  }
  const clean = safeHttpUrl(url);
  if (!clean) return "Pega una URL que empiece con https:// o sube un archivo.";
  removeOwnImage(state.imageUrls[placeId]);
  await clearStoredImage(placeId);
  setUi({ imageUrls: { ...state.imageUrls, [placeId]: clean } });
  return null;
}

async function clearStoredImage(placeId) {
  if (objectUrls.has(placeId)) {
    URL.revokeObjectURL(objectUrls.get(placeId));
    objectUrls.delete(placeId);
  }
  try { await imageDB.del(placeId); } catch { /* sin IndexedDB */ }
}

/** Borra del bucket una imagen subida por la app (no toca URLs externas). Sin espera: es limpieza. */
function removeOwnImage(url) {
  if (!inCloud() || !C.isOwnPublicUrl(url)) return;
  const path = decodeURIComponent(url.split("/storage/v1/object/public/media/")[1] || "");
  if (path) C.removeFiles("media", [path]).catch(() => {});
}

export async function resetImage(placeId) {
  removeOwnImage(state.imageUrls[placeId]);
  await clearStoredImage(placeId);
  const imageUrls = { ...state.imageUrls };
  delete imageUrls[placeId];
  setUi({ imageUrls });
}

/* Documentos -------------------------------------------------------- */

/** Guarda el archivo de un documento. Devuelve { error } o { cloud: boolean }. */
export async function storeDocumentFile(key, file) {
  if (file.size > 50 * 1024 * 1024) return { error: "El archivo supera 50 MB." };
  if (inCloud()) {
    try {
      await C.uploadFile("documents", key, file);
      return { cloud: true };
    } catch (err) {
      return { error: `No se pudo subir el archivo a la base (${err.message}).` };
    }
  }
  try {
    await documentDB.set(key, file);
    return { cloud: false };
  } catch {
    return { error: "No se pudo guardar el archivo en este navegador (IndexedDB no disponible o sin espacio)." };
  }
}

export async function removeCloudDocument(key) {
  if (inCloud() && key) await C.removeFiles("documents", [key]).catch(() => {});
}

export async function openDocumentFile(key, { cloud = false, name = "" } = {}) {
  let blob;
  if (cloud) {
    if (!inCloud()) return false;
    blob = await C.downloadFile("documents", key);
    if (name && !blob.name) blob = new File([blob], name, { type: blob.type });
  } else {
    blob = await documentDB.get(key);
  }
  if (!(blob instanceof Blob)) return false;
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    win.opener = null;
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = blob.name || "documento";
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export async function cleanOrphanDocuments(validKeys) {
  try {
    const keys = await documentDB.keys();
    await Promise.all(keys.filter((k) => !validKeys.has(k)).map((k) => documentDB.del(k)));
  } catch { /* sin IndexedDB */ }
}
