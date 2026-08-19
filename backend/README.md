# Byinks Health — Backend API

A real backend for the Byinks Health telemedicine app, built to be a drop-in
replacement for the `localStorage`-based `services/apiService.ts` in the
`Byinks_health99` frontend repo.

- **Runtime:** Node.js + Express
- **ORM:** Sequelize
- **Database:** PostgreSQL in production, automatic SQLite fallback for local dev (zero setup)
- **Auth:** JWT (bcrypt-hashed passwords)
- **Realtime:** Socket.IO (replaces the Supabase broadcast channels used in the original frontend)

## 1. Quick start (local dev, SQLite — no DB install needed)

```bash
npm install
cp .env.example .env
# Leave DATABASE_URL commented out in .env to use SQLite automatically
npm run seed     # creates admin + one demo account per role
npm run dev      # starts on http://localhost:5000
```

Seeded accounts (password `Password123!` for all except admin):
| Role | Email |
|---|---|
| ADMIN | admin@byinkshealth.com (password from `ADMIN_PASSWORD` in .env) |
| CONSULTANT | consultant@byinkshealth.com |
| PHARMACY | pharmacy@byinkshealth.com |
| DISPATCH | dispatch@byinkshealth.com |
| PATIENT | patient@byinkshealth.com |

## 2. Quick start (PostgreSQL)

Set `DATABASE_URL` in `.env` to a real Postgres connection string, e.g.:

```
DATABASE_URL=postgres://user:password@localhost:5432/byinks_health
```

If your host requires SSL (Render, Railway, Supabase Postgres, etc.), also set:
```
DB_SSL=true
```

Then run the same `npm run seed` / `npm start` commands. Tables are created
automatically via `sequelize.sync()` on boot — no manual migration step needed
for this project's scale.

## 3. Environment variables

See `.env.example`. Key ones:
- `JWT_SECRET` — **change this** before deploying anywhere real.
- `CLIENT_ORIGINS` — comma-separated list of frontend origins allowed by CORS (also used for Socket.IO CORS).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — used only by the seed script to bootstrap the first admin.

## 4. Architecture notes

