// http://localhost:4000/api/chat

import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";

export async function POST() {
    const model = new ChatOpenAI({
        model: "gpt-4.1-nano",
        temperature: 0,
        maxTokens: 200,
    });

    const response = await model.invoke([
        {
            role: "system",
            content: "คุณเป็นผู้จัดการฝ่าย HR บริษัท คอยตอบคำถามให้พนักงานในเรื่องทั่วไป และ สวัสดิการต่างๆ",
        },
        {            
            role: "user",
            content: "สวัสดีครับ เงินเดือนผมจะออกวันไหนครับ",
        },
    ]); 

    return NextResponse.json({ AI_Message: response.content });
}