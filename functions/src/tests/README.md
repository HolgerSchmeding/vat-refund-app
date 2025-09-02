# VAT Refund App - Test Suite Documentation

## Test-Kategorien

Unser Test-Framework ist in verschiedene Kategorien unterteilt, um unterschiedliche Aspekte der Anwendung zu validieren:

### 🧪 Unit Tests
**Verzeichnis:** `src/tests/parsers/`, `src/tests/rules/`, `src/tests/initial.test.ts`

**Zweck:** Testen einzelne Module und Funktionen isoliert.

**Ausführen:**
```bash
npm run test:unit
```

**Abgedeckte Bereiche:**
- Parser-Module (`documentParser.ts`)
- Refundability Rules (`refundabilityRules.ts`)
- Grundfunktionalität (Vitest Framework Setup)

### 🔗 Integration Tests
**Verzeichnis:** `src/tests/integration/`

**Zweck:** Testen das Zusammenspiel zwischen Cloud Functions und Firebase-Diensten.

**Voraussetzungen:**
- Firebase Emulator Suite muss laufen
- Firestore Emulator auf Port 8080

**Ausführen:**
```bash
# Emulator starten (separates Terminal)
firebase emulators:start

# Integration Tests ausführen
npm run test:integration
```

**Getestete Szenarien:**
- `validateDocument` Cloud Function Trigger
- Firestore Dokument-Updates
- Refundability-Validierung mit Emulator-Datenbank

### 🚬 Smoke Tests
**Verzeichnis:** `src/tests/smoke/`

**Zweck:** End-to-End Validierung des gesamten Upload- und Verarbeitungsprozesses.

**Voraussetzungen:**
- Firebase Emulator Suite muss laufen
- Storage Emulator
- Firestore Emulator

**Ausführen:**
```bash
# Emulator starten (separates Terminal)
firebase emulators:start

# Smoke Tests ausführen
npm run test:smoke
```

**Getestete Workflows:**
- Vollständiger File-Upload zu Storage
- Document AI Verarbeitung (simuliert)
- Automatische Validierung
- Status-Updates bis zum finalen Zustand

## Test-Ausführung

### Alle Tests ausführen
```bash
npm run test:all
```

### Einzelne Test-Kategorien
```bash
# Nur Unit Tests
npm run test:unit

# Nur Integration Tests (Emulator erforderlich)
npm run test:integration

# Nur Smoke Tests (Emulator erforderlich)
npm run test:smoke
```

### Watch-Modus für Entwicklung
```bash
npm run test:watch
```

### UI für interaktive Tests
```bash
npm run test:ui
```

## Firebase Emulator Setup

Für Integration- und Smoke-Tests ist die Firebase Emulator Suite erforderlich:

### Emulator starten
```bash
cd vat-refund-app
firebase emulators:start
```

### Emulator Services
- **Firestore:** `localhost:8080`
- **Storage:** `localhost:9199`
- **Functions:** `localhost:5001`
- **UI:** `localhost:4000`

## Test-Ergebnisse

### Coverage Reports
```bash
npm run test:coverage
```

Coverage-Reports werden generiert in:
- `./coverage/index.html` (HTML Report)
- `./test-results.json` (JSON Report)
- `./test-report.html` (Test Report)

### Erwartete Coverage-Ziele
- **Parser Module:** 95%+
- **Refundability Rules:** 100%
- **Gesamt:** 90%+

## Debugging Tests

### Verbose Output
```bash
npm test -- --reporter=verbose
```

### Einzelne Test-Datei ausführen
```bash
npx vitest run src/tests/integration/validation.integration.test.ts
```

### Test-spezifische Logs
Tests verwenden strukturierte Logs mit Console-Output für bessere Nachverfolgung.

## Best Practices

### Test-Isolation
- Jeder Test räumt seine Test-Daten auf
- Verwendung von `testDocument: true` Markierungen
- Separate Cleanup in `beforeEach` Hooks

### Timeouts
- **Unit Tests:** 5-10 Sekunden
- **Integration Tests:** 10-15 Sekunden  
- **Smoke Tests:** 20-25 Sekunden

### Mock-Strategien
- Document AI wird in Smoke Tests simuliert
- Firebase Admin SDK verwendet echte Emulator-Verbindungen
- Strukturierte Testdaten für realistische Szenarien

## Troubleshooting

### Emulator-Probleme
```bash
# Emulator zurücksetzen
firebase emulators:exec --ui "echo 'Emulator reset'"

# Ports prüfen
netstat -an | findstr "8080\|9199\|5001"
```

### Test-Timeouts
Bei langsamen Tests oder Timeouts:
1. Emulator-Performance prüfen
2. Test-Timeouts in `vitest.config.ts` erhöhen
3. Parallele Test-Ausführung reduzieren

### Debugging Integration Tests
```bash
# Mit Debug-Output
DEBUG=* npm run test:integration

# Mit Firebase Emulator UI
# Browser: http://localhost:4000
```

## Kontinuierliche Integration

Für CI/CD Pipeline:
```bash
# CI-freundlicher Test-Lauf
npm run test:unit  # Läuft ohne Emulator
# npm run test:integration  # Nur mit Emulator-Setup
# npm run test:smoke       # Nur mit Emulator-Setup
```

---

**Status:** ✅ Alle Test-Kategorien implementiert und funktional  
**Letzte Aktualisierung:** September 2025  
**Test Coverage:** 100% für kritische Geschäftslogik
