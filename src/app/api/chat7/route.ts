/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat7

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
//import { HttpResponseOutputParser } from "langchain/output_parsers";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import pg from "pg";
import { createClient } from "@/lib/supabase/server";
import { getUserDataTool } from "@/lib/llm-tool";
import { ToolMessage, SystemMessage } from "@langchain/core/messages";

// คำสั่งของ system prompt ที่ถูกส่งทุกครั้ง
const SYSTEM_PROMPT = `
    คุณเป็นผู้จัดการฝ่าย HR บริษัท เพศหญิง คอยตอบคำถามให้กับพนักงานในเรื่องทั่วไป สวัสดิการต่างๆ ด้วยภาษาทางการ
    - ต้องเรียก getUserData ทุกครั้งเมื่อผู้ใช้ถามเกี่ยวกับข้อมูลส่วนตัว
    - ถ้า getUserData ส่ง {{ error: "NOT FOUND" }} ให้ตอบว่า "ไม่พบรหัสพนักงาน กรุณาระบุใหม่"
    - ถ้า getUserData ส่ง {{ error: "FORBIDDEN" }} ให้ตอบว่า "ไม่อนุญาตให้เข้าถึงข้อมูลส่วนตัวของพนักงานท่านอื่น"
    - ห้ามเดารหัสพนักงานเอง สามารถใช้รหัสพนักงานจาก chat history ได้
    - ถ้าได้ข้อมูล เงินเดือน วันลาคงเหลือ ชื่อ-สกุล วันที่เริ่มทำงาน ให้ตอบแบบสุภาพ
    - ถ้าถามข้อมูล เงินเดือน ให้เรียก getUserData ทุกครั้ง ห้ามใช้ chat history
`;

// Tools ที่จะให้ LLM ใช้งาน สามารถเพิ่ม tools ใหม่ได้ใน objetc นี้
const toolsByName = {getUserData: getUserDataTool } as const;
const toolArray = Object.values(toolsByName);

// สร้าง ChatOpenAI model แล้ว bind tools เข้าไป
function getBoundModel() {
    return new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
        cache: true,
    }).bindTools(toolArray);
}

// สร้างตัวจัดการ chat history ของ session นั้น จะเพิ่ม ค้นหา หรือลบ  history ก้ได้
function getHistory(sessionId: string) {
    return new PostgresChatMessageHistory({
        sessionId,
        tableName:"langchain_chat_history",
        pool: new pg.Pool({
          host: process.env.PG_HOST,
          port: Number(process.env.PG_PORT),
          user: process.env.PG_USER,
          password: process.env.PG_PASSWORD,
          database: process.env.PG_DATABASE,
        }),
      })
}

export async function POST(req: NextRequest) {

    //get current login user
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    const body = await req.json();
    const messages: any[] = body.messages ?? [];
    const lastUserMessage = messages[messages.length - 1].content ?? "";


    const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_PROMPT ],
        new MessagesPlaceholder('history'),
        ['user', '{question}'],
    ]);

    const chain = prompt.pipe(getBoundModel());

    const chainWithHistory = new RunnableWithMessageHistory({
        runnable: chain,
        getMessageHistory: (sessionId) => getHistory(sessionId),
        inputMessagesKey: "question",
        historyMessagesKey: "history",
      });

    // เรียก LLM ครั้งแรก ( อาจมีการเรียก tool_calls ) 
    const firstResponse = await chainWithHistory.invoke( 
        { question: lastUserMessage },
        { configurable: { sessionId: userId} }
    );

    // ถ้า LLM ไม่ ขอใช้ Tool ก็จบเลย (คุยปกติ)
    if(!Array.isArray(firstResponse.tool_calls) || firstResponse.tool_calls.length === 0 ) {
        return NextResponse.json(firstResponse.content) 
    }

    // LLM ขอใช้ Tool -> loop -> เรียกใช้ตามรายการ tools
    const toolMessages: ToolMessage[] = [];
    for (const call of firstResponse.tool_calls) {
        // ตรวจสอบว่ามี tool อยู่จริง
        if (!(call.name in toolsByName)) {
            throw new Error(`Tool ${call.name} not found`);
        }

        // เรียกใช้ tool ตามชื่อ
        const tool = toolsByName[call.name as keyof typeof toolsByName];
        const toolResult = await tool.invoke(call, {
            metadata: { currentUserId: userId}
        });

        toolMessages.push(
            new ToolMessage({
                tool_call_id: call.id!,
                content: toolResult.content,
                name: call.name
            })
        );
    }

     // บันทึก toolMessages ลงฐานข้อมูล
     const historyStore = getHistory(userId!);
     for (const tm of toolMessages) {
         await historyStore.addMessage(tm);
     }

    // ดึง history มาจาก database และ invoke (second call)
    const fullHistory = await historyStore.getMessages();

    // เรียก LLM ครั้งที่ 2 เพื่อให้ได้คำตอบสุดท้าย
    const secondResponse = await getBoundModel().invoke([
        new SystemMessage(SYSTEM_PROMPT),
        ...fullHistory
    ]);

    // บันทึกคำตอบสุดท้ายที่ AI ตอบลงในฐานข้อมูลด้วย (chat history)
    await historyStore.addMessage(secondResponse);

    return NextResponse.json(secondResponse.content); 
}