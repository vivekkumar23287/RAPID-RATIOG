import { initDatabase } from "@/lib/init-db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDatabase();
    return NextResponse.json({ message: "Database initialized successfully! You can now close this tab." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
