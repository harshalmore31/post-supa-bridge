# 📦 Real-Time Inventory Management System

A real-time inventory sync system that bridges a **local PostgreSQL database** with **Supabase**. Any updates made to the local database are mirrored to Supabase in real-time using a custom Python listener. Supabase’s built-in real-time features then push updates instantly to the frontend, enabling live dashboards and inventory tracking.

---

## 🚀 What It Does

- Listens for changes in a **local PostgreSQL** database
- Pushes those changes to **Supabase**
- Supabase emits real-time updates to a **Nuxt 3 / Astro frontend**
- Enables instant UI refresh on stock updates, ideal for **quick commerce** and **inventory-heavy applications**

---

## 🛠 Tech Stack

| Layer          | Tech Used                                 |
|----------------|--------------------------------------------|
| Local Database | PostgreSQL                                 |
| Sync Layer     | Python scripts + Supabase API              |
| Cloud Backend  | Supabase (PostgreSQL + Realtime API)       |
| Frontend       | Nuxt 3, Astro, Tailwind CSS, Vue.js        |
| Deployment     | Vercel / Render / Localhost (dev setup)    |

---

## 📁 Folder Overview
```txt
harshalmore31-post-supa-bridge/
├── data.csv
├── package.json
├── .env.example
├── .nuxtrc
├── archives/
│   ├── api-req.py
│   ├── final copy.py
│   ├── final.py
│   ├── index.html
│   ├── post-supa.py
│   ├── server.js
│   ├── x copy 2.html
│   ├── x copy.html
│   └── x.html
├── examples/
│   └── __tests__/
│       └── sentry/
│           ├── sentry-example-page.vue
│           └── server/
│               ├── tsconfig.json
│               └── api/
│                   └── sentry-example-api.ts
├── supa/
│   ├── api.py
│   ├── charts.js
│   ├── database_operations.py
│   ├── index.html
│   ├── main.py
│   ├── script.js
│   ├── styles.css
│   └── utilities.js
├── supa-astro/
│   ├── README.md
│   ├── astro.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── env.d.ts
│       ├── components/
│       │   ├── InventoryDashboard.jsx
│       │   ├── ProductGrid.jsx
│       │   └── StatsPanel.jsx
│       ├── layouts/
│       │   └── MainLayout.astro
│       ├── lib/
│       │   ├── api.js
│       │   ├── chartUtils.js
│       │   ├── formatters.js
│       │   └── supabase.js
│       └── pages/
│           ├── index.astro
│           └── api/
│               └── items/
│                   ├── [id].js
│                   └── index.js
├── supa-nuxt/
│   ├── README.md
│   ├── app.vue
│   ├── eslint.config.mjs
│   ├── nuxt.config.ts
│   ├── package.json
│   ├── sentry.client.config.ts
│   ├── sentry.server.config.ts
│   ├── tsconfig.json
│   ├── assets/
│   │   └── css/
│   │       └── main.css
│   ├── components/
│   │   ├── AppHeader.vue
│   │   ├── AppNotification.vue
│   │   ├── ConnectionError.vue
│   │   ├── EmptyState.vue
│   │   ├── InventoryFilters.vue
│   │   ├── InventoryGrid.vue
│   │   ├── LoadingSpinner.vue
│   │   ├── PerformanceLogsButton.vue
│   │   ├── ProductCard.vue
│   │   ├── StatCard.vue
│   │   └── StatsContainer.vue
│   ├── composables/
│   │   ├── useFormatting.js
│   │   ├── useInventory.js
│   │   ├── useNotifications.js
│   │   └── useSupabase.js
│   ├── layouts/
│   │   └── default.vue
│   ├── pages/
│   │   ├── index.vue
│   │   └── time.vue
│   ├── public/
│   │   └── robots.txt
│   └── server/
│       └── api/
│           └── cached-inventory.get.ts
└── .github/
    └── workflows/
        └── nuxthub.yml
```



---

## 🧠 How It Works

1. A Python script (`supa/main.py`) uses `psycopg2` to connect to your **local PostgreSQL** database.
2. It monitors changes using triggers or polling.
3. When a change is detected, the script **pushes updated data to Supabase** via its REST API.
4. **Supabase** emits those changes to connected clients using its **real-time listener** system.
5. The **frontend (Nuxt or Astro)** consumes those updates and reflects them instantly in the UI.

---
