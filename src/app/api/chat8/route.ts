/* eslint-disable @typescript-eslint/no-explicit-any */
// http://localhost:4000/api/chat8

import { ChatOpenAI } from "@langchain/openai";
import { NextRequest, NextResponse } from "next/server";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import pg from "pg";
import { createClient } from "@/lib/supabase/server";
import { getUserDataTool } from "@/lib/llm-tool";
import { ToolMessage, SystemMessage } from "@langchain/core/messages";
import { getRetriver } from "@/lib/retriever";

// คำสั่งของ system prompt ที่ถูกส่งทุกครั้ง
const SYSTEM_PROMPT = `
    บทบาท (Role):
คุณคือผู้ช่วยวิเคราะห์นโยบายการอนุมัติค่าใช้จ่ายของบริษัท
โดยอ้างอิงจาก “เอกสารนโยบายที่จัดเตรียมไว้เท่านั้น”
ห้ามเสริมเติมแต่ง คาดเดา หรือใช้ข้อมูลจากแหล่งอื่น
 
ขอบเขตหน้าที่ (Scope):
ตอบคำถามเฉพาะจากฐานข้อมูลนโยบายที่มีเท่านั้น
ห้ามใช้ความรู้ภายนอก
ห้ามสรุปจากสามัญสำนึก
ห้ามเติมข้อมูลที่ไม่ได้ระบุในเอกสาร
ตอบเป็นภาษาไทยเท่านั้น
รูปแบบภาษาชัดเจน กระชับ ตรงประเด็น
เหมาะกับผู้ใช้งานทั่วไปในองค์กร
หากคำถามไม่ชัดเจนหรือคลุมเครือ
ต้อง ถามกลับผู้ใช้งาน เพื่อให้ scope ชัดเจนขึ้น
เช่น หากคำถามในบริบทที่มันเกี่ยวกับภาพรวมของหัวข้อใหญ่ (1. /2. /3. - 10.) ""
→ คุณต้องตอบว่า   "คำว่า(คำถามในบริบท)อาจหมายถึงหลายหัวข้อ เช่น (ให้แสดงหัวข้อย่อยจากบริบทนั้นเช่น ข้อ 1.1 / 1.2.  หรือถ้าข้อ 1.7 ให้ scope แสดงหัวข้อย่อยไปอีกเช่น 1.7.1 คืออะไร 1.7.2 คืออะไรแล้วให้ผู้ใช้ตอบกลับมา ) กรุณาระบุข้อมูลให้ชัดเจน เพื่อให้สามารถแสดงข้อมูลอำนาจการอนุมัติได้ตรงตามเอกสาร"
หรือ คำว่า "Modern trade" ที่มีในหลายข้อให้ช่วยแสดงชื่อหัวข้อใหญ่และหัวข้อย่อยทั้งหมดแล้วถามกลับไปเพื่อ Scope หัวข้อจริงๆ เพื่อให้ได้ข้อมูลแม่นยำ
คำถามที่มีคำตอบได้หลายหัวข้อ ไม่สรุปโดยพลการ
ต้องถามกลับเพื่อแยกประเภทหัวข้อ
เช่น "คำถามนี้มีหลายหัวข้อที่เกี่ยวข้อง กรุณาระบุหัวข้อย่อยที่ต้องการ"
ตอบข้อมูลเฉพาะด้านใดด้านหนึ่งตามคำถาม เช่น
"ใครเป็นผู้อนุมัติ"
"มีเงื่อนไขอะไรเพิ่มเติม"
"ต้องผ่านใครบ้าง"
→ ค้นคำตอบจากข้อมูลในเอกสารเท่านั้น
รูปแบบการแสดงผล
ถามตอบแบบข้อความธรรมดา (plain text)
ชื่อหัวข้อควรเน้นให้ชัด เช่น ใช้ตัวหนา
หากไม่มีข้อมูลบางช่อง เช่น remark → ไม่ต้องแสดง
วัตถุประสงค์ของผู้ช่วย:
เพื่อช่วยผู้ใช้งานในองค์กรสามารถค้นหาและเข้าใจข้อมูลนโยบายเกี่ยวกับ
"อำนาจการอนุมัติ"
"เงื่อนไขในการอนุมัติ"
"ผู้อนุมัติแต่ละระดับ"
ได้อย่างถูกต้อง ครอบคลุม และสอดคล้องกับนโยบายจริง
`;

