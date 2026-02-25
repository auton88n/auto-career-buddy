

# Fix: PDF Text Size and Single-Page Fit

## Problem
The `jsPDF.html()` method scales text down due to the width ratio (700px container → 515pt output = 0.74x scale). This makes 10pt text appear as ~7pt. Additionally, the PDF must always fit on a single page.

## Solution

Switch to `html2canvas` at `scale: 3` for crisp rendering, then fit the resulting image onto exactly one A4 page.

### Changes to `src/pages/Index.tsx` — `downloadAsPDF` function (lines 64-96)

Replace the current `jsPDF.html()` approach:

1. Container width: 794px with 50px/60px padding (A4 proportions at 96dpi)
2. Font sizes in px that render correctly on screen and in the image:
   - Name: 28px, Subtitle: 16px, Contact: 12px
   - Section headers: 14px, Body/bullets: 13px
3. Render with `html2canvas` at `scale: 3`
4. Create A4 PDF (210x297mm), calculate the image aspect ratio, and scale the image to fit the full page width — if the height exceeds the page, scale down proportionally so everything fits on one page
5. Single `pdf.addImage()` call — always one page, no overflow

Key logic for single-page fit:
```
const pageW = 210, pageH = 297 (mm)
const imgAspect = canvas.height / canvas.width
let drawW = pageW, drawH = pageW * imgAspect
if (drawH > pageH) { drawH = pageH; drawW = pageH / imgAspect }
pdf.addImage(imgData, "PNG", 0, 0, drawW, drawH)
```

No other files change.

