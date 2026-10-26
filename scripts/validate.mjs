
import fs from "node:fs";

const file = "public/data/league.json";

if (!fs.existsSync(file)) {
  throw new Error(`Missing data file: ${file}`);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!Array.isArray(data.divisions)) {
  throw new Error("Invalid league data: divisions must be an array");
}

// Starter mode: no live standings have been exported yet.
if (data.divisions.length === 0) {
  console.log("Starter mode: no live standings yet.");
} else {
  // Live mode: enforce the expected export structure.
  if (
    data.divisions.length !== 6 ||
    !data.divisions.some(
      division => Array.isArray(division.players) &&
                  division.players.length > 0
    )
  ) {
    throw new Error("Standings incomplete; refusing to publish");
  }

  if (!data.eventId || !data.finance || !data.updatedAt) {
    throw new Error("Missing export metadata");
  }
}

// Basic protection against accidental private data fields.
// Full schema allowlisting will be added before live exports.
const forbidden = [
  "paypal email",
  "paypalemail",
  "cell phone",
  "cellphone",
  "phone number",
  "emailaddress"
];

const content = JSON.stringify(data).toLowerCase();

for (const field of forbidden) {
  if (content.includes(field)) {
    throw new Error(`Potential private field detected: ${field}`);
  }
}

console.log("League data validation passed.");
