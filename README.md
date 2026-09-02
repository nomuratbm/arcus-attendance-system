# Arcus Attendance

Arcus Attendance records check-in for AWS Student Builder Group events.
The scanner reads a member QR code. The server then queries AWS DynamoDB for that member.
The scanner page can also create a PDF of the local attendance list.

The npm package name is `scan-to-pdf`.

## Pages

- `/` — Student registration form. The browser keeps this form data for the tab session.
- `/addevent` — Event create form. Event records stay in the browser.
- `/scanner` — QR scan, member check, event select, and PDF export.

## How the app queries DynamoDB

The browser does not connect to DynamoDB.
The scanner sends the QR UUID to `GET /api/member?uuid=...`.
The Next.js route `src/app/api/member/route.ts` queries the table.

The server creates `DynamoDBClient` with an empty config object.
The AWS SDK then reads credentials from the process environment.

These environment variables are required. Copy `.env.example` to `.env` and enter values.

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DYNAMODB_TABLE_NAME`

The route queries `PK = MEMBER#<uuid>`.
If that query returns no item, the route queries `PK = <uuid>`.
The route returns the first matching item.

The app does not write Event, Member, or Attendance items to DynamoDB.
The structures below describe the table items that the stores map to.

## DynamoDB data structure

The app uses one table. Each item has a composite key.

- **PK** (partition key) groups related items.
- **SK** (sort key) identifies one item in that group.

The prefix before `#` marks the item type. Example: `MEMBER#` or `EVENT#`.

### Member item

The scanner reads this item from DynamoDB.
The registration form maps to this item. The app does not write the item yet.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `PK` | string | `MEMBER#(uuid)`. The UUID comes from the member QR code. |
| `SK` | string | Same value as `PK`. |
| `uuid` | string | The member UUID without a required prefix. |
| `full_name` | string | Member name. The form field `studentName` maps to this. |
| `student_id` | string | Student number. The form field `studentNumber` maps to this. |
| `course` | string | Program and year. The form field `programYear` maps to this. |
| `department` | string | School or department. The form field `department` maps to this. |
| `student_email` | string, optional | Member email. The current form does not collect this. |
| `role` | string, optional | Member role. The current form does not collect this. |
| `year` | string or number, optional | Year level. The form may send this inside `course` instead. |

The registration form does not create the UUID or the `MEMBER#` keys yet.

### Event item

The add-event page creates this shape in the browser.
The app does not write this item to DynamoDB.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `PK` | string | `EVENT#(timestamp)`. The timestamp is the create time in milliseconds. |
| `SK` | string | Same value as `PK`. |
| `Name` | string | Event name. |
| `Description` | string | Event description. |

The scanner page selects one event from this list. That selection is the event for the scan session.

### Attendance item

The scanner keeps attendance history in memory.
The app does not write this item to DynamoDB.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `PK` | string | `EVENT#(timestamp)` of the selected event. |
| `SK` | string | `MEMBER#(uuid)` of the scanned member. |
| `scannedAt` | string | Local time of the scan, for display. |
| `timestamp` | number | Scan time in milliseconds. |

This key pair ties one member check-in to one event.

## Local stores

Zustand holds data that the app does not write to DynamoDB.

- Events stay in `localStorage` under `arcus-events`.
- Student form data stays in `sessionStorage` under `arcus-student-form`.
- Attendance history stays in memory. A full page load clears it.

## Tech stack

- **App framework:** Next.js 16, React 19, TypeScript
- **UI:** Tailwind CSS v4, coss UI on Base UI
- **QR scan:** `html5-qrcode` (camera), `qr-scanner` (image file)
- **Database:** AWS DynamoDB, query only
- **PDF:** `pdf-lib` creates a new attendance PDF. The app does not fill a static template file.
- **Client state:** Zustand
- **Icons and download:** `lucide-react`, `file-saver`

## Project structure

```text
arcus-attendance-system/
├── .env.example
├── public/
│   └── test-qrs/                 # Sample QR images
├── src/
│   ├── app/
│   │   ├── page.tsx              # Registration (`/`)
│   │   ├── addevent/page.tsx     # Add event (`/addevent`)
│   │   ├── scanner/page.tsx      # Scanner (`/scanner`)
│   │   └── api/member/route.ts   # DynamoDB member query
│   ├── components/               # Pages, scanner, forms, header
│   ├── store/                    # Zustand stores
│   ├── lib/                      # Shared helpers
│   └── utils/pdfFiller.ts        # Attendance PDF create logic
├── package.json
└── tsconfig.json
```

## Run the app

1. Copy `.env.example` to `.env`.
2. Enter the AWS region, access keys, and table name.
3. Install the packages.

```bash
npm install
```

4. Start the development server.

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in a browser.

Edit files under `src/`. The development server reloads the app.
