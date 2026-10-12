# PocketSmart AI

PocketSmart AI is a beginner-friendly personal finance tracker built with React, Vite, FastAPI, and SQLite. It includes private accounts, income and expense tracking, monthly and category budgets, charts, data-backed budgeting suggestions, and an optional AI chat integration.

> PocketSmart provides general budgeting and spending guidance, not investment advice, and does not promise financial returns.

## Project structure

```text
pocketsmart-ai/
├── backend/
│   ├── .env.example       # Backend configuration template
│   ├── main.py            # FastAPI API, models, authentication, insights
│   ├── requirements.txt   # Python dependencies
│   └── test_api.py        # API, validation, and account-isolation tests
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js     # Production chunk splitting
│   └── src/
│       ├── api.js         # API client
│       ├── App.jsx        # App pages and reusable UI
│       ├── main.jsx       # React entry point
│       └── styles.css     # Responsive application styles
└── README.md
```

## Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer and npm

## Run locally

Open two terminals from the project root.

### 1. Start the backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `backend/.env` and replace `SECRET_KEY` with a long, unique random value. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. The API refuses to start with the example placeholder or a missing/short secret. The SQLite database is created automatically at `backend/pocketsmart.db` the first time the API starts.

```powershell
python -m uvicorn main:app --reload
```

The API runs at <http://localhost:8000>. Interactive API documentation is at <http://localhost:8000/docs>.

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally <http://localhost:5173>).

## Demo account

The backend creates a demo account and sample transactions when it first starts:

- **Email:** `demo@pocketsmart.ai`
- **Password:** `demo12345`

The demo includes six months of income and expenses, a monthly budget, and category budgets. Use the sign-in page's demo helper to fill in the credentials. Demo data is only seeded when the demo user does not already exist.

## Environment variables

Configure these in `backend/.env`; never put server secrets in frontend files.

| Variable | Required | Description |
| --- | --- | --- |
| `SECRET_KEY` | Yes outside local development | Secret used to sign login tokens. Set a unique, long random value. |
| `DATABASE_URL` | No | SQLAlchemy connection URL. Defaults to `sqlite:///./pocketsmart.db`. |
| `FRONTEND_ORIGINS` | No | Comma-separated allowed frontend origins. Defaults to `http://localhost:5173`. |
| `OPENAI_API_KEY` | No | Optional key for AI-provider-backed chat. Keep it only in the backend environment. |
| `OPENAI_MODEL` | No | Chat model name; defaults to `gpt-4o-mini`. |

Without `OPENAI_API_KEY`, chat uses a local, deterministic assistant that answers from the signed-in user's transactions and budget. Personalized recommendations and alerts are calculated locally. When configured, chat sends financial summaries and up to 30 recent transactions to the AI provider. Review the provider's privacy policies before enabling this feature.

For a separate frontend/API host, set `VITE_API_URL` in `frontend/.env` to the backend base URL, such as `https://api.example.com`. Restart Vite after changing environment variables.

## API overview

All `/api` routes other than registration and login require an `Authorization: Bearer <token>` header. Responses are scoped to the authenticated account.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and return a token |
| `POST` | `/api/auth/login` | Sign in and return a token |
| `GET` | `/api/auth/me` | Current account profile |
| `GET`, `POST` | `/api/transactions` | List or add a transaction |
| `PUT`, `DELETE` | `/api/transactions/{id}` | Update or delete an owned transaction |
| `GET`, `PUT` | `/api/budget` | Read or update monthly and category budgets |
| `GET` | `/api/dashboard` | Monthly totals and current alerts |
| `GET` | `/api/analytics` | Six-month cash flow and expense categories |
| `GET` | `/api/recommendations` | Data-based personalized budgeting ideas |
| `POST` | `/api/chat` | Ask a data-grounded assistant question |
| `GET` | `/health` | Health check |

The SQLite schema is created on API startup. It has `users`, `transactions`, `budgets`, and `recommendations` tables. Transaction and budget endpoints always filter by the authenticated user ID; changing an ID in a request cannot access another account's records. Passwords are salted and hashed with scrypt, and API access uses signed, expiring bearer tokens.

## Features

- Landing/sign-in and registration flows; sign out and account settings
- Dashboard with monthly income, expenses, remaining balance, savings, budget progress, transactions, and alerts
- Add, edit, delete, search, filter, sort, and CSV-export income and expense transactions
- Monthly and category-level spending limits with budget warnings
- Responsive analytics and spending category charts
- Personalized, non-investment recommendations and a user-data-aware chat assistant
- Inline input validation, loading states, empty states, error feedback, and success notifications

## Test

Install the backend dependencies as above, then run:

```powershell
cd backend
python -m unittest -v test_api.py
```

The API tests cover account isolation, login, unauthenticated access, and invalid financial inputs. Tests use a temporary SQLite database.

Check the production frontend bundle with:

```powershell
cd frontend
npm install
npm run build
```

Manual smoke test: sign in with the demo account, add and edit a transaction, check the dashboard and analytics, set a category budget, ask the chat assistant a question, export transactions, and sign out.

## Deployment notes

1. Deploy the backend as an ASGI service (for example, `uvicorn main:app --host 0.0.0.0 --port $PORT`) and configure its environment variables in the hosting provider's secret manager.
2. Set a strong `SECRET_KEY`, configure the production frontend origin in `FRONTEND_ORIGINS`, and use durable storage. SQLite is suitable for local demos; use a managed database and an appropriate `DATABASE_URL` for a multi-instance production deployment.
3. Build the frontend with `npm run build` and serve `frontend/dist` using a static hosting provider. Set `VITE_API_URL` to the deployed API before building.
4. Configure HTTPS, backups, monitoring, and provider privacy settings before storing real financial data. Never use the demo credentials for a production deployment.

The application is a demonstration starter, not audited financial software. Before production use, add database migrations, rate limiting, account recovery and token revocation, operational logging/monitoring, and a documented data-retention policy.
