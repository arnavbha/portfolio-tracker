import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "data", "config.json");

async function ensureFile() {
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ finnhubKey: "" }), "utf-8");
  }
}

export async function GET() {
  // Env var takes priority over the saved file
  const envKey = process.env.NEXT_PUBLIC_FINNHUB_KEY ?? "";
  if (envKey) {
    return NextResponse.json({ finnhubKey: envKey, source: "env" });
  }
  try {
    await ensureFile();
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const { finnhubKey } = JSON.parse(raw);
    return NextResponse.json({ finnhubKey: finnhubKey ?? "", source: "file" });
  } catch {
    return NextResponse.json({ finnhubKey: "", source: "none" });
  }
}

export async function POST(req: Request) {
  try {
    const { finnhubKey } = await req.json();
    await ensureFile();
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify({ finnhubKey: finnhubKey ?? "" }, null, 2),
      "utf-8"
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to save config" },
      { status: 500 }
    );
  }
}
