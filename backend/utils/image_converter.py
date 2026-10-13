import io
import os
import base64
from typing import List, Tuple, Dict, Any, Optional
from PIL import Image, ImageOps, ImageSequence
import cv2
import numpy as np

# Register HEIF/HEIC opener with Pillow
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIF_SUPPORTED = True
except ImportError:
    HEIF_SUPPORTED = False

SUPPORTED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".tiff", ".tif",
    ".heic", ".heif", ".webp", ".bmp"
}


def is_supported_image(filename: str) -> bool:
    """Check if file extension is supported."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in SUPPORTED_EXTENSIONS


def load_image_pages(image_bytes: bytes, filename: str) -> List[Image.Image]:
    """
    Loads an image from raw bytes, resolving multi-page TIFFs or single images (including HEIC).
    Applies EXIF transpose for orientation correction.
    Returns a list of PIL Images (1 image per page).
    """
    bio = io.BytesIO(image_bytes)
    pages: List[Image.Image] = []

    try:
        with Image.open(bio) as img:
            # Check if image has multiple frames (e.g. multi-page TIFF)
            n_frames = getattr(img, "n_frames", 1)
            for i in range(n_frames):
                img.seek(i)
                # Make a standalone copy of each frame
                frame = img.copy()
                # Apply EXIF rotation if present
                try:
                    frame = ImageOps.exif_transpose(frame)
                except Exception:
                    pass

                # Convert to RGB mode if CMYK, P, RGBA or 1
                if frame.mode in ("RGBA", "LA", "P"):
                    # Create white background for transparent images
                    background = Image.new("RGB", frame.size, (255, 255, 255))
                    if frame.mode == "P":
                        frame = frame.convert("RGBA")
                    if frame.mode in ("RGBA", "LA"):
                        background.paste(frame, mask=frame.split()[-1])
                        frame = background
                    else:
                        frame = frame.convert("RGB")
                elif frame.mode != "RGB" and frame.mode != "L":
                    frame = frame.convert("RGB")

                pages.append(frame)
    except Exception as e:
        raise ValueError(f"Failed to decode image '{filename}': {str(e)}")

    if not pages:
        raise ValueError(f"No readable frames found in '{filename}'")

    return pages


def apply_preprocessing(
    pil_img: Image.Image,
    mode: str = "auto",
    enhance_contrast: bool = True,
    auto_rotate: bool = False
) -> Image.Image:
    """
    Applies optional image pre-processing using OpenCV and PIL.
    mode options:
      - 'none': Keep original
      - 'auto': Grayscale + moderate contrast enhancement + light bilateral filter
      - 'grayscale': Convert to grayscale
      - 'threshold': Grayscale + Otsu binarization
      - 'adaptive_threshold': Grayscale + Adaptive Gaussian thresholding
      - 'contrast': CLAHE contrast enhancement
    """
    if mode == "none" and not enhance_contrast and not auto_rotate:
        return pil_img

    # Convert PIL Image to OpenCV numpy array (BGR or Gray)
    img_np = np.array(pil_img)

    if len(img_np.shape) == 3 and img_np.shape[2] == 3:
        bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    elif len(img_np.shape) == 2:
        gray = img_np
        bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    else:
        # Fallback to RGB convert
        rgb = pil_img.convert("RGB")
        bgr = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    processed_gray = gray.copy()

    # Optional deskew / auto-rotate estimation
    if auto_rotate:
        try:
            # Detect lines / angles to rectify text orientation
            coords = np.column_stack(np.where(processed_gray < 240))
            if len(coords) > 50:
                angle = cv2.minAreaRect(coords)[-1]
                if angle < -45:
                    angle = -(90 + angle)
                else:
                    angle = -angle
                if abs(angle) > 0.5 and abs(angle) < 45.0:
                    (h, w) = processed_gray.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    processed_gray = cv2.warpAffine(
                        processed_gray, M, (w, h),
                        flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
                    )
        except Exception:
            pass

    if mode == "threshold":
        # Otsu thresholding
        _, processed_gray = cv2.threshold(
            processed_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
    elif mode == "adaptive_threshold":
        # Adaptive Gaussian thresholding
        processed_gray = cv2.adaptiveThreshold(
            processed_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 21, 10
        )
    elif mode == "contrast":
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        processed_gray = clahe.apply(processed_gray)
    elif mode == "auto":
        # Auto mode: gentle CLAHE enhancement only if image contrast is low or requested
        if enhance_contrast:
            clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
            processed_gray = clahe.apply(processed_gray)
    elif mode == "grayscale":
        pass  # already grayscale

    if mode in ("threshold", "adaptive_threshold", "grayscale", "auto", "contrast"):
        return Image.fromarray(processed_gray)
    else:
        res_rgb = cv2.cvtColor(processed_gray, cv2.COLOR_GRAY2RGB)
        return Image.fromarray(res_rgb)


def generate_thumbnail_base64(pil_img: Image.Image, max_size: Tuple[int, int] = (240, 240)) -> str:
    """Generate JPEG base64 data URI for quick frontend thumbnail display."""
    thumb = pil_img.copy()
    thumb.thumbnail(max_size, Image.Resampling.LANCZOS)
    if thumb.mode != "RGB":
        thumb = thumb.convert("RGB")
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=80, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def get_image_dimensions(pil_img: Image.Image) -> Dict[str, int]:
    """Return width and height of an image."""
    return {"width": pil_img.width, "height": pil_img.height}
