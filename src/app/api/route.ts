// http://localhost:4000/api

import { NextResponse } from "next/server";

export function GET() {
    return NextResponse.json({
        message: "API Running..."
    });
}

