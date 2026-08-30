# Arcus Attendance System

The Arcus Attendance System is an ultra-streamlined, event-ready automation tool designed for extreme efficiency. By integrating a live camera QR scanner with AWS DynamoDB and client-side CSV template manipulation, this system instantly scans organization member UUIDs, fetches their pre-stored database records, and generates finalized documents on the fly.

---

## Architectural Workflow

- **Scan:** A web-based camera scanner reads an organization member's QR code containing their unique UUID.
- **Fetch:** The app queries the AWS DynamoDB table using the extracted UUID to retrieve the member's pre-established profile attributes.
- **Inject:** The retrieved record is mapped directly into a daily .csv file.
- **Export:** The completed, personalized document is instantly rendered and triggered for immediate download or print queueing.

---

## Tech Stack

- **Frontend Framework:** Next.js (with React, Zustand, & TypeScript)
- **Styling:** Tailwind CSS & COSS UI
- **QR Scanning:** `html5-qrcode` & `react-qr-reader`
- **Database:** AWS DynamoDB 
- **File Utilities:** `file-saver` & `lucide-react` (Icons)

---

## Project Structure

```text
Scan2PDF/
├── public/
│   └── templates/
│       └── static-form.pdf       # Target static PDF document template
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout with Tailwind imports
│   │   ├── page.tsx              # Main scanning & generation UI
│   │   └── api/
│   │       └── member/
│   │           route.ts          # Secure backend route to query DynamoDB
│   ├── components/
│   │   ├── ui/                   # COSS UI / Base UI primitives
│   │   └── QRScanner.tsx         # Live camera scanning interface
│   ├── utils/
│   │   └── csvFiller.ts          # Core pdf-lib template mapping logic
│   └── ...
├── package.json
└── tsconfig.json
```

## Getting Started

First, install the necessary modules. Use this command to extract the module versions from `package.json`:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