// Tools ที่จะให้ LLM ใช้งาน
const toolsByName = { getUserData: getUserDataTool } as const;
const toolArray = Object.values(toolsByName);

// สร้าง ChatOpenAI แล้ว bind tools เข้าไป
function getBoundModel() {
    return new ChatOpenAI({
        model: 'gpt-4.1-nano',
        temperature: 0,
        maxTokens: 800,
        cache: true,
    }).bindTools(toolArray);
}

// สร้างตัวจัดการ chat history
function getHistory(sessionId: string) {
    return new PostgresChatMessageHistory({
        sessionId,
        tableName: "langchain_chat_history",
        pool: new pg.Pool({
            host: process.env.PG_HOST,
            port: Number(process.env.PG_PORT),
            user: process.env.PG_USER,
            password: process.env.PG_PASSWORD,
            database: process.env.PG_DATABASE,
        }),
    });
}

export async function POST(req: NextRequest) {
    // get current login user
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    const body = await req.json();
    const messages: any[] = body.messages ?? [];
    const lastUserMessage = messages[messages.length - 1].content ?? "";

    // RAG: Retrieve context
    const docs = (await getRetriver()).invoke(lastUserMessage);
    const ragContextRaw = (await docs).map((document) => document.pageContent).join("\n\n");

    // ป้องกัน { } ใน context
    const safeContext = ragContextRaw.replace(/[{}]/g, '');

    // Prompt template
    const prompt = ChatPromptTemplate.fromMessages([
        ['system', SYSTEM_PROMPT],
        ['system', `เอกสารอ้างอิง:\n${safeContext}`],
        new MessagesPlaceholder("history"),
        ['user', '{input}'],
    ]);

    const chain = prompt.pipe(getBoundModel());

    const chainWithHistory = new RunnableWithMessageHistory({
        runnable: chain,
        getMessageHistory: (sessionId) => getHistory(sessionId),
        inputMessagesKey: "input",  // ต้องตรงกับ {input}
        historyMessagesKey: "history",
    });

    // เรียก LLM ครั้งแรก
    const firstResponse = await chainWithHistory.invoke(
        { input: lastUserMessage },
        { configurable: { sessionId: userId } }
    );

    // ถ้าไม่มี tool call → ส่งคำตอบเลย
    if (!Array.isArray(firstResponse.tool_calls) || firstResponse.tool_calls.length === 0) {
        return NextResponse.json(firstResponse.content);
    }

    // ถ้ามี tool call → ทำงานตาม tool
    const toolMessages: ToolMessage[] = [];

    for (const call of firstResponse.tool_calls) {
        if (!(call.name in toolsByName)) {
            throw new Error(`Tool ${call.name} not found`);
        }

        const tool = toolsByName[call.name as keyof typeof toolsByName];
        const toolResult = await tool.invoke(call, {
            metadata: { currentUserId: userId }
        });

        toolMessages.push(
            new ToolMessage({
                tool_call_id: call.id!,
                content: toolResult.content,
                name: call.name
            })
        );
    }

    // บันทึก ToolMessages ลงฐานข้อมูล
    const historyStore = getHistory(userId!);
    for (const tm of toolMessages) {
        await historyStore.addMessage(tm);
    }

    // ดึง history ทั้งหมดเพื่อใช้เรียกอีกครั้ง
    const fullHistory = await historyStore.getMessages();

    // เรียก LLM อีกครั้งเพื่อให้ได้คำตอบสุดท้าย
    const secondResponse = await getBoundModel().invoke([
        new SystemMessage(SYSTEM_PROMPT),
        ...fullHistory
    ]);

    // บันทึกคำตอบสุดท้าย
    await historyStore.addMessage(secondResponse);

    return NextResponse.json(secondResponse.content);
}
