# Diversay Logistics Frontend

React + Vite + Tailwind CSS frontend for the Diversay Logistics Portal.

## Project Structure

```
frontend/
├── src/
│   ├── pages/              # Page components
│   │   ├── LoginPage.jsx
│   │   ├── SignupPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── OrdersPage.jsx
│   │   ├── OrderDetailPage.jsx
│   │   ├── CustomersPage.jsx
│   │   └── ProductsPage.jsx
│   ├── components/         # Reusable components
│   │   └── ProtectedRoute.jsx
│   ├── hooks/              # Custom React hooks
│   │   └── useAuth.js
│   ├── services/           # API calls
│   │   └── api.js
│   ├── context/            # React context
│   │   └── AuthContext.jsx
│   ├── styles/             # CSS
│   │   └── index.css
│   ├── App.jsx             # Main app with routing
│   └── main.jsx            # Entry point
├── index.html              # HTML template
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS config
├── postcss.config.js       # PostCSS config
├── package.json            # Dependencies
└── .env                    # Environment variables
```

## Setup & Installation

### Prerequisites
- Node.js 18+ installed
- Backend running on `http://localhost:8000`

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

The app will open at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

## Environment Variables

Create a `.env` file (already made):
```
VITE_API_URL=http://localhost:8000
```

For production, update this to your Render backend URL.

## Architecture

- **Router:** React Router v6 (App.jsx)
- **Auth:** JWT tokens stored in localStorage (AuthContext)
- **API:** Axios with interceptors for token injection
- **Styling:** Tailwind CSS in dark mode
- **Icons:** Lucide React
- **Charts:** Recharts (for dashboard analytics)

## Pages Ready for Design

1. **LoginPage** - Email + password auth
2. **SignupPage** - New viewer registration
3. **DashboardPage** - Admin-only metrics & charts
4. **OrdersPage** - List, filter, search, grouping
5. **OrderDetailPage** - Full order with audit log
6. **CustomersPage** - Admin customer management
7. **ProductsPage** - Admin product management

## Next Steps

Ready to design the LoginPage! Provide the design requirements and I'll build it.
