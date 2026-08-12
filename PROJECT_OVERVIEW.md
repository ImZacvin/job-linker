# Job Linker — Panduan Memahami Ulang Proyek Skripsi

> Dokumen ini dibuat sebagai referensi komprehensif untuk memahami kembali proyek **Job Linker** secara menyeluruh — mulai dari tujuan, arsitektur, cara kerja AI, hingga cara menjalankannya.

---

## Daftar Isi

1. [Ringkasan Proyek](#1-ringkasan-proyek)
2. [Masalah yang Diselesaikan](#2-masalah-yang-diselesaikan)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Tech Stack](#4-tech-stack)
5. [Struktur Folder](#5-struktur-folder)
6. [Database & Schema](#6-database--schema)
7. [Alur Kerja Sistem (End-to-End)](#7-alur-kerja-sistem-end-to-end)
8. [Pipeline AI & Algoritma Matching](#8-pipeline-ai--algoritma-matching)
9. [API Endpoints](#9-api-endpoints)
10. [Komponen Frontend](#10-komponen-frontend)
11. [Browser Extension](#11-browser-extension)
12. [Queue & Background Workers](#12-queue--background-workers)
13. [Cara Menjalankan Proyek](#13-cara-menjalankan-proyek)
14. [Kontribusi Penelitian (Thesis)](#14-kontribusi-penelitian-thesis)

---

## 1. Ringkasan Proyek

**Job Linker** adalah platform pelacak lamaran kerja berbasis AI yang terdiri dari tiga komponen utama:

| Komponen | Peran |
|---|---|
| 🧩 **Browser Extension** | Scraping lowongan dari LinkedIn, SEEK, dan Glints lalu menyimpan ke backend |
| 🖥️ **Web Dashboard** | Menampilkan lowongan dalam Kanban board dengan skor kecocokan CV |
| 🤖 **AI Matching Engine** | Menghitung skor kecocokan antara CV pengguna dan deskripsi pekerjaan |

**Tagline singkat:** *"Save jobs from the web, let AI tell you how well you fit."*

---

## 2. Masalah yang Diselesaikan

### Problem
Pencari kerja sering kesulitan untuk:
1. Melacak puluhan lamaran di berbagai platform (LinkedIn, SEEK, Glints)
2. Menilai secara objektif seberapa cocok CV mereka dengan suatu posisi
3. Mengetahui skill apa yang kurang (*skill gap*) untuk suatu pekerjaan

### Solusi
- Satu tempat untuk **melacak semua lowongan** dengan drag-and-drop Kanban board
- **Skor kecocokan otomatis** (0–100%) antara CV dan job description menggunakan AI
- Daftar **skill yang sudah cocok** dan **skill yang masih kurang** beserta penjelasan dari LLM

---

## 3. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
└──────────────┬────────────────────────────┬─────────────────────┘
               │                            │
               ▼                            ▼
   ┌───────────────────┐        ┌─────────────────────┐
   │  Browser Extension│        │   Web Dashboard      │
   │  (Plasmo/Firefox/ │        │   (React 19 + Vite)  │
   │   Chrome)         │        │   localhost:5173     │
   └────────┬──────────┘        └──────────┬──────────┘
            │  POST /api/jobs              │  REST API calls
            │                             │
            ▼                             ▼
   ┌─────────────────────────────────────────────────┐
   │              Backend API (Express 5)            │
   │              localhost:3000/api                 │
   │                                                 │
   │  ┌──────────┐ ┌───────┐ ┌──────┐ ┌──────────┐ │
   │  │   Auth   │ │  Job  │ │  CV  │ │ Matching │ │
   │  │  Module  │ │Module │ │Module│ │  Module  │ │
   │  └──────────┘ └───┬───┘ └──┬───┘ └────┬─────┘ │
   └───────────────────┼────────┼──────────┼────────┘
                       │        │          │
                       ▼        ▼          ▼
   ┌────────────────────────────────────────────────┐
   │                  BullMQ Queues                 │
   │   embed-cv │ embed-job │ match-job │ enrich-job │
   └───────────────────────┬────────────────────────┘
                           │ Workers process async
              ┌────────────┼────────────┐
              ▼            ▼            ▼
   ┌──────────────┐ ┌──────────┐ ┌───────────┐
   │  PostgreSQL  │ │  Redis   │ │ Weaviate  │
   │  (main DB)   │ │ (queues) │ │(vector DB)│
   └──────────────┘ └──────────┘ └───────────┘
              │                        │
              └──────────┬─────────────┘
                         ▼
              ┌────────────────────┐
              │   OpenAI API       │
              │  - text-embedding  │
              │    -3-small        │
              │  - gpt-4o-mini     │
              └────────────────────┘
```

---

## 4. Tech Stack

### Backend
| Teknologi | Fungsi |
|---|---|
| Node.js + Express 5 | REST API server |
| PostgreSQL | Database utama (users, jobs, cvs, matches) |
| Redis | Message broker untuk BullMQ |
| BullMQ | Async job queue (embedding, matching, enrichment) |
| Weaviate | Vector database untuk menyimpan embeddings |
| OpenAI SDK | `text-embedding-3-small` + `gpt-4o-mini` |
| pdf-parse | Parse file PDF (untuk CV) |
| mammoth | Parse file DOCX (untuk CV) |
| bcryptjs | Hashing password |
| jsonwebtoken | JWT auth (access + refresh token) |

### Frontend
| Teknologi | Fungsi |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| React Router v7 | Client-side routing |
| Tailwind CSS v4 | Styling |
| shadcn/ui | UI component library |
| @dnd-kit | Drag-and-drop Kanban |
| sonner | Toast notifications |
| lucide-react | Icons |

### Browser Extension
| Teknologi | Fungsi |
|---|---|
| Plasmo Framework | Extension framework (Firefox MV3 & Chrome MV3) |
| React 18 | Extension popup UI |
| @plasmohq/storage | Persistent extension storage |

### Infrastructure
| Teknologi | Fungsi |
|---|---|
| Docker + Docker Compose | Menjalankan Redis & Weaviate secara lokal |
| nginx | Reverse proxy untuk production build |
| Cloudflare Tunnel | HTTPS tunneling untuk production |

---

## 5. Struktur Folder

```
job-linker/
│
├── backend/
│   └── src/
│       ├── config/              # Konfigurasi koneksi ke semua service
│       │   ├── env.js           # Environment variables
│       │   ├── postgres.js      # PostgreSQL connection pool
│       │   ├── redis.js         # Redis client
│       │   ├── weaviate.js      # Weaviate client + schema init
│       │   └── openai.js        # OpenAI client singleton
│       │
│       ├── core/models/
│       │   └── base.model.js    # Generic CRUD base class
│       │
│       ├── database/
│       │   ├── migrate.js       # Migration runner
│       │   └── migrations/      # SQL migration files (001–010)
│       │
│       ├── middleware/
│       │   ├── auth.middleware.js   # JWT verification
│       │   └── error.middleware.js  # Global error handler
│       │
│       ├── modules/             # Feature modules (MVC pattern)
│       │   ├── auth/            # Register, login, refresh token
│       │   ├── user/            # Profile management
│       │   ├── job/             # CRUD lowongan kerja
│       │   ├── cv/              # Upload, parse, kelola CV
│       │   └── matching/        # Skor kecocokan CV vs JD
│       │
│       ├── lib/                 # Shared utilities & AI logic
│       │   ├── sections.js      # GPT section extraction + batch embedding
│       │   ├── rerank.js        # LLM re-ranking score
│       │   └── html.js          # HTML sanitizer untuk teks embedding
│       │
│       ├── queues/
│       │   ├── index.js         # Queue definitions + enqueue helpers
│       │   ├── worker.js        # Worker process entry point
│       │   ├── processors/
│       │   │   ├── embedCv.js   # Worker: embed CV ke Weaviate
│       │   │   ├── embedJob.js  # Worker: embed job ke Weaviate
│       │   │   ├── matchJob.js  # Worker: hitung skor kecocokan
│       │   │   └── enrichJob.js # Worker: fetch deskripsi dari platform
│       │   └── enrichers/
│       │       ├── linkedin.js  # Scraper API LinkedIn
│       │       ├── seek.js      # Parser SEEK job data
│       │       └── glints.js    # Parser Glints JSON-LD
│       │
│       └── index.js             # Express server entry point
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Register.tsx
│       │   ├── Dashboard.tsx    # Halaman utama (Kanban + CV card)
│       │   ├── CvUpload.tsx
│       │   └── Recommended.tsx  # List lowongan sorted by skor
│       │
│       ├── components/
│       │   ├── kanban/
│       │   │   ├── KanbanBoard.tsx      # Orchestrator drag-and-drop
│       │   │   ├── KanbanColumn.tsx     # Satu kolom status
│       │   │   ├── JobCard.tsx          # Card lowongan di board
│       │   │   ├── JobDetailSheet.tsx   # Slide-out panel detail lowongan
│       │   │   ├── JobMatchPanel.tsx    # Panel skor AI + skill gaps
│       │   │   └── MatchBadge.tsx       # Badge % / spinner / retry
│       │   └── dashboard/
│       │       ├── CvSummaryCard.tsx        # Tampilan CV aktif
│       │       └── MatchThresholdCard.tsx   # Filter skor minimum
│       │
│       ├── context/
│       │   └── AuthContext.tsx   # Global user session
│       │
│       ├── hooks/
│       │   └── useMatch.ts       # Polling skor match setiap 5 detik
│       │
│       ├── lib/
│       │   └── api.ts            # HTTP client + auto token refresh
│       │
│       └── types/
│           ├── job.ts            # TypeScript interface: Job, JobStatus
│           └── match.ts          # TypeScript interface: Match, SkillGap
│
├── extension/job-linker/
│   └── src/
│       ├── popup.tsx             # Extension popup entry
│       ├── background.ts         # Service worker
│       ├── contents/             # Content scripts (per platform)
│       │   ├── linkedin-scraper.ts
│       │   ├── seek-scraper.ts
│       │   └── glints-scraper.ts
│       ├── components/
│       │   ├── LoginForm.tsx
│       │   ├── Dashboard.tsx     # Extension popup UI
│       │   ├── CurrentJob.tsx    # Job yang terdeteksi di halaman saat ini
│       │   └── SavedJobs.tsx     # Daftar job yang sudah disimpan
│       └── lib/
│           ├── scraper.ts        # Orchestrator scraping (platform detection)
│           └── api.ts            # HTTP client untuk extension
│
├── nginx/                        # Nginx config untuk production
├── docker-compose.yml            # Redis + Weaviate containers
├── README.md
├── UPDATES.md                    # Catatan fitur post-MVP
└── RevisionPlan.md               # Rencana implementasi LLM re-ranking
```

---

## 6. Database & Schema

### Tabel Utama

#### `users`
```sql
id            UUID PRIMARY KEY
email         VARCHAR UNIQUE NOT NULL
password_hash VARCHAR NOT NULL
full_name     VARCHAR
role          VARCHAR DEFAULT 'user'
created_at    TIMESTAMP
updated_at    TIMESTAMP
```

#### `jobs`
```sql
id                  UUID PRIMARY KEY
user_id             UUID REFERENCES users(id)
platform            VARCHAR         -- 'linkedin' | 'seek' | 'glints'
external_id         VARCHAR         -- ID di platform aslinya
title               VARCHAR
company             VARCHAR
location            VARCHAR
description         TEXT            -- Full job description
description_source  VARCHAR         -- 'extension' | 'server'
url                 VARCHAR
status              VARCHAR DEFAULT 'saved'  -- saved, applied, interview, offered, rejected
weaviate_id         VARCHAR         -- ID vector di Weaviate
embedding_status    VARCHAR         -- 'pending' | 'done' | 'failed'
sections            JSONB           -- Section embeddings (skills, responsibilities, experience)
created_at          TIMESTAMP
updated_at          TIMESTAMP

-- Unique: (user_id, platform, external_id) — cegah duplikat
```

#### `cvs`
```sql
id                UUID PRIMARY KEY
user_id           UUID REFERENCES users(id)
filename          VARCHAR
parsed_text       TEXT            -- Teks hasil parse PDF/DOCX
file_bytes        BYTEA           -- File asli untuk download/preview
weaviate_id       VARCHAR
is_active         BOOLEAN DEFAULT false
embedding_status  VARCHAR         -- 'pending' | 'done' | 'failed'
sections          JSONB           -- Section embeddings CV
uploaded_at       TIMESTAMP

-- Unique partial index: hanya satu CV aktif per user
```

#### `job_matches`
```sql
id               UUID PRIMARY KEY
job_id           UUID REFERENCES jobs(id)
cv_id            UUID REFERENCES cvs(id)
-- Skor-skor
score            FLOAT           -- Final score (0–100)
doc_score        FLOAT           -- Cosine similarity dokumen penuh
section_score    FLOAT           -- Section-level weighted cosine
llm_score        FLOAT           -- Skor setelah LLM re-ranking
-- Skills
required_skills  JSONB           -- Semua skill yang dibutuhkan JD
matched_skills   JSONB           -- Skill yang cocok dengan CV
missing_skills   JSONB           -- Skill yang belum ada di CV
-- LLM Output
summary          TEXT            -- Ringkasan singkat
llm_reasoning    TEXT            -- Penjelasan 2-3 kalimat dari LLM
llm_strengths    JSONB           -- Array kelebihan (maks 3)
llm_concerns     JSONB           -- Array kekurangan (maks 3)
llm_status       VARCHAR         -- 'pending' | 'done' | 'failed'
status           VARCHAR         -- 'pending' | 'done' | 'failed'
created_at       TIMESTAMP
updated_at       TIMESTAMP

-- Unique: (job_id, cv_id) — satu match record per pasangan
```

### Struktur JSONB `sections`
```json
{
  "skills": [
    { "text": "Kubernetes", "vector": [/* 1536 floats */] },
    { "text": "React", "vector": [/* 1536 floats */] }
  ],
  "responsibilities": [
    { "text": "Memimpin tim pengembangan produk", "vector": [/* ... */] }
  ],
  "experience": [
    { "text": "3 tahun pengalaman di bidang software engineering", "vector": [/* ... */] }
  ]
}
```

### Daftar Migrations (Urutan)
| File | Perubahan |
|---|---|
| 001 | Buat tabel `users` |
| 002 | Buat tabel `jobs` |
| 003 | Buat tabel `cvs` |
| 004 | Buat tabel `job_matches` |
| 005 | Tambah kolom `weaviate_id` ke `jobs` |
| 006 | Tambah kolom `embedding_status` ke `jobs` |
| 007 | Tambah kolom `description_source` ke `jobs` |
| 008 | Tambah kolom `sections` (JSONB) ke `cvs` & `jobs`; pisahkan `doc_score` dan `section_score` |
| 009 | Tambah semua kolom LLM: `llm_score`, `llm_reasoning`, `llm_strengths`, `llm_concerns`, `llm_status` |
| 010 | Tambah `file_bytes` ke `cvs` untuk simpan file asli |

---

## 7. Alur Kerja Sistem (End-to-End)

### Alur 1: User Simpan Lowongan (via Extension)

```
User browsing LinkedIn/SEEK/Glints
  │
  ▼
Extension mendeteksi halaman lowongan
  │ Content script scraping job data
  ▼
User klik "Save to Tracker" di popup extension
  │
  ▼
POST /api/jobs ──► Backend cek duplikat (platform + external_id + user_id)
  │
  ├─► Deskripsi cukup panjang?
  │       YA ──► enqueue embedJob
  │       TIDAK ──► enqueue enrichJob (fetch deskripsi dari platform)
  │
  ├─► enrichJob
  │     ├─► LinkedIn: call jobs-guest API
  │     ├─► SEEK: parse __NEXT_DATA__ JSON
  │     └─► Glints: extract JSON-LD JobPosting
  │     Update jobs.description, lalu enqueue embedJob
  │
  └─► embedJob
        ├─► Gabung teks (title + company + location + description)
        ├─► OpenAI embed seluruh teks → simpan ke Weaviate
        ├─► GPT-4o-mini extract sections (skills, responsibilities, experience)
        ├─► Batch embed tiap item section (dengan prefix: "Skill: X")
        ├─► Simpan sections JSONB ke DB
        └─► CV user sudah siap? ──► enqueue matchJob
```

### Alur 2: User Upload CV

```
User upload file PDF/DOCX di dashboard
  │
  ▼
POST /api/cv (multipart form)
  │
  ├─► cv.parser.js: extract teks dari PDF (pdf-parse) atau DOCX (mammoth)
  ├─► Simpan ke tabel cvs (status: 'pending')
  └─► enqueue embedCv
        │
        ├─► OpenAI embed seluruh teks CV → simpan ke Weaviate
        ├─► GPT-4o-mini extract sections CV
        ├─► Batch embed tiap item section
        ├─► Simpan sections JSONB ke DB
        ├─► Mark embedding_status = 'done'
        └─► Fan-out: untuk setiap job user yang sudah done
              └─► enqueue matchJob (supaya semua job punya skor baru)

Frontend polling /api/cv setiap 3 detik
  └─► Saat status = 'done', redirect ke dashboard
```

### Alur 3: Proses Matching

```
matchJob worker dipanggil
  │
  ├─► Ambil vector CV (doc) dari Weaviate
  ├─► Ambil sections CV dari DB
  ├─► Ambil vector Job (doc) dari Weaviate
  ├─► Ambil sections Job dari DB
  │
  ├─► Hitung doc_score  (cosine similarity CV doc vs Job doc)
  ├─► Hitung section_score
  │     ├─► Skill score:
  │     │     pairwise cosine(job skills, cv skills) → ambil top-5 → rata-rata
  │     └─► Responsibility score:
  │           pairwise cosine(job resp, cv resp) → ambil top-3 → rata-rata
  │     section_score = 0.6 × skill_score + 0.4 × resp_score
  │
  ├─► Tentukan matched_skills & missing_skills
  │     Threshold cosine >= 0.55 → matched, < 0.55 → missing
  │
  ├─► LLM Re-ranking (gpt-4o-mini)
  │     Input: teks CV sections, teks JD sections, scores, skills, job title
  │     Output: llm_score (±15 dari section_score), llm_reasoning,
  │             llm_strengths, llm_concerns
  │     (Jika LLM gagal → fallback ke section_score, status = 'failed')
  │
  └─► Simpan hasil ke job_matches
        score = llm_score (atau section_score jika LLM gagal)
```

### Alur 4: User Melihat Skor di Dashboard

```
Dashboard load → fetch GET /api/jobs
  └─► Query PostgreSQL dengan LATERAL JOIN ke job_matches terbaru
        └─► Tiap job sudah include: match_score, match_status

JobCard render MatchBadge:
  ├─► status = 'pending' → tampilkan spinner
  ├─► status = 'done'    → tampilkan "73%" dengan warna
  ├─► status = 'failed'  → tampilkan tombol retry
  └─► Tidak ada CV       → tampilkan link upload CV

useMatch hook polling setiap 5 detik
  └─► Stop polling saat semua job sudah 'done'

User klik JobCard → JobDetailSheet slide-out
  └─► JobMatchPanel: skor, reasoning, strengths, concerns, chip skill
```

---

## 8. Pipeline AI & Algoritma Matching

### Model yang Digunakan

| Model | Kegunaan | Dimensi |
|---|---|---|
| `text-embedding-3-small` | Membuat vector dari teks CV dan JD | 1536 dimensi |
| `gpt-4o-mini` | (1) Extract sections dari CV/JD, (2) Re-ranking skor | - |

### Konsep Embedding

Embedding mengubah teks menjadi vector angka (1536 angka) sehingga teks yang maknanya mirip akan menghasilkan vector yang "dekat" satu sama lain. Kedekatan diukur dengan **cosine similarity** (nilai 0–1, semakin dekat ke 1 semakin mirip).

### Type-Prefixed Embeddings

Section items di-embed dengan prefix untuk meningkatkan presisi semantik pada frasa pendek:

```
"Skill: Kubernetes"
"Skill: React"
"Responsibility: Memimpin tim pengembangan produk"
"Experience: 3 tahun pengalaman software engineering"
```

Kenapa perlu prefix? Tanpa konteks, kata "Python" bisa berarti bahasa pemrograman atau ular. Dengan prefix "Skill: Python", embedding lebih akurat menangkap makna yang dimaksud.

### Algoritma Section-Level Scoring

```
Untuk setiap job skill (dari JD):
  Hitung cosine similarity dengan SETIAP CV skill
  Ambil nilai tertinggi (pairwise max)
  → Ini disebut "best match" untuk skill tersebut

Ambil TOP-5 best match → rata-rata = skill_score
Ambil TOP-3 best match dari responsibilities → avg = resp_score

section_score = 0.6 × skill_score + 0.4 × resp_score
```

**Kenapa top-K pooling?**

Misalkan JD punya 12 skill, CV kamu cover 6 dengan sangat baik tapi 6 lainnya tidak. Jika pakai rata-rata semua → 6 skill yang 0 akan menarik skor ke bawah secara tidak adil. Dengan top-K, kamu "dihargai" atas skill yang kamu kuasai tanpa terlalu dihukum atas skill yang memang tidak relevan.

### LLM Re-Ranking

Setelah cosine scoring, `gpt-4o-mini` dipanggil untuk memberikan "second opinion":

- **Input:** Teks CV sections + teks JD sections + skor cosine + skill gaps + job title
- **Constraint:** Skor akhir hanya boleh bergerak **±15 poin** dari `section_score`
- **Output:**
  - `llm_score` — skor final (0–100)
  - `llm_reasoning` — penjelasan 2–3 kalimat
  - `llm_strengths` — array kelebihan kandidat (maks 3)
  - `llm_concerns` — array hal yang perlu diperhatikan (maks 3)
- **Failsafe:** Jika LLM error → pakai `section_score` sebagai fallback, `llm_status = 'failed'`

### Skill Gap Detection

```
Untuk setiap skill di JD:
  Jika best cosine >= 0.55 → masuk matched_skills
  Jika best cosine <  0.55 → masuk missing_skills
```

Threshold 0.55 dipilih sebagai titik tengah antara "sangat mirip" (≥0.8) dan "tidak berkaitan" (≤0.3).

---

## 9. API Endpoints

**Base URL:** `http://localhost:3000/api`

### Public (tanpa auth)

| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/register` | Buat akun baru |
| POST | `/auth/login` | Login → dapat access token + refresh token |
| POST | `/auth/refresh` | Perbarui access token yang expired |
| GET  | `/auth/verify` | Cek validitas token, kembalikan data user |

### Protected (Bearer Token)

#### Users
| Method | Path | Fungsi |
|---|---|---|
| GET | `/users/me` | Ambil profil user saat ini |
| PUT | `/users/me` | Update profil |

#### Jobs
| Method | Path | Fungsi |
|---|---|---|
| GET    | `/jobs` | List semua lowongan user (ada LATERAL JOIN ke skor terbaru) |
| GET    | `/jobs/:id` | Detail satu lowongan + skor |
| POST   | `/jobs` | Simpan satu lowongan (dari extension) |
| POST   | `/jobs/bulk` | Simpan banyak lowongan sekaligus |
| PATCH  | `/jobs/:id/status` | Update status Kanban (saved → applied → interview → offered → rejected) |
| DELETE | `/jobs/:id` | Hapus lowongan |

#### CV
| Method | Path | Fungsi |
|---|---|---|
| GET    | `/cv` | Info CV aktif (tanpa file bytes) |
| POST   | `/cv` | Upload CV baru (multipart form-data, PDF/DOCX) |
| GET    | `/cv/:id/file` | Download file CV asli |
| DELETE | `/cv/:id` | Hapus CV |

#### Matching
| Method | Path | Fungsi |
|---|---|---|
| GET  | `/jobs/:id/match` | Ambil hasil match terbaru untuk satu job |
| POST | `/jobs/:id/match/recompute` | Trigger ulang seluruh pipeline matching |

### Contoh Response Job dengan Match Score

```json
{
  "id": "uuid",
  "title": "Senior Frontend Engineer",
  "company": "Tokopedia",
  "platform": "linkedin",
  "status": "saved",
  "match_score": 78.5,
  "match_status": "done",
  "doc_score": 0.71,
  "section_score": 0.76,
  "llm_score": 78.5
}
```

---

## 10. Komponen Frontend

### Halaman Utama (Dashboard.tsx)

Halaman utama menampilkan:
1. **CV Summary Card** — CV yang sedang aktif, tombol ganti CV
2. **Match Threshold Filter** — Filter preset: Semua / ≥50% / ≥70% / ≥90%
3. **Kanban Board** — Kolom-kolom berdasarkan status lamaran

### Status Kanban

```
Saved → Applied → Interview → Offered → Rejected
```

User bisa drag-and-drop kartu antar kolom, yang otomatis update status di backend.

### MatchBadge (komponen kunci)

Badge kecil di sudut setiap job card:
- 🔄 **Spinner** → Matching sedang diproses
- **73%** (hijau/kuning/merah) → Skor sudah ada
- ⚠️ **Retry** → Pipeline gagal, bisa trigger ulang
- 📎 **Upload CV** → User belum punya CV aktif

### JobDetailSheet

Panel slide-out dari kanan saat user klik job card, berisi:
- Info lengkap lowongan (title, company, location, deskripsi)
- **JobMatchPanel**: skor, reasoning LLM, strengths & concerns, chip skill matched/missing
- Tombol "Recompute" untuk trigger ulang matching
- Link ke lowongan asli

### Token Refresh Otomatis (lib/api.ts)

HTTP client di frontend otomatis:
1. Kirim request dengan access token
2. Jika dapat response 401 → otomatis call `/auth/refresh`
3. Retry request asal dengan token baru
4. Jika refresh juga gagal → logout user

---

## 11. Browser Extension

### Platform yang Didukung

| Platform | Scraper File | Metode Scraping |
|---|---|---|
| LinkedIn | `linkedin-scraper.ts` | CSS selector: `[componentkey^="job-card-component-ref-"]` |
| SEEK | `seek-scraper.ts` | Parse struktur HTML job cards SEEK |
| Glints | `glints-scraper.ts` | Extract JSON-LD JobPosting dari HTML |

### Alur Extension

```
User buka halaman lowongan
  │
  ▼
Content script aktif (per platform)
  └─► Scrape: title, company, location, description, url, external_id
        │
        ▼
User klik icon extension → popup.tsx
  │
  ├─► Belum login? → Tampilkan LoginForm
  └─► Sudah login? → Tampilkan Dashboard extension
        ├─► CurrentJob: job yang terdeteksi di halaman
        ├─► Tombol "Save to Tracker"
        └─► SavedJobs: daftar job yang sudah pernah disimpan

Klik "Save" → api.ts POST /api/jobs
  └─► Toast success/error
```

### Build Extension

Extension dibangun dengan **Plasmo Framework** yang support:
- Firefox MV3
- Chrome MV3

---

## 12. Queue & Background Workers

### Empat Queue BullMQ

| Queue | Trigger | Fungsi |
|---|---|---|
| `enrich-job` | Job tersimpan dengan deskripsi pendek | Fetch deskripsi penuh dari platform |
| `embed-job` | Setelah enrich atau job tersimpan dengan deskripsi | Embed ke Weaviate + extract sections |
| `embed-cv` | CV diupload | Embed ke Weaviate + extract sections |
| `match-job` | Setelah embed-job (jika CV siap) atau embed-cv (fan-out) | Hitung skor kecocokan |

### Worker Process

Worker dijalankan sebagai **proses terpisah** dari API server:
```bash
# Terminal 1: API server
npm run dev

# Terminal 2: Worker (proses background jobs)
npm run worker
```

### Self-Healing: Recompute

Endpoint `POST /jobs/:id/match/recompute` menerapkan **walk-back logic**:

```
Cek apakah job sudah punya weaviate_id?
  TIDAK → enqueue embedJob (akan otomatis lanjut ke matchJob)
  YA → Cek apakah CV sudah punya weaviate_id?
    TIDAK → enqueue embedCv
    YA → langsung enqueue matchJob
```

Ini memastikan jika ada step yang gagal sebelumnya, sistem bisa recover dari titik yang paling efisien.

---

## 13. Cara Menjalankan Proyek

### Prerequisites

- Node.js >= 18
- PostgreSQL (lokal atau Docker)
- Docker Desktop (untuk Redis + Weaviate)
- OpenAI API Key
- pnpm (untuk extension)

### 1. Setup Awal (sekali saja)

```bash
# Buat database PostgreSQL
createdb skripsi

# Install dependencies backend
cd backend
npm install

# Buat file .env.dev (lihat contoh di bawah)
# Jalankan migrations
node src/database/migrate.js

# Install dependencies frontend
cd ../frontend
npm install

# Install dependencies extension
cd ../extension/job-linker
pnpm install
```

### Contoh `.env.dev` (Backend)

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://localhost:5432/skripsi

JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

OPENAI_API_KEY=sk-...

REDIS_URL=redis://localhost:6379

WEAVIATE_HOST=localhost:8080
WEAVIATE_SCHEME=http
```

### 2. Jalankan Docker Containers (Redis + Weaviate)

```bash
# Di root folder project
docker-compose up -d

# Verifikasi berjalan
docker ps
# Harusnya ada: redis (port 6379) + weaviate (port 8080)
```

### 3. Jalankan Tiga Proses (3 Terminal)

```bash
# Terminal 1 — Backend API
cd backend
npm run dev
# Running on http://localhost:3000

# Terminal 2 — BullMQ Worker
cd backend
npm run worker
# Worker listening on queues...

# Terminal 3 — Frontend
cd frontend
npm run dev
# Running on http://localhost:5173
```

### 4. Load Extension di Firefox

```bash
cd extension/job-linker
pnpm dev
# Build ke: build/firefox-mv3-dev/
```

Di Firefox:
1. Buka `about:debugging#/runtime/this-firefox`
2. Klik "Load Temporary Add-on..."
3. Pilih file `build/firefox-mv3-dev/manifest.json`

### 5. Test Flow Lengkap

1. Buka `http://localhost:5173`
2. Klik **Register** → buat akun baru
3. Login
4. Klik **Upload CV** di dashboard → upload file PDF/DOCX
5. Tunggu badge CV berubah dari "Processing..." ke nama file (± 30 detik)
6. Buka tab baru, pergi ke LinkedIn/SEEK/Glints, buka halaman lowongan
7. Klik icon extension → klik **Save to Tracker**
8. Kembali ke dashboard → job card muncul dengan spinner
9. Tunggu ± 30–60 detik → spinner berubah jadi persentase (misal "78%")
10. Klik job card → lihat detail skor, reasoning LLM, dan skill gaps
11. Drag kartu ke kolom **Applied** saat sudah melamar

---

## 14. Kontribusi Penelitian (Thesis)

### Pertanyaan Penelitian

Apakah pendekatan **hybrid matching** (cosine similarity + LLM re-ranking) menghasilkan skor yang lebih relevan dibanding baseline document-level cosine similarity?

### Metode yang Dibandingkan

| Metode | Cara Kerja | Field di DB |
|---|---|---|
| **Baseline** | Cosine similarity seluruh dokumen CV vs JD | `doc_score` |
| **Section-Level** | Cosine similarity per section dengan top-K pooling | `section_score` |
| **Hybrid (Final)** | Section-level + LLM re-ranking | `llm_score` / `score` |

### Inovasi Kunci

1. **Type-prefixed section embeddings** — Menambah prefix ("Skill: X", "Responsibility: X") pada embedding frasa pendek untuk meningkatkan presisi semantik

2. **Top-K pooling** — Alih-alih rata-rata semua pasangan, ambil K nilai terbaik. Kandidat yang punya beberapa skill sangat kuat lebih diapresiasi meski ada gap di beberapa skill lain

3. **Constrained LLM re-ranking** — LLM hanya bisa menggeser skor ±15 poin dari section_score, sehingga intuisi manusia LLM memperkaya tapi tidak mendominasi sinyal matematis

4. **Semua skor tersimpan side-by-side** — `doc_score`, `section_score`, `llm_score` semua ada di database untuk perbandingan evaluasi

### Referensi File Relevan untuk Sidang

| File | Relevansi Penelitian |
|---|---|
| `backend/src/queues/processors/matchJob.js` | Implementasi utama algoritma matching |
| `backend/src/lib/sections.js` | Section extraction + type-prefixed batch embedding |
| `backend/src/lib/rerank.js` | Prompt engineering untuk LLM re-ranking |
| `RevisionPlan.md` | Rencana dan justifikasi penambahan LLM re-ranking |
| `UPDATES.md` | Catatan iterasi fitur dari MVP ke versi final |

---

## Catatan Tambahan

### Kenapa Redis diperlukan?

BullMQ menggunakan Redis sebagai message broker. Setiap "job" yang masuk queue disimpan di Redis, dan worker mengambilnya satu per satu. Ini memastikan proses AI yang berat (embedding + LLM) tidak memblokir HTTP response ke user.

### Kenapa Weaviate dan bukan PostgreSQL untuk vector?

PostgreSQL (dengan pgvector) bisa digunakan, tapi Weaviate menyediakan:
- Native ANN (Approximate Nearest Neighbor) search yang jauh lebih cepat untuk cosine similarity pada vector berdimensi tinggi (1536)
- Filtering yang lebih kaya
- Metadata storage terintegrasi

### Weaviate Schema

Weaviate menyimpan dua class:
- **`CvDocument`** — vector dan properties untuk CV
- **`JobDocument`** — vector dan properties untuk Job

Schema diinisialisasi otomatis saat server pertama kali start di `src/config/weaviate.js`.

---

*Dokumen ini di-generate dari eksplorasi kode sumber: Juli 2026*
