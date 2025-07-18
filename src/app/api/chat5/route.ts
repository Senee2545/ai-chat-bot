/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat5

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import pg from "pg";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {

    //get current login user
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    const body = await req.json();
    const messages: any[] = body.messages ?? [];
    const lastUserMessage = messages[messages.length - 1].content ?? "";


    const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'คุณเป็นผู้จัดการฝ่าย HR บริษัท คอยตอบคำถามให้พนักงานในเรื่องทั่วไป และ สวัสดิการต่างๆ'],
        new MessagesPlaceholder('history'),
        ['user', '{question}'],
    ]);

    const model = new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
    });

    const chain = prompt.pipe(model);

    const chainWithHistory = new RunnableWithMessageHistory({
        runnable: chain,
        getMessageHistory: (sessionId) =>
          new PostgresChatMessageHistory({
            sessionId,
            tableName:"langchain_chat_history",
            pool: new pg.Pool({
              host: process.env.PG_HOST,
              port: Number(process.env.PG_PORT),
              user: process.env.PG_USER,
              password: process.env.PG_PASSWORD,
              database: process.env.PG_DATABASE,
            }),
          }),
        inputMessagesKey: "question",
        historyMessagesKey: "history",
      }).pipe(new HttpResponseOutputParser());

    const streamResponse = await chainWithHistory.stream( 
        { question: lastUserMessage },
        { configurable: { sessionId: userId} }
    );

    return new NextResponse(streamResponse, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }); 
}