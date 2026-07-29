import { initDatabase } from "@/lib/init-db";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    // Require authentication to prevent anonymous DDL execution
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDatabase();
    return NextResponse.json({ message: "Database initialized successfully! You can now close this tab." });
  } catch (error: any) {
    return NextResponse.json({ error: "Database initialization failed" }, { status: 500 });
  }
}
