/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/rag-index-json

import { createClient } from "@/lib/supabase/server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { NextResponse } from "next/server";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { readFileSync } from "fs";

export async function GET(){
    
     const rawData = readFileSync("./data/json/doa.json", "utf-8");

    const data = JSON.parse(rawData.toString());

    // แปลงเป็น Document[]
    const documents: Document[] = data.map((item: any) => {
        const { ["Business Activity"]: activity, ...metadata } = item;
        return new Document({
        pageContent: activity,
        metadata
        });
    });

    const supabase = await createClient();

    const vectorStore = new SupabaseVectorStore(
        new OpenAIEmbeddings({ model: 'text-embedding-3-small'}),
        {
            client: supabase,
            tableName: 'documents',
        }
    );

    await vectorStore.addDocuments(documents);

    return NextResponse.json({ documents });
    
}





