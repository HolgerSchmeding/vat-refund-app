# Starten mit einer offiziellen Node.js-Version, die zu unserem Projekt passt
FROM node:20

# Java (notwendig für Firestore-Emulator) und Firebase CLI installieren
RUN apt-get update && apt-get install -y openjdk-17-jre
RUN npm install -g firebase-tools

# Arbeitsverzeichnis im Container festlegen
WORKDIR /app

# package.json-Dateien kopieren, um Dependencies zu installieren
# Dies optimiert den Build-Prozess
COPY package.json ./
COPY functions/package.json ./functions/
RUN npm install
RUN cd functions && npm install

# Den gesamten Projektcode in den Container kopieren
COPY . .

# Functions bauen
RUN cd functions && npm run build

# Ports freigeben, die der Emulator verwendet
EXPOSE 4300 5001 8080 9199 9099

# Standardbefehl, der beim Starten des Containers ausgeführt wird
# Startet die Emulatoren und macht sie im Netzwerk verfügbar
CMD ["firebase", "emulators:start", "--import=./emulator-data", "--export-on-exit"]
