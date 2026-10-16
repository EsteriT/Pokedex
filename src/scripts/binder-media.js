/* Local image decoding and optimization. No storage or network writes. */
(() => {
  "use strict";
  const { limits } = window.BinderSchema;
  async function upload(file) {
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > limits.uploadBytes
    )
      throw Error("Choose a JPG, PNG or WebP image up to 5 MB.");
    const url = URL.createObjectURL(file),
      img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error("This image could not be opened."));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    if (img.naturalWidth * img.naturalHeight > limits.decodedPixels)
      throw Error("Choose an image with fewer than 24 million pixels.");
    const canvas = document.createElement("canvas");
    let scale = Math.min(
        1,
        limits.outputDimension / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      src = "";
    for (let i = 0; i < 4; i++) {
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      src = canvas.toDataURL("image/webp", 0.82);
      if (src.length <= limits.encodedImageChars) break;
      scale *= 0.75;
    }
    if (src.length > limits.encodedImageChars)
      throw Error("Choose a smaller or less detailed image.");
    return {
      src,
      name: file.name.slice(0, 100),
      width: canvas.width,
      height: canvas.height,
      fit: "cover",
      zoom: 1,
      x: 50,
      y: 50,
    };
  }
  window.BinderMedia = { upload };
})();
