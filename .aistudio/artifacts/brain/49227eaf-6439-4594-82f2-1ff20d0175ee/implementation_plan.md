# Proof of Payment Receipt Compression & Manifest Lightbox System

Compress uploaded payment proof images in the browser to under 300KB, persist them directly to Google Cloud Firestore with booking records, and provide clickable thumbnail previews and a full-size modal lightbox in the administrator patron manifest.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed in Phase 1 and govern the architectural strategy:

- **Confirmed Decision 1 (Storage Strategy)**: Compress images in the browser to under 300KB (WebP/JPEG, ~1200px max dimension) and store the Base64 data directly with the booking record in Firestore.
- **Confirmed Decision 2 (Manifest UX)**: Display a clickable receipt thumbnail in the Patron Manifest table with an eye icon/badge, opening a full-resolution receipt lightbox modal for instant payment verification without downloading.
- **Confirmed Security & Schema Alignment**: Update `firestore.rules` and `firebase-blueprint.json` to permit optional `proofOfPaymentData` and `proofOfPaymentName` fields in `/shows/{showId}/bookings/{seatId}`, followed by deploying rules via `DeployRules`.

---

### 1. Overview & Core Concept

- **What It Does**: Enables administrators and box office personnel booking seats under **Online Payment (GCash / Other Banks)** to drag or attach payment screenshots. The app instantly downsamples and compresses the image to a lightweight format (<300KB) in memory, shows an immediate thumbnail preview with compressed file size, and stores it in Firestore. In the **Manifest View**, staff see a receipt badge/thumbnail they can click to view the receipt in an inspection modal.
- **Target Audience / Persona**: SUCAC box office ticketing staff, financial auditors, and super admin "Bas" verifying digital bank transfers and GCash references against auditorium seat allocations.
- **Key Value**: Eliminates the risk of exceeding Firestore document boundaries while keeping payment verification instant, self-contained, and accessible without external file hosting dependencies or third-party cloud buckets.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Booking Flow with Online Payment**:
   - Staff selects seats on the auditorium map and chooses **Online Payment**.
   - Selects **GCash** or **Other Banks**.
   - Drags or selects a proof-of-payment image file.
   - A compression indicator briefly processes the image; the UI displays a clean preview card showing the file name, original vs. compressed size (e.g., `4.2 MB → 185 KB`), and a remove button.
   - Clicking **Confirm & Charge** writes the booking with the compressed receipt string to Firestore.

2. **Manifest Review & Inspection Flow**:
   - Staff switches to **Manifest** view.
   - The table displays an interactive **Receipt** column:
     - For online payments with proof: a miniature thumbnail with an expand hover state (`View Receipt`).
     - For online payments without proof: a subtle text indicator (`No receipt`).
     - For other methods (Cash, Tuition, Payroll): appropriate payment channel badge.
   - Clicking the thumbnail opens a clean **Receipt Lightbox Modal** showing the patron name, seat ID, payment channel, upload timestamp, and full-resolution receipt image with zoom and print/download options.

#### Visual Identity & Layout

- **Aesthetic Direction**: Functional SaaS / Box-Office Console styling consistent with the existing dark theme (`#020617` canvas, `#0f172a` structural cards, `#f59e0b` amber accents for SUCAC branding, `#06b6d4` cyan accents for digital workflows).
- **Zero-Pill Compliance**: Metadata tags (channels, IDs, amounts) use clean typography and subtle borders rather than bright rounded pills.
- **Receipt Thumbnail**: 36×36px rounded thumbnail with subtle border (`border border-slate-700 hover:border-cyan-400`), smooth transition, and quick hover preview.
- **Receipt Lightbox**: Center-staged dialog with dark translucent backdrop (`bg-black/85 backdrop-blur-md`), max width 640px, responsive image container, and keyboard escape support.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Canvas Compression vs. Server Storage Bucket**
  - *Chosen Approach*: Downscale images to max 1280px dimension at 0.75 WebP/JPEG quality using HTML5 `<canvas>` before saving Base64 to Firestore.
  - *Why*: Stays well below Firestore's 1MB document limit (typical compressed receipts are 80KB–220KB) and avoids configuring extra Google Cloud Storage buckets or external CDNs.
  - *Trade-Off*: Extremely high-resolution receipts are downsampled, but remain crisp and 100% legible for transaction reference numbers and amounts.

