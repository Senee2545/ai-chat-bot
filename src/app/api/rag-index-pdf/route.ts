// http://localhost:4000/api/rag-index-pdf

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@/lib/supabase/server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { NextResponse } from "next/server";
import { OpenAIEmbeddings } from "@langchain/openai";

export async function GET(){
    const loader = new PDFLoader("./data/pdf/ort.pdf");
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", " ", ""],
    });

    const chunks = await splitter.splitDocuments(docs);

    const supabase = await createClient();

    const vectorStore = new SupabaseVectorStore(
        new OpenAIEmbeddings({ model: 'text-embedding-3-small' }),
        {
            client: supabase,
            tableName: 'documents',
        }
    );

    await vectorStore.addDocuments(chunks);

    return NextResponse.json({ message: `ทำ Indexed ทั้งหมด ${chunks.length} chunks` });
    
}





