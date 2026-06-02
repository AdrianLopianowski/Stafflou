# StaffFlou — System Zarządzania Pracownikami (SaaS)

**Projekt zrealizowany w ramach pracy inżynierskiej.**

StaffFlou to nowoczesna aplikacja webowa typu SaaS (Software as a Service) służąca do kompleksowego zarządzania przestrzeniami roboczymi, zespołami, komunikacją oraz zadaniami wewnątrz firmy. Projekt łączy funkcje komunikatora zespołowego (inspirowane Discordem i Slackiem) z rozbudowanym modułem zarządzania zadaniami i przepływem ich weryfikacji.

---

## Wykorzystane Technologie

Projekt zbudowany jest w architekturze Full-Stack z podziałem na warstwę frontendową i backendową:

### Frontend

- **Angular 19** — framework SPA (Single Page Application) z nową składnią control flow (`@if`, `@for`)
- **Tailwind CSS 4** — stylowanie i responsywność (RWD) interfejsu
- **Firebase Authentication** — zewnętrzny dostawca uwierzytelniania (Identity Provider)

### Backend

- **NestJS 11** — modułowy framework Node.js (TypeScript)
- **PostgreSQL 16** — relacyjna baza danych
- **Prisma 6** — ORM (Object-Relational Mapping) i zarządzanie schematem bazy
- **Firebase Admin SDK** — weryfikacja tokenów JWT po stronie serwera
- **Multer** — obsługa przesyłania plików (do 50 MB)
- **Docker / Docker Compose** — konteneryzacja bazy danych

---

## ✨ Zrealizowane Funkcjonalności

### 🔒 Uwierzytelnianie i kontrola dostępu

- Rejestracja i logowanie przez **Firebase Authentication** (e-mail + hasło, Google OAuth).
- Weryfikacja tokenów JWT po stronie backendu (`FirebaseAuthGuard`).
- Ochrona ścieżek frontendu (`AuthGuard`, `GuestGuard`).
- Onboarding nowego użytkownika (uzupełnienie profilu przy pierwszym logowaniu).

### 🏢 Przestrzenie robocze i zespoły

- Tworzenie wielu **przestrzeni roboczych** (workspace) i przełączanie się między nimi.
- System ról: **OWNER**, **ADMIN**, **MEMBER** z odpowiednimi uprawnieniami.
- Niestandardowe **etykiety ról** (np. „Kierownik projektu") z własnym kolorem.
- Zapraszanie członków przez e-mail oraz zarządzanie zespołem.
- Statystyki zadań per członek (przypisane, w toku, ukończone).

### 💬 Komunikacja

- **Kanały** tekstowe (TEXT) i informacyjne (INFO — zapis tylko dla ADMIN/OWNER).
- **Grupowanie kanałów w kategorie** ze zwijanymi sekcjami w sidebarze.
- Wiadomości z obsługą **plików** (obrazy, wideo, dokumenty), edycją i usuwaniem.
- **Wzmianki** (`@imię`) odporne na zmianę nazwy użytkownika (przechowywane jako ID).
- **Reakcje emoji**, **przypinanie wiadomości** i **ankiety** (jedno- i wielokrotnego wyboru).
- **Wiadomości prywatne (DM)** 1:1 z licznikiem nieprzeczytanych i auto-scroll.

### ✅ Zarządzanie zadaniami (Kanban)

- Tablica **Kanban** z czterema kolumnami: _Do zrobienia → W toku → Do weryfikacji → Ukończone_.
- Dwa tryby realizacji: **indywidualny** (śledzenie postępu każdej osoby osobno) i **grupowy**.
- Priorytety (LOW / MEDIUM / HIGH / URGENT), terminy z wizualnym ostrzeganiem o deadline.
- Przypisywanie zadań do wielu osób lub całych ról.
- **Przesyłanie wyników** (tekst i/lub pliki) przez wykonawców.
- **Przepływ weryfikacji**: zlecający przegląda przesłane wyniki i może je **zaakceptować** lub **zwrócić z komentarzem** do poprawy — indywidualnie dla każdego wykonawcy.

### 🔔 Powiadomienia

- Powiadomienia o zadaniach (przypisanie, przesłanie, akceptacja, zwrot z komentarzem).
- Powiadomienia o usunięciu wiadomości przez administratora.
- Zaproszenia do przestrzeni roboczych.

---

## 📁 Struktura projektu

```
HR-management-system-app/
├── frontend/                       # Aplikacja Angular 19
│   └── src/app/
│       ├── pages/dashboard/        # Główny panel (kanały, zadania, DM, zespół)
│       └── services/               # Komunikacja z API (WorkspaceService)
├── backend/                        # API NestJS 11
│   ├── src/
│   │   ├── workspaces/             # Główny moduł (kanały, zadania, DM, role)
│   │   ├── auth/                   # FirebaseAuthGuard
│   │   └── prisma/                 # PrismaService
│   ├── prisma/schema.prisma        # Schemat bazy danych
│   └── uploads/                    # Przesłane pliki
├── docker-compose.yml              # Kontener PostgreSQL
├── ERD_Model_Implementacyjny.html  # Dokumentacja: ERD, diagram klas, sekwencji, analiza
├── Projekt.docx                    # Dokumentacja projektowa
└── diagrams/                       # Wyeksportowane diagramy (PNG)
```

---

## Uruchomienie projektu (Środowisko deweloperskie)

### Wymagania wstępne

- Node.js (wersja 20+)
- Angular CLI (`npm install -g @angular/cli`)
- Docker i Docker Compose (dla bazy danych)

### 1. Baza danych (PostgreSQL przez Docker)

W katalogu głównym uruchom kontener bazy danych:

```bash
docker compose up -d
```

> Baza nasłuchuje na porcie **5435** (mapowanie `5435:5432`). Dane logowania definiowane są w pliku `backend/.env`.

### 2. Backend (NestJS)

```bash
cd backend
npm install
npx prisma db push        # synchronizacja schematu z bazą
npm run start:dev         # serwer dev na http://localhost:3000
```

### 3. Frontend (Angular)

```bash
cd frontend
npm install
ng serve                  # aplikacja na http://localhost:4200
```

---

## Dokumentacja

- **`ERD_Model_Implementacyjny.html`** — pełna dokumentacja techniczna otwierana w przeglądarce:
  - Diagram związków encji (ERD)
  - Model implementacyjny (tabele PostgreSQL, kolumny, indeksy)
  - Diagram klas (UML)
  - Diagramy sekwencji (interakcji)
  - Analiza obiektowa i katalog funkcji systemu
  - Słowniki terminów (dziedzinowych i informatycznych)
- **`Projekt.docx`** — dokumentacja projektowa zgodna z wymaganiami pracy inżynierskiej.
- **`diagrams/`** — diagramy wyeksportowane do plików PNG.
