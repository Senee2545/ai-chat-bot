// http://localhost:3000/api/Embed-doa

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@/lib/supabase/server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { NextResponse } from "next/server";
import { OpenAIEmbeddings } from "@langchain/openai";

export async function GET(){
    const loader = new PDFLoader("./data/pdf/doa-new-font.pdf");
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
            tableName: 'documents_doa',
        }
    );

    await vectorStore.addDocuments(chunks);

    return NextResponse.json({ message: `newfont.pdf ทำ Indexed ทั้งหมด ${chunks.length} chunks (1536)`, documents: chunks });

    
}





