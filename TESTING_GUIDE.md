# 🧪 Test-Anleitung: Beispieldaten-Feature

## ✅ **Aktueller Status:**
- ✅ Firebase Emulatoren laufen auf localhost
- ✅ Frontend läuft auf http://localhost:5173
- ✅ Firestore Emulator UI: http://127.0.0.1:4300/firestore
- ✅ Beispieldaten-Funktion implementiert

## 🎯 **Test-Schritte:**

### **1. Anwendung öffnen**
```
http://localhost:5173
```

### **2. FirstUploadWizard aktivieren**
- Neue Benutzer sehen automatisch den Wizard
- Falls nicht: Dashboard → "Getting Started Guide" Button

### **3. Beispieldaten testen**
1. **Klick auf "Dashboard mit Beispieldaten erkunden"**
2. **Erwartung**: Button zeigt "Erstelle Beispieldaten..."
3. **Ergebnis**: 4 Beispieldokumente werden in Firestore erstellt
4. **Redirect**: Automatisch zum Dashboard mit Daten

### **4. Ergebnisse überprüfen**

#### **In der Anwendung:**
- **Dashboard zeigt jetzt 4 Dokumente**
- **Verschiedene Status**: Ready, Awaiting, Error
- **Realistische Daten**: Hotel, Konferenz, Büro, Catering

#### **In Firestore Emulator:**
```
http://127.0.0.1:4300/firestore
```
- **Collection**: `documents`
- **4 Dokumente** mit realistischen Daten
- **Marker**: `isSampleData: true`

## 📊 **Beispieldaten-Details:**

### **1. Hotel Adlon Berlin** 
- **Betrag**: €189.00 (€30.21 VAT)
- **Status**: `ready_for_submission`
- **Items**: Übernachtung, Frühstück

### **2. TechConf Europe**
- **Betrag**: €595.00 (€95.13 VAT) 
- **Status**: `ready_for_submission`
- **Items**: Konferenz-Ticket, Workshop

### **3. BüroMax München**
- **Betrag**: €127.49 (€20.37 VAT)
- **Status**: `awaiting_validation`
- **Items**: Bürostuhl, Laptop-Stand

### **4. Gourmet Catering** (Error-Demo)
- **Betrag**: €245.80 (€0.00 VAT)
- **Status**: `validation_error`
- **Error**: "VAT-Nummer konnte nicht verifiziert werden"

## 🔧 **Troubleshooting:**

### **Problem**: Keine Daten erscheinen
**Lösung**: 
1. Browser-Console öffnen (F12)
2. Prüfen auf "✅ Sample documents created successfully"
3. Firestore Emulator UI prüfen
4. ggf. Seite neu laden

### **Problem**: "User not authenticated"
**Lösung**:
1. Erst einloggen/registrieren
2. Dann Beispieldaten laden

### **Problem**: Firebase-Verbindungsfehler
**Lösung**:
1. Emulatoren-Status prüfen
2. Ports 8080, 9099 verfügbar?
3. ggf. Emulatoren neu starten

## 🎉 **Erwartetes Ergebnis:**

Nach dem Test sollten Sie ein **vollständig funktionsfähiges Dashboard** mit realistischen Beispieldaten sehen, das die komplette VAT-Refund-Funktionalität demonstriert!

**Jetzt haben neue Benutzer sofort eine aussagekräftige Demo-Erfahrung! 🚀**