- **Decision 2: Direct Document Property vs. Subcollection**
  - *Chosen Approach*: Store `proofOfPaymentData` directly on the booking document in `/shows/{showId}/bookings/{seatId}`.
  - *Why*: Ensures atomic writes and real-time syncing across all admin screens with no secondary query overhead.

- **Decision 3: Firestore Rules & Blueprint Schema Update**
  - *Chosen Approach*: Expand `isValidBooking` in `firestore.rules` to permit optional `proofOfPaymentData` (string up to 450,000 characters) and `proofOfPaymentName` (string up to 200 characters), then execute `DeployRules`.
  - *Why*: Ensures database integrity while preventing permission errors when saving receipts.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          BOOKING MODAL                                 │
│  User attaches file (JPEG/PNG/PDF)                                     │
│  └─► compressImageToWebp(file, maxDimension=1280, quality=0.75)       │
│        └─► Output: Data URL (<300KB Base64)                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ writeBatch()
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   GOOGLE CLOUD FIRESTORE DATABASE                      │
│  Collection: /shows/{showId}/bookings/{seatId}                         │
│  Fields:                                                               │
│    - seatId, patronName, patronId, paymentMethod                       │
│    - proofOfPaymentData: "data:image/webp;base64,..." (Optional)       │
│    - proofOfPaymentName: "gcash_ref_1029.jpg" (Optional)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ onSnapshot() real-time listener
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PATRON MANIFEST TABLE                            │
│  - Displays compact receipt thumbnail in "Proof" column                │
│  - Click thumbnail ──► Opens Receipt Lightbox Dialog                   │
│  - Full image zoom, copy reference, and close dialog                   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Data Model Additions

```typescript
export interface Booking {
  seatId: string;
  patronName: string;
  patronId: string;
  paymentMethod: string;
  categoryId: string;
  bookedByUsername: string;
  bookedByName: string;
  notes?: string;
  bookedAt: string;
  // New fields for image preview:
  proofOfPaymentData?: string; // Compressed Base64 Data URL (<300KB)
  proofOfPaymentName?: string; // Original uploaded file name
}
```

#### Security Rules (`firestore.rules`) Update

```javascript
function isValidBooking(data) {
  return data.keys().hasAll(['seatId', 'patronName', 'patronId', 'paymentMethod', 'categoryId', 'bookedByUsername', 'bookedByName', 'bookedAt']) &&
         data.keys().hasOnly(['seatId', 'patronName', 'patronId', 'paymentMethod', 'categoryId', 'bookedByUsername', 'bookedByName', 'bookedAt', 'notes', 'proofOfPaymentData', 'proofOfPaymentName']) &&
         // existing size assertions...
         (!('proofOfPaymentData' in data) || (data.proofOfPaymentData is string && data.proofOfPaymentData.size() <= 450000)) &&
         (!('proofOfPaymentName' in data) || (data.proofOfPaymentName is string && data.proofOfPaymentName.size() <= 200));
}
```

---

### Verification Plan

1. **Compilation & Types**: Run `compile_applet` and `lint_applet` to confirm zero TypeScript errors.
2. **Security Rules Deployment**: Deploy updated rules via `DeployRules` RPC.
3. **Upload & Compression Test**: Verify an image file (e.g. 2MB–5MB) compresses to <300KB and displays the preview in the booking dialog.
4. **Real-time Persistence**: Verify the receipt data persists in Firestore and syncs across views.
5. **Manifest & Lightbox Test**: Verify the thumbnail renders in the manifest table and clicking it opens the full lightbox dialog with close/escape controls.
