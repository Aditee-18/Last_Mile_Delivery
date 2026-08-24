# 🚚 Last-Mile Delivery Management Platform

An enterprise-grade, full-stack **Last-Mile Delivery Management System** built with **Node.js, Express, PostgreSQL, React, TypeScript, and Tailwind CSS**.

The platform provides real-time zone detection, dynamic volumetric weight pricing, spatial agent auto-assignment, an immutable tracking history ledger, role-separated analytics dashboards, and server-controlled security boundaries.

---

## 📋 Table of Contents
- [User Roles & Dashboard Functionality Breakdown](#-user-roles--dashboard-functionality-breakdown)
- [Platform Metrics Model](#-platform-metrics-model)
- [System Architecture & Tech Stack](#-system-architecture--tech-stack)
- [Security Architecture & Role Model](#-security-architecture--role-model)
- [Database Schema & Data Modeling](#-database-schema--data-modeling)
- [Rate Calculation Engine Logic](#-rate-calculation-engine-logic)
- [Zone Detection Approach](#-zone-detection-approach)
- [Spatial Auto-Assignment Engine](#-spatial-auto-assignment-engine)
- [Order Status Lifecycle & Immutable Ledger](#-order-status-lifecycle--immutable-ledger)
- [Failed Delivery & Rescheduling Flow](#-failed-delivery--rescheduling-flow)
- [Environment Configuration & Secrets](#-environment-configuration--secrets)
- [Quickstart & Setup Instructions](#-quickstart--setup-instructions)
- [API Documentation Reference](#-api-documentation-reference)
- [Testing & Security Verification Suite](#-testing--security-verification-suite)
- [Evaluation Demo Credentials](#-evaluation-demo-credentials)
- [Live Hosted Application URLs](#-live-hosted-application-urls)

---

## 👥 User Roles & Dashboard Functionality Breakdown

The platform provides role-separated dashboards tailored specifically to the operational needs of each user type:

### 1. Customer Dashboard (`/dashboard`)
- **Real-Time Price Quote Calculation**: Instant freight rate breakdown before confirming an order.
- **Shipment Placement Modal**: Create B2B/B2C, Prepaid/COD orders with address, pincode, and package specs.
- **My Deliveries List**: View active and past orders created by the logged-in customer.
- **Tracking Timeline Modal**: Open live audit trail showing chronological event history for any order.
- **Delivery Rescheduling**: Select new delivery date and instructions when an attempt enters `FAILED` status.

### 2. Delivery Agent Dashboard (`/agent/dashboard`)
- **Personalized Header & Availability Toggle**: View duty status and toggle between `AVAILABLE`, `BUSY`, and `OFFLINE`.
- **GPS Telemetry Broadcast**: Click `[ GPS ]` button to capture device coordinates via browser Geolocation API and send updates to PostgreSQL (`PUT /api/agent/location`).
- **Operational Task Queue**: Scoped strictly to orders assigned to the logged-in agent (`assigned_agent_id = req.user.userId`).
- **Milestone Advancement**: Step-by-step order lifecycle progression (`PICKED_UP` ➔ `IN_TRANSIT` ➔ `OUT_FOR_DELIVERY` ➔ `DELIVERED`).
- **Failure Reporting**: Flag failed delivery attempts with mandatory reason notes, transitioning order to `FAILED` and notifying customer.

### 3. Admin Control Plane (`/admin/dashboard`)
- **Interactive Rate Cards Data Table**: Configure dynamic pricing rules (`B2B Intra`, `B2B Inter`, `B2C Intra`, `B2C Inter`).
- **Zone & Area Manager**: Define lat/lng bounding boxes and bulk-import pincode to zone mappings via CSV.
- **Workforce Agent Provisioning**: Create and assign new delivery agents securely without public registration.
- **Order Management & Dispatch**: View all orders, filter by status/zone/agent, trigger spatial auto-assignment, or manually override status milestones with mandatory audit logging.
- **Restricted Financial & Operational Analytics**: View platform revenue, total orders, pending orders, and agent status breakdowns.

---

## 📊 Platform Metrics Model

The platform structures metrics into two distinct security and operational tiers:

1. **Universal / Public Metrics** (Visible to all users, agents, and logged-out visitors):
   - **Completed Deliveries**: Total count of orders successfully delivered (`status = 'DELIVERED'`).
   - **Active Shipments**: Count of shipments currently in active pipeline states (`CREATED`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`).
   - **Registered Customers**: Total registered customer user accounts in the database.
   - **Delivery Success Rate**: Calculated delivery success ratio `(Completed / (Completed + Failed)) * 100`.

2. **Admin-Only Operational Analytics** (Restricted strictly to Admin role):
   - **Total Revenue**: Aggregate monetary charge of completed shipments (`SUM(total_charge)`).
   - **Total Orders**: Total number of orders created across all time.
   - **Pending Orders**: Orders awaiting agent assignment.
   - **Failed Deliveries**: Count of orders flagged with failed delivery attempts.
   - **Agent Availability & Fleet Status**: Active agent status breakdown (`AVAILABLE`, `BUSY`, `OFFLINE`).

All metrics are dynamically aggregated from actual database records in real-time. No business statistics or ratings are hardcoded or artificially incremented. Financial metrics such as total revenue are strictly protected behind backend RBAC authorization middleware (`requireRole(ADMIN)`).

---

## 🏗️ System Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             REACT + TYPESCRIPT FRONTEND                          │
│                   (Tailwind CSS, Vite, Axios, Lucide Icons)                     │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ REST API (JSON)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             NODE.JS + EXPRESS BACKEND                           │
│     (JWT Middleware, Zod Validation, RBAC Guards, Nodemailer, FSM Engine)       │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ SQL Queries / PostGIS Spatial Functions
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           POSTGRESQL RELATIONAL DATABASE                        │
│   (Users, Zones, Areas, Rate Cards, Surcharges, Orders, Immutable History)      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- **Backend**: Node.js, Express, TypeScript, `pg` (PostgreSQL client), Zod, JWT (`jsonwebtoken`), bcryptjs, Nodemailer.
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Axios, React Router v6, Lucide React icons.
- **Database**: PostgreSQL 14+ with PostGIS / Bounding Box spatial support.

---

## 🔒 Security Architecture & Role Model

The application enforces a **Server-Controlled Role Model** where user permissions are determined strictly by the database and signed JWT token claims.

### 1. Permissions Matrix

| Role | Public Registration? | Creation Mechanism | Access Scope & Permissions |
| :--- | :---: | :--- | :--- |
| **`CUSTOMER`** | ✅ Yes | Self-registration via `/register` | Create orders, view price quotes, track personal orders, reschedule failed deliveries. |
| **`DELIVERY_AGENT`** | ❌ No | Provisioned exclusively by Admin (`POST /api/admin/agents/create`) | View assigned task queue, update GPS location & availability, advance FSM status, report failure. |
| **`ADMIN`** | ❌ No | Idempotent seed script (`npm run db:seed`) | Full control plane: Manage zones/areas/rate cards, provision agents, manual/auto-assign, status override. |

### 2. Privilege Escalation Attack Prevention
- Public registration (`POST /api/auth/register`) accepts only `name`, `email`, `phone`, and `password`.
- The backend explicitly constructs user creation with `role = UserRole.CUSTOMER`.
- Any client-supplied `role` parameter in the HTTP payload (e.g., `"role": "admin"`) is strictly ignored and stripped on the server.

### 3. Backend Authorization Boundary
- **`401 Unauthorized`**: Returned when no valid Bearer JWT token is provided.
- **`403 Forbidden`**: Returned when an authenticated user attempts to access an endpoint outside their role scope (e.g., a Customer calling an Admin endpoint).

---

## 🗄️ Database Schema & Data Modeling

The database structure is defined in `backend/src/db/schema.sql`:

```text
users (id, name, email, password_hash, phone, role, created_at)
  ├── agent_profiles (id, user_id, status, current_lat, current_lng, assigned_zone_id)
  └── orders (id, tracking_number, customer_id, pickup_address, drop_address,
              pickup_zone_id, drop_zone_id, length_cm, width_cm, height_cm,
              actual_weight_kg, volumetric_weight_kg, chargeable_weight_kg,
              order_type, payment_type, base_charge, weight_charge, cod_surcharge, total_charge,
              status, assigned_agent_id, rescheduled_date)
        └── order_status_history (id, order_id, previous_status, new_status,
                                  changed_by_user_id, actor_role, location_lat, location_lng, notes, created_at)

zones (id, name, code, min_lat, max_lat, min_lng, max_lng)
  └── areas (id, name, pincode, zone_id)

rate_cards (id, order_type, is_intra_zone, base_fare, base_weight_kg, per_kg_rate, min_charge)
surcharge_configs (id, order_type, surcharge_type, surcharge_value)
```

---

## 🧮 Rate Calculation Engine Logic

No pricing values are hardcoded in the application. Pricing is calculated dynamically on order placement and pre-confirmation quote requests (`POST /api/customer/orders/quote`).

### Step-by-Step Calculation Formula

1. **Volumetric Weight Calculation**:  
   `volumetricWeightKg = (Length (cm) * Width (cm) * Height (cm)) / 5000`

2. **Billable Chargeable Weight**:  
   `chargeableWeightKg = max(actualWeightKg, volumetricWeightKg)`

3. **Rate Card Selection**:  
   The engine queries `rate_cards` matching:  
   `order_type IN ('B2B', 'B2C') AND is_intra_zone = (pickupZoneId == dropZoneId)`

4. **Freight Base & Extra Weight Calculation**:  
   `extraWeightKg = max(0, chargeableWeightKg - baseWeightKg)`  
   `weightCharge = extraWeightKg * perKgRate`  
   `baseFreightSum = max(minCharge, baseFare + weightCharge)`

5. **COD Surcharge Application**:  
   If `paymentType == 'COD'`, the engine applies the admin-configured surcharge (`FLAT` fee for B2C, `PERCENTAGE` of freight for B2B). If `PREPAID`, `codSurcharge = 0`.

6. **Total Delivery Charge**:  
   `totalCharge = baseFreightSum + codSurcharge`

---

## 🗺️ Zone Detection Approach

1. **Bounding Box Spatial Detection**: The backend tests geographic coordinates (`pickupLat`, `pickupLng`) against zone latitude/longitude bounds (`min_lat <= lat <= max_lat AND min_lng <= lng <= max_lng`).
2. **Pincode Fallback Mapping**: If coordinates are absent or outside bounds, the backend queries the `areas` table to resolve `pincode -> zone_id`.
3. **Intra vs. Inter-Zone Determination**:  
   `isIntraZone = (pickupZoneId == dropZoneId)`

---

## 🤖 Spatial Auto-Assignment Engine

When an order is created or rescheduled, the spatial assignment algorithm (`AssignmentService.findNearestAvailableAgent`):
1. Filters agents with `status = 'AVAILABLE'` assigned to the pickup zone or current active fleet.
2. Calculates spherical distance between pickup coordinates and agent `current_lat`/`current_lng` using the **Haversine Formula**:  
   `d = 2 * R * arcsin(sqrt(sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLng/2)))`
3. Assigns the nearest eligible agent, updates the order status to `ASSIGNED`, and updates the agent status to `BUSY`.

---

## 🔄 Order Status Lifecycle & Immutable Ledger

The backend implements a **Finite State Machine (FSM)** (`OrderLifecycleService`):

`CREATED` ➔ `ASSIGNED` ➔ `PICKED_UP` ➔ `IN_TRANSIT` ➔ `OUT_FOR_DELIVERY` ➔ `DELIVERED`

If delivery fails:  
`OUT_FOR_DELIVERY` ➔ `FAILED` ➔ `RESCHEDULED` ➔ `ASSIGNED`

### Immutable Audit History
Every status transition appends an un-editable row to `order_status_history` storing:
- `order_id`
- `previous_status` & `new_status`
- `changed_by_user_id` & `actor_role` (`CUSTOMER`, `DELIVERY_AGENT`, `ADMIN`)
---

## 📧 Notifications & Messaging Architecture (Email & SMS)

The platform provides asynchronous, non-blocking customer status notifications on every delivery milestone (`PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`):

### 1. Email Notification System
- Powered by **Nodemailer** (`NotificationService.sendEmailNotification`).
- Dispatches rich HTML emails with tracking milestone status, order number, and agent notes.
- Operates asynchronously (`Promise.all`) so that notification delivery or SMTP network delays never slow down API response times.

### 2. SMS System Status & Provider Disclosure
- **SMS Integration Disclaimer**: Because no free public SMS gateway API exists in India, SMS notifications are implemented via a dedicated console logger module (`SMS_PROVIDER=CONSOLE`).
- When order statuses change, the backend outputs structured SMS payloads:
  `📱 [SMS NOTIFICATION] To: +917982889509 | Msg: "[LastMile] Order TRK-1001 update: Status is now OUT FOR DELIVERY"`
- Optional production SMS gateways (such as Twilio) are supported via configuration variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).

### 3. Live Gmail Inbox Email Setup Guide
To have status updates delivered directly to your real Gmail inbox (`aditee.srivastava2004@gmail.com`), configure these environment variables in your **Vercel Backend Project**:
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER` = `your_gmail_address@gmail.com`
- `SMTP_PASS` = `your_16_digit_gmail_app_password`

*(Note: Gmail requires a 16-character App Password generated via Google Account Security > 2-Step Verification > App Passwords).*

> 💡 **Important Note on Email Delivery & Spam Filtering**:  
> Automated system emails sent via SMTP may occasionally be filtered by email providers into the **Spam**, **Junk**, or **Promotions** tab (or **Sent** / **All Mail** folder if sending to your own email address). Always check your **Spam / Junk** folder if an automated status update email does not immediately appear in your Primary Inbox.

---

## ⚙️ Environment Configuration & Secrets

Create a `.env` file in `backend/`:

```env
PORT=5000
NODE_ENV=development

# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=last_mile_delivery
DATABASE_URL=postgres://postgres:postgres@localhost:5432/last_mile_delivery

# JWT Security Secrets
JWT_SECRET=super_secret_jwt_key_last_mile_delivery_2026
JWT_EXPIRES_IN=7d

# Initial Admin Credentials (Used by seed script)
ADMIN_EMAIL=admin@delivery.com
ADMIN_PASSWORD=password123

# Nodemailer Email Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=mock_user
SMTP_PASS=mock_pass
FROM_EMAIL=notifications@lastmiledelivery.com
```

---

## 🚀 Quickstart & Setup Instructions

### 1. Database Setup & Migration
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

### 2. Run Backend API Server
```bash
cd backend
npm run dev
```
*Backend active at http://localhost:5000*

### 3. Run Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
*Frontend active at http://localhost:3000*

---

## 📚 API Documentation Reference

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Register customer account (forces `role = CUSTOMER`). |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive signed JWT token. |
| `GET` | `/api/analytics/public` | Public | Get public trust metrics (deliveries, success rate, zones). |
| `POST` | `/api/customer/orders/quote` | Customer | Pre-confirmation price quote calculation. |
| `POST` | `/api/customer/orders/create` | Customer | Book new order & trigger spatial auto-assignment. |
| `GET` | `/api/customer/orders` | Customer | List logged-in customer's order history. |
| `POST` | `/api/customer/orders/:id/reschedule` | Customer | Reschedule failed delivery attempt. |
| `GET` | `/api/customer/analytics` | Customer | Get customer order statistics. |
| `GET` | `/api/agent/profile` | Agent | View agent status & delivery stats. |
| `GET` | `/api/agent/orders` | Agent | View assigned task queue. |
| `PUT` | `/api/agent/location` | Agent | Broadcast GPS coordinates & duty availability. |
| `PUT` | `/api/agent/orders/:id/status` | Agent | Advance order milestone (`PICKED_UP` ➔ `DELIVERED`). |
| `PUT` | `/api/agent/orders/:id/fail` | Agent | Report delivery failure & notify customer. |
| `GET` | `/api/admin/analytics/overview` | Admin | Get platform-wide operational & revenue metrics. |
| `POST` | `/api/admin/agents/create` | Admin | Provision delivery agent account. |
| `PUT` | `/api/admin/rate-cards/:id` | Admin | Update dynamic rate card configuration. |
| `POST` | `/api/admin/zones` | Admin | Create delivery zone with lat/lng bounding box. |
| `POST` | `/api/admin/areas/bulk-csv` | Admin | Bulk-import pincode to zone mappings via CSV. |
| `PUT` | `/api/admin/orders/:id/override-status` | Admin | Override order status with audit logging. |

---

## 🧪 Testing & Security Verification Suite

Run automated backend security and calculation verification scripts:

```bash
cd backend

# Run Auth Security & Privilege Escalation Tests
npx tsx src/modules/auth/auth.test.ts

# Run Mathematical Rate Engine Tests
npx tsx src/core/rate-engine/rate.test.ts

# Run GPS & Agent Location Broadcast Tests
npx tsx src/modules/agent/agent.test.ts
```

---

## 🔑 Evaluation Demo Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@delivery.com` | `password123` | Full Admin Control Plane (Zones, Rate Cards, Agents, Status Overrides). |
| **Delivery Agent** | `agent.john@delivery.com` | `password123` | Operational Task Queue, Status Progressions (`PICKED_UP` ➔ `DELIVERED`), Failure Reporting. |
| **Demo Customer** | `customer@delivery.com` | `password123` | Order Creation, Price Quotes, Live Tracking, Delivery Rescheduling. |

---

## 🌐 Live Hosted Application URLs

- **Live Production Frontend**: `https://last-mile-delivery-f2cs.vercel.app`
- **Live Production Backend API**: `https://last-mile-delivery-nu.vercel.app`
- **PostgreSQL Database**: Supabase Cloud (Transaction Pooler Enabled)
