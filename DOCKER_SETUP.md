# Firebase Emulator Docker Setup

## Voraussetzungen
1. **Docker Desktop für Windows installieren**: https://www.docker.com/products/docker-desktop/
2. **Docker Desktop starten** und sicherstellen, dass es läuft

## Quick Start (nach Docker Installation)

### 1. Emulator-Container starten
```bash
cd vat-refund-app
docker-compose up --build
```

### 2. Zugriff auf Services
- **Emulator UI**: http://localhost:4300
- **Functions**: http://localhost:5001
- **Firestore**: http://localhost:8080
- **Storage**: http://localhost:9199
- **Auth**: http://localhost:9099

### 3. Frontend separat starten
```bash
cd frontend
npm run dev
```

### 4. Stoppen
```bash
# Terminal: Ctrl+C drücken
docker-compose down
```

## Vorteile dieser Lösung

✅ **Keine Port-Konflikte**: Container isoliert alle Services  
✅ **Konsistente Umgebung**: Java 17 + Node 20 immer verfügbar  
✅ **Persistente Daten**: Firestore-Daten bleiben erhalten  
✅ **Hot Reload**: Code-Änderungen werden live übernommen  
✅ **Windows-unabhängig**: Keine PATH/Java-Probleme  

## Troubleshooting

### Docker nicht installiert
1. Docker Desktop herunterladen: https://www.docker.com/products/docker-desktop/
2. Installation durchführen
3. System neu starten
4. Docker Desktop öffnen und warten bis "Engine running"

### Container-Rebuild nach Code-Änderungen
```bash
docker-compose down
docker-compose up --build
```

### Logs anzeigen
```bash
docker-compose logs -f firebase-emulators
```

### Container-Status prüfen
```bash
docker-compose ps
```

## Frontend-Konfiguration

Stelle sicher, dass `frontend/src/firebaseConfig.ts` die Emulator-Verbindungen hat:

```typescript
// Bei lokaler Entwicklung
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

## Nächste Schritte

1. **Docker Desktop installieren** (falls noch nicht geschehen)
2. **Container starten**: `docker-compose up --build`
3. **Frontend starten**: `cd frontend && npm run dev`
4. **Upload testen**: PDF in UI hochladen und Firestore überprüfen
