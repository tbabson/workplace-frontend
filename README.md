# WorkPlace — Frontend

The React/TypeScript frontend for **WorkPlace**, an internal HR and operations management platform for organisations. It communicates with a Go REST/WebSocket backend and covers the full employee lifecycle — attendance, payroll supplements, projects, communication, leave, and more.

---

## Tech Stack

| Layer         | Technology                                |
| ------------- | ----------------------------------------- |
| Framework     | React 18 + TypeScript                     |
| Build tool    | Vite 8                                    |
| Styling       | Tailwind CSS v3                           |
| Routing       | React Router v7                           |
| Server state  | TanStack React Query v5                   |
| Client state  | Zustand v5 (persisted)                    |
| Forms         | React Hook Form v7 + Zod                  |
| HTTP          | Axios (httpOnly cookie auth + JWT bearer) |
| Real-time     | Native WebSocket                          |
| Charts        | Recharts                                  |
| Icons         | Lucide React                              |
| Notifications | react-hot-toast                           |

---

## Features

### Authentication

- Email/password login with httpOnly cookie session
- JWT token stored in Zustand (`localStorage`) for WebSocket auth
- Auto-redirect to `/login` on 401; session restored on page reload
- Role-aware UI — menus and actions adapt per role

### Dashboard

- Role-specific KPI cards (total users, active projects, signed-in today, pending leaves, overtime hours, etc.)
- Charts: attendance trend, average hours worked, project status distribution, recent project activity
- Time-aware greeting (Good morning / afternoon / evening)

### Users _(super_admin)_

- Create, edit, and deactivate staff accounts
- Assign roles, departments, and positions

### Departments _(super_admin)_

- Create and manage departments
- Department head assignment

### Projects

- Full project lifecycle: create → active → on hold → completed / cancelled
- Milestones, tasks (with assignees), file attachments, budget tracking
- Per-project chat room (auto-created)
- Project history / activity log
- Role-filtered view: admins see all, dept heads see their dept, staff see assigned projects

### Attendance

- GPS-based sign-in / sign-out with geofence enforcement
- Admin view of all records; staff see their own history
- Real-time update via WebSocket event dispatch

### Overtime

- Managers log overtime for staff with start/end time, hourly rate, and notes
- Hours auto-calculated from timestamps
- Mark as paid workflow
- Responsive card layout on mobile, full table on desktop

### Chat

- Room types: General, Departmental, Project, Direct Message (DM)
- Real-time messaging via WebSocket
- Message reactions (emoji picker), threaded replies, message deletion
- Typing indicators
- Unread badge per room
- Mobile-friendly: rooms list and message panel switch on small screens
- Offline members receive an in-app notification with the sender's name

### Memos

- Send memos to an individual, a department, or the whole company
- Acknowledgement tracking (acknowledged / pending counts)
- All recipients notified in-app and by email on send

### Queries

- Staff raise queries; managers respond
- Status tracking: open → resolved

### Leave Management

- Staff apply for annual, sick, maternity/paternity, unpaid, or other leave
- Managers approve or reject; staff can cancel pending requests
- In-app + email notifications on status change

### Performance Reviews

- Managers create and submit reviews for staff
- Self-review support

### Expense Claims

- Staff submit expense claims with category, amount, and description
- Approval / rejection workflow with paid status tracking
- In-app + email notifications

### Asset Management _(admin / procurement)_

- Track company assets with category, serial number, and condition
- Assign assets to staff; track return dates

### Reports _(admin / dept_head / procurement)_

- **Overview**: user count, active projects, signed-in today, pending leaves + pie/bar charts
- **Attendance tab**: trend chart, average daily hours, tabular log with CSV export
- **Overtime tab**: hours-by-employee bar chart, daily trend, tabular log with CSV export
- Date-range filters on all report sections

### Profile

- Update personal details and password

---

## Role Access Matrix

| Module      | super_admin | dept_head | procurement | staff |
| ----------- | :---------: | :-------: | :---------: | :---: |
| Dashboard   |      ✓      |     ✓     |      ✓      |   ✓   |
| Users       |      ✓      |           |             |       |
| Departments |      ✓      |           |             |       |
| Projects    |      ✓      |     ✓     |      ✓      |   ✓   |
| Attendance  |      ✓      |     ✓     |      ✓      |   ✓   |
| Overtime    |      ✓      |     ✓     |      ✓      |   ✓   |
| Chat        |      ✓      |     ✓     |      ✓      |   ✓   |
| Memos       |      ✓      |     ✓     |      ✓      |   ✓   |
| Queries     |      ✓      |     ✓     |      ✓      |   ✓   |
| Leave       |      ✓      |     ✓     |      ✓      |   ✓   |
| Reviews     |      ✓      |     ✓     |      ✓      |   ✓   |
| Claims      |      ✓      |     ✓     |      ✓      |   ✓   |
| Assets      |      ✓      |     ✓     |      ✓      |       |
| Reports     |      ✓      |     ✓     |      ✓      |       |

---

## Real-time

Two persistent WebSocket connections run while the user is logged in:

| Connection       | Path                       | Purpose                                          |
| ---------------- | -------------------------- | ------------------------------------------------ |
| Notifications WS | `/api/v1/notifications/ws` | In-app bell notifications for all event types    |
| Chat WS          | `/api/v1/chat/ws/:roomId`  | Live chat messages, typing indicators, reactions |

Both authenticate via `?token=<jwt>` query param (fallback for environments where cookies are not forwarded on WebSocket upgrades).

A synthesised two-tone sound plays on every incoming notification using the Web Audio API — no audio files required. Sound is triggered via the global `workplace:notification` browser event so any module can fire it without importing the audio utility directly.

---

## Project Structure

```
src/
├── api/            # Axios API modules (one file per backend resource)
├── components/
│   ├── layout/     # Layout, Sidebar, Topbar
│   ├── shared/     # PageHeader, EmptyState
│   └── ui/         # Button, Input, Modal, Badge, Avatar, Spinner, Card
├── pages/          # One folder per route
├── store/          # Zustand stores (authStore)
├── types/          # Shared TypeScript interfaces
└── utils/          # helpers (formatters, cn), sound (Web Audio)
```

---

## Prerequisites

- Node.js 18+
- The [WorkPlace backend](../workplace-app) running (default port `8090`)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

---

## Backend API

All requests go to `VITE_API_URL` (default `http://localhost:8090/api/v1`). Authentication uses **httpOnly cookies** (`auth_token`, `SameSite=Lax`) for standard HTTP requests and a **JWT query param** (`?token=`) for WebSocket connections. The 401 interceptor in `src/api/client.ts` automatically logs the user out and redirects to `/login` on any unauthenticated response.
