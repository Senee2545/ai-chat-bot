// http://localhost:4000/api/rag-index-pdf-ocr
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@/lib/supabase/server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { NextResponse } from "next/server";
import { OpenAIEmbeddings } from "@langchain/openai";

import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

import fs from "fs/promises";
import path from "path";
import { createWorker } from "tesseract.js";

export async function GET() {
  // 1. โหลดข้อความจาก PDF text layer
  const loader = new PDFLoader("./data/pdf/ort.pdf");
  const docs = await loader.load();

  // 2. แปลง PDF เป็นรูป JPEG ด้วย pdftocairo เรียกผ่าน child_process
  const pdfPath = "./data/pdf/ort.pdf";
  const outputDir = "./tmp/pdf-images";
  await fs.mkdir(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "page");

  try {
    await execFileAsync("/opt/homebrew/bin/pdftocairo", [
      "-jpeg",
      "-scale-to",
      "1024",
      pdfPath,
      outputPrefix,
    ]);
  } catch (error) {
    return NextResponse.json({ error: `Error running pdftocairo: ${error}` }, { status: 500 });
  }

  // 3. OCR รูป JPEG ทุกไฟล์ในโฟลเดอร์
  const worker = await createWorker();

  await worker.load();
  await worker.loadLanguage("tha+eng");
  await worker.initialize("tha+eng");

  const files = (await fs.readdir(outputDir)).filter((f) => f.endsWith(".jpg"));
  const ocrTexts: string[] = [];

  for (const file of files) {
    const imagePath = path.join(outputDir, file);
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    ocrTexts.push(text);
  }

  await worker.terminate();

  // 4. รวมข้อความจาก text layer และ OCR เข้าด้วยกัน
  const combinedText = [...docs.map((doc) => doc.pageContent), ...ocrTexts].join("\n\n");

  const rawDocument = {
    pageContent: combinedText,
    metadata: { source: "ort.pdf (text + OCR)" },
  };

  // 5. แบ่งเอกสารเป็น chunks สำหรับ index
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " ", ""],
  });

  const chunks = await splitter.splitDocuments([rawDocument]);

  // 6. เชื่อมต่อ Supabase แล้วเก็บเอกสารลง vector store
  const supabase = await createClient();

  const vectorStore = new SupabaseVectorStore(
    new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    {
      client: supabase,
      tableName: "documents",
    }
  );

  await vectorStore.addDocuments(chunks);

  return NextResponse.json({ message: `ทำ Indexed ทั้งหมด ${chunks.length} chunks (text + OCR)` });
}
