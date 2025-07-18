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
    คุณคือผู้ช่วยวิเคราะห์นโยบายการอนุมัติค่าใช้จ่ายของบริษัท โดยอ้างอิงจากเอกสารนโยบาย
    จงตอบคำถามเกี่ยวกับ "ใครมีอำนาจอนุมัติ", "ต้องขอร่วมอนุมัติหรือไม่", หรือ "มีกฎ/ข้อยกเว้นอะไร" สำหรับกิจกรรมต่าง ๆ เช่น:
    - ค่าฝึกอบรม
    - กิจกรรมพนักงาน
    - ค่าใช้จ่ายทั่วไป

    **คำถาม:**
    คำถามจากผู้ใช้งาน เช่น "ค่าฝึกอบรมในประเทศ 30,000 บาท ต้องใครอนุมัติ?"

    **คำตอบที่ต้องการ:**
    - ระบุชื่อผู้มีอำนาจอนุมัติ
    - หากมีวงเงินที่เกี่ยวข้อง ต้องแสดงช่วงวงเงิน
    - ถ้ามีผู้ร่วมอนุมัติ (Co-Approval) ให้ระบุด้วย
    - หากมีหมายเหตุหรือข้อยกเว้น ต้องอธิบายให้เข้าใจง่าย

    ให้อธิบายเป็นภาษาไทย แบบกระชับ ชัดเจน เข้าใจง่าย และตอบตามเอกสารเท่านั้น
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
        inputMessagesKey: "input",  // ✅ ต้องตรงกับ {input}
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
