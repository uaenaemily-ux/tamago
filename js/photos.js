// 照片：压缩 + 显示。照片的存取在 store.js（savePhoto / getPhoto / deletePhoto）。
import { el } from "./ui/dom.js";
import { getPhoto } from "./store.js";

// 把用户选的图片压缩成小图：最长边 800px、JPEG 质量 0.7，返回 dataURL（约 50–100 KB）
export async function compressImage(file, { maxSize = 800, quality = 0.7 } = {}) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; // 透明背景（如 PNG）转成白底
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height); // 浏览器会自动按照片的拍摄方向摆正
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("这张图片打不开，换一张试试"));
    img.src = src;
  });
}

// 只接受图片 dataURL，防止导入的备份里混进别的东西
export function isPhotoDataUrl(value) {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(value);
}

// 显示一张已保存的照片：先返回 <img>，照片读出来后再填上
export function photoImg(photoId, { alt = "", className = "" } = {}) {
  const img = el("img", { class: className, alt, decoding: "async" });
  getPhoto(photoId)
    .then((src) => {
      if (isPhotoDataUrl(src)) img.src = src;
      else img.classList.add("photo-missing");
    })
    .catch(() => img.classList.add("photo-missing"));
  return img;
}