- **Roles**: `PATIENT`, `CONSULTANT`, `PHARMACY`, `DISPATCH`, `ADMIN` (matches `UserRole` in the frontend's `types.ts`).
- **Approval workflow**: Patients and admins are auto-approved on signup. Consultants, pharmacies, and dispatch riders are created with `isApproved: false` and must be approved by an admin via `PATCH /api/users/:userId/status`.
- **Prescription → Delivery pipeline**: when a prescription's status is updated to `ready_for_dispatch`, a `DeliveryOrder` is auto-created so the dispatch dashboard picks it up — mirroring the workflow implied by the frontend's dashboards.
- **Realtime replaces Supabase broadcast**: the original frontend used Supabase realtime channels purely for cross-tab broadcast (no Supabase tables). This backend uses Socket.IO rooms instead:
  - `user:<userId>` — personal notifications
  - `chat:<chatId>` — chat messages (join with `socket.emit('chat:join', chatId)`)
  - `delivery:<deliveryId>` — live location pings for order tracking
  - Clients authenticate the socket handshake with the same JWT used for REST: `io(url, { auth: { token } })`.

## 5. API reference (all JSON, all under `/api`)

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/signup` | — | `{ name, email, password, role, ...profileFields }` |
| POST | `/auth/signin` | — | `{ email, password }` → `{ user, token }` |
| POST | `/auth/signout` | Bearer | |
| GET | `/auth/me` | Bearer | |

### Users
| Method | Path | Auth |
|---|---|---|
| GET | `/users` | Admin |
| GET | `/users/:userId` | Bearer |
| PATCH | `/users/:userId` | Bearer (self or admin) |
| POST | `/users` | Admin — create a user directly |
| DELETE | `/users/:userId` | Admin |
| PATCH | `/users/:userId/status` | Admin — approve/reject, toggle online, etc. |

### Appointments
| Method | Path | Auth |
|---|---|---|
| GET | `/appointments?patientId=&consultantId=` | Bearer |
| POST | `/appointments` | Bearer |
| PATCH | `/appointments/:id` | Bearer |
| POST | `/appointments/:id/cancel` | Bearer |
| POST | `/appointments/:id/reschedule` | Bearer — `{ date, time }` |
| GET | `/appointments/availability/:consultantId` | Bearer |
| PUT | `/appointments/availability/:consultantId` | Bearer — `{ blockedSlots }` |

### Medical reports
| Method | Path | Auth |
|---|---|---|
| GET | `/reports?patientId=&status=` | Bearer |
| POST | `/reports` | Bearer |
| PATCH | `/reports/:id/review` | Consultant/Admin — `{ status, consultantNote, vettedBy }` |

### Prescriptions
| Method | Path | Auth |
|---|---|---|
| GET | `/prescriptions?patientId=&consultantId=&pharmacyId=&status=` | Bearer |
| POST | `/prescriptions` | Consultant/Admin |
| PATCH | `/prescriptions/:id/status` | Bearer — `{ status, pharmacyId?, patientAddress? }` |

### Deliveries
| Method | Path | Auth |
|---|---|---|
| GET | `/deliveries?patientId=&pharmacyId=&dispatchId=&status=` | Bearer |
| POST | `/deliveries` | Bearer |
| PATCH | `/deliveries/:id/assign` | Bearer — `{ dispatchId }` |
| PATCH | `/deliveries/:id/status` | Bearer — `{ status }` |
| PATCH | `/deliveries/:id/location` | Bearer — `{ lat, lng }`, also emits `delivery:location` over socket |

### Notifications
| Method | Path | Auth |
|---|---|---|
| GET | `/notifications/:userId` | Bearer |
| POST | `/notifications` | Bearer — also emits `notification:new` over socket |
| PATCH | `/notifications/:id/read` | Bearer |

### Transactions
| Method | Path | Auth |
|---|---|---|
| GET | `/transactions/:userId` | Bearer |
| POST | `/transactions` | Bearer |

### Sync requests (device-approval flow)
| Method | Path | Auth |
|---|---|---|
| GET | `/sync-requests` | Admin |
| POST | `/sync-requests` | — `{ requesterEmail, deviceInfo }` |
| PATCH | `/sync-requests/:id/status` | Admin — `{ status: 'approved'|'rejected' }` |

### Chat
| Method | Path | Auth |
|---|---|---|
| GET | `/chat/threads/:userId` | Bearer |
| GET | `/chat/:chatId/messages` | Bearer |
| POST | `/chat/:chatId/messages` | Bearer — also emits `chat:message` over socket |
| POST | `/chat/:chatId/end` | Bearer — also emits `chat:ended` over socket |

## 6. Wiring up the existing frontend

The frontend's `services/apiService.ts` currently reads/writes `localStorage`
directly and uses Supabase only for broadcast. To connect it to this backend:

1. Replace each `localStorage.getItem/setItem` call with a `fetch` to the
   matching endpoint above, attaching `Authorization: Bearer <token>` (store
   the token from signin in memory / a single localStorage key, not the whole DB).
2. Replace the Supabase `channel(...).send(...)` broadcast calls with
   `socket.emit(...)` / `socket.on(...)` using the rooms described above.
3. I'm happy to write that updated `apiService.ts` for you directly against
   this API if you want it — just say the word and point me at how you're
   deploying the backend (Render/Railway/Fly/your own VPS), so I can hardcode
   the right base URL and CORS origin.

## 7. Deployment notes

- Any Node host works (Render, Railway, Fly.io, a VPS). Set `DATABASE_URL` to
  a managed Postgres instance and `CLIENT_ORIGINS` to your deployed frontend
  URL (e.g. `https://byinks-health.vercel.app`).
- Run `npm run seed` once against the production database to bootstrap the
  admin account, then change that password immediately.
postgresql://byinks_health_db_user:LnAyEg7CONxor5HZKCWshZw4FM6JmYbh@dpg-da2nqdflk1mc73cj2t50-a/byinks_health_db