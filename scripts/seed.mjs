// Återställer databasen till ren demodata.
// Schemat skapas och demodatat läses in automatiskt vid nästa serverstart (src/lib/db.ts).
import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "data");
let removed = false;
for (const f of ["navet.db", "navet.db-wal", "navet.db-shm", "navet.db-journal"]) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    removed = true;
  }
}
console.log(removed
  ? "Databasen återställd. Starta servern (npm run dev / npm start) så skapas schema och demodata på nytt."
  : "Ingen databas hittades – den skapas med demodata vid nästa serverstart.");
