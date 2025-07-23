/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/Embed


import { NextResponse } from "next/server";
import { OpenAIEmbeddings } from "@langchain/openai";

export const runtime = "nodejs";

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
});

export async function GET() {
  try {
    const text = "พนักงานใหม่123";  
    const vector = await embeddings.embedQuery(text);
    return NextResponse.json({ vector });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error" }, { status: 500 });
  }
}

