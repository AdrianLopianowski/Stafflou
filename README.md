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

## Zrealizowane Funkcjonalności

### Uwierzytelnianie i kontrola dostępu

- Rejestracja i logowanie przez **Firebase Authentication** (e-mail + hasło, Google OAuth).
- Weryfikacja tokenów JWT po stronie backendu (`FirebaseAuthGuard`).
- Ochrona ścieżek frontendu (`AuthGuard`, `GuestGuard`).
- Onboarding nowego użytkownika (uzupełnienie profilu przy pierwszym logowaniu).

### Przestrzenie robocze i zespoły

- Tworzenie wielu **przestrzeni roboczych** (workspace) i przełączanie się między nimi.
- System ról: **OWNER**, **ADMIN**, **MEMBER** z odpowiednimi uprawnieniami.
- Niestandardowe **etykiety ról** (np. „Kierownik projektu") z własnym kolorem.
- Zapraszanie członków przez e-mail oraz zarządzanie zespołem.
- Statystyki zadań per członek (przypisane, w toku, ukończone).

### Komunikacja

- **Kanały** tekstowe (TEXT) i informacyjne (INFO — zapis tylko dla ADMIN/OWNER).
- **Grupowanie kanałów w kategorie** ze zwijanymi sekcjami w sidebarze.
- Wiadomości z obsługą **plików** (obrazy, wideo, dokumenty), edycją i usuwaniem.
- **Wzmianki** (`@imię`) odporne na zmianę nazwy użytkownika (przechowywane jako ID).
- **Reakcje emoji**, **przypinanie wiadomości** i **ankiety** (jedno- i wielokrotnego wyboru).
- **Wiadomości prywatne (DM)** 1:1 z licznikiem nieprzeczytanych i auto-scroll.

### Zarządzanie zadaniami (Kanban)

- Tablica **Kanban** z czterema kolumnami: _Do zrobienia → W toku → Do weryfikacji → Ukończone_.
- Dwa tryby realizacji: **indywidualny** (śledzenie postępu każdej osoby osobno) i **grupowy**.
- Priorytety (LOW / MEDIUM / HIGH / URGENT), terminy z wizualnym ostrzeganiem o deadline.
- Przypisywanie zadań do wielu osób lub całych ról.
- **Przesyłanie wyników** (tekst i/lub pliki) przez wykonawców.
- **Przepływ weryfikacji**: zlecający przegląda przesłane wyniki i może je **zaakceptować** lub **zwrócić z komentarzem** do poprawy — indywidualnie dla każdego wykonawcy.

### Powiadomienia

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

> **Czytasz to po otrzymaniu projektu w paczce ZIP?** Przejdź najpierw do sekcji
> [Pełny poradnik uruchomienia od zera](#-pełny-poradnik-uruchomienia-od-zera).

### Wymagania wstępne

- **Node.js** (wersja 20+) — [nodejs.org](https://nodejs.org)
- **Angular CLI** — `npm install -g @angular/cli`
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop) (dla bazy danych)

### Szybki start

```bash
# 1. Baza danych (z katalogu głównego)
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma db push
npm run start:dev          # API na http://localhost:3000

# 3. Frontend (w nowym terminalu)
cd frontend
npm install
ng serve                   # aplikacja na http://localhost:4200
```

> Baza nasłuchuje na porcie **5435** (mapowanie `5435:5432`). Dane logowania definiowane są w pliku `backend/.env`.

---

## 📦 Pełny poradnik uruchomienia od zera

Instrukcja dla osoby, która uruchamia go po raz pierwszy.

### Krok 1 — Zainstaluj wymagane programy

| Program            | Do czego                            | Skąd pobrać                                                  |
| ------------------ | ----------------------------------- | ------------------------------------------------------------ |
| **Node.js 20+**    | uruchomienie frontendu i backendu   | [nodejs.org](https://nodejs.org)                             |
| **Docker Desktop** | baza danych PostgreSQL w kontenerze | [docker.com](https://www.docker.com/products/docker-desktop) |

> **Docker Desktop musi być uruchomiony** zanim wykonasz kolejne kroki.
> Angular CLI nie jest wymagane globalnie — w instrukcji używamy `npx`.

### Krok 2 — Sprawdź pliki konfiguracyjne

Projekt wymaga dwóch plików z konfiguracją. **W tej paczce powinny już się znajdować** —
sprawdź, czy istnieją:

- `backend/.env` — dane połączenia z bazą i klucze Firebase (po stronie serwera)
- `frontend/src/environments/environment.ts` — konfiguracja Firebase (po stronie przeglądarki)

### Krok 3 — Uruchom bazę danych

W katalogu głównym projektu (tam gdzie jest `docker-compose.yml`):

```bash
docker compose up -d
```

Spowoduje to pobranie i uruchomienie PostgreSQL w kontenerze na porcie **5435**.
Sprawdź, czy działa: `docker ps` — powinien być widoczny kontener `stafflou_db`.

### Krok 4 — Uruchom backend

```bash
cd backend
npm install                # instalacja zależności (kilka minut)
npx prisma db push         # utworzenie tabel w bazie
npm run start:dev          # uruchomienie serwera API
```

Backend działa, gdy w konsoli pojawi się komunikat nasłuchiwania na **http://localhost:3000**.
Zostaw ten terminal otwarty.

### Krok 5 — Uruchom frontend

Otwórz **nowy terminal** (backend musi działać równolegle):

```bash
cd frontend
npm install                # instalacja zależności (kilka minut)
npx ng serve               # uruchomienie aplikacji
```

### Krok 6 — Otwórz aplikację

Wejdź w przeglądarce na **http://localhost:4200**, zarejestruj nowe konto
i utwórz swoją pierwszą przestrzeń roboczą.

> **Baza startuje pusta** — po rejestracji konta wszystko tworzysz od zera
> (przestrzenie, kanały, zadania).

---

## Najczęstsze problemy

| Problem                                | Przyczyna i rozwiązanie                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docker: command not found`            | Docker Desktop nie jest zainstalowany lub nie został uruchomiony.                                |
| Backend: `Can't reach database server` | Kontener bazy nie działa — uruchom `docker compose up -d` i poczekaj kilka sekund.               |
| Port `5435` / `3000` / `4200` zajęty   | Inny program używa portu. Zatrzymaj go lub zmień port (np. `ng serve --port 4300`).              |
| Logowanie nie działa / błąd Firebase   | Brakuje lub błędny `environment.ts`, albo projekt Firebase nie zezwala na daną metodę logowania. |
| `prisma db push` zgłasza błąd          | Baza nie wystartowała jeszcze w pełni — odczekaj chwilę i powtórz.                               |
| Frontend nie łączy się z API           | Backend nie działa lub działa na innym porcie niż `http://localhost:3000`.                       |

---

## Dokumentacja

- **`ERD_Model_Implementacyjny.html`** — pełna dokumentacja techniczna otwierana w przeglądarce:
  - Diagram związków encji (ERD)
  - Model implementacyjny (tabele PostgreSQL, kolumny, indeksy)
  - Diagram klas (UML)
  - Diagramy sekwencji (interakcji)
  - Analiza obiektowa i katalog funkcji systemu
  - Słowniki terminów (dziedzinowych i informatycznych)
