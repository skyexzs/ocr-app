import os
from PIL import Image, ImageDraw, ImageFont

def generate_samples():
    out_dir = "sample_images"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(os.path.join(out_dir, "nested_folder"), exist_ok=True)

    samples = [
        (
            os.path.join(out_dir, "invoice_1042.png"),
            "PNG",
            [
                "INVOICE #INV-2026-1042",
                "Date: October 13, 2026",
                "Billed To: Antigravity AI Labs",
                "----------------------------------------",
                "Description          Qty    Amount",
                "Cloud Compute Unit    10    $450.00",
                "Offline OCR License    1    $120.00",
                "Support Services       1     $80.00",
                "----------------------------------------",
                "TOTAL DUE:                 $650.00",
                "Payment Terms: Net 30 Days",
            ]
        ),
        (
            os.path.join(out_dir, "meeting_notes.jpg"),
            "JPEG",
            [
                "EXECUTIVE BRIEFING - Q4 STRATEGY",
                "Attendees: Willem, Engineering Team",
                "Key Decisions:",
                "1. Standardize offline bulk OCR with Tesseract.",
                "2. Ensure zero cloud dependency for data privacy.",
                "3. Enable drag-and-drop and folder uploads.",
                "Action Items:",
                "- Test HEIC and multi-page TIFF handling.",
                "- Verify background queue throughput.",
            ]
        ),
        (
            os.path.join(out_dir, "store_receipt.webp"),
            "WEBP",
            [
                "TECHMART DOWNTOWN",
                "Store #402 - Register 3",
                "================================",
                "1x USB-C Hub Multiport    $34.99",
                "2x High-Speed HDMI Cable   $18.00",
                "1x Mechanical Keyboard    $89.50",
                "Tax (8.25%):              $11.75",
                "TOTAL PAID:              $154.24",
                "Thank you for shopping local!",
            ]
        ),
        (
            os.path.join(out_dir, "nested_folder", "contract_summary.png"),
            "PNG",
            [
                "SERVICE LEVEL AGREEMENT (SLA)",
                "Section 4.1: Data Sovereignty",
                "All document extraction occurs entirely",
                "within local machine perimeter.",
                "No telemetry or document binaries are",
                "transmitted to remote servers.",
                "Signed: Willem",
                "Date: 2026-10-13",
            ]
        ),
    ]

    for path, fmt, lines in samples:
        img = Image.new("RGB", (700, 480), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Draw a clean border
        draw.rectangle([(15, 15), (685, 465)], outline=(200, 200, 200), width=2)

        # Draw header bar
        draw.rectangle([(15, 15), (685, 60)], fill=(240, 244, 248))
        draw.text((30, 28), f"DOCUMENT PREVIEW: {os.path.basename(path)}", fill=(30, 41, 59))

        y = 80
        for line in lines:
            draw.text((40, y), line, fill=(15, 23, 42))
            y += 32

        img.save(path, format=fmt)
        print(f"Generated sample: {path}")

if __name__ == "__main__":
    generate_samples()
