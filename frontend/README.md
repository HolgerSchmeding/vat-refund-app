# VAT Refund System - Frontend

This is the React TypeScript frontend for the VAT Refund System, built with Vite for optimal development experience and fast builds.

## 🚀 Features

### ✅ Implemented
- **Modern React with TypeScript** - Type-safe development
- **Firebase Authentication** - Secure user login/signup  
- **Real-time Dashboard** - Live document status updates
- **Document Management** - View and track uploaded documents
- **VAT Submission Generator** - Create XML submissions for tax authorities
- **Responsive Design** - Works on desktop and mobile devices

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **Vite** - Fast build tool and dev server
- **Firebase SDK** - Authentication, Firestore, Functions, Storage
- **React Router** - Client-side routing
- **Lucide React** - Modern icon library

## 🚀 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   - Navigate to http://localhost:5173
   - Use demo credentials: demo@example.com / demo123

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

The frontend provides a complete user interface for the VAT refund system with real-time updates and modern responsive design.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
