import { tool } from "@langchain/core/tools";
import { z } from "zod";

const UserDataSchema = z.object({
    userId: z.string().describe("รหัสพนักงาน"),
    //salary: z.number().describe("เงินเดือนของพนักงาน"),
    //leaveBalance: z.number().describe("วันลาคงเหลือของพนักงาน"),
});

const getUserDataTool = tool(
    async ({userId}, options): Promise<string> => {
        const currentUserId = options?.metadata?.currentUserId as string;

        //const res = await fetch('http://localhost:4000/api/user/' + userId);
        const res = await fetch(`${process.env.APP_URL}/api/user/` + userId);
        if (res.status === 404){
            return JSON.stringify({ error: "ไม่พบข้อมูลพนักงาน" });
        }

        const data = await res.json();

        // เช็คสิทธิ์ อนุญาตให้เข้าถึงเฉพาะข้อมูลตัวเองเท่านั้น
        const isOwnData = userId === currentUserId;
        if (!isOwnData) {
            return JSON.stringify({ error: "ไม่อนุญาตให้เข้าถึงข้อมูลส่วนตัวของพนักงานท่านอื่น" });
        }

        return JSON.stringify(data);
    },
    {
        name: "getUserData",
        description: "สำหรับเรียกดูข้อมูลส่วนตัวของพนักงานตามรหัสพนักงาน จะคืนค่าข้อมูลได้แก่ ชื่อ-สกุล เงินเดือน วันลาคงเหลือ วันที่เริ่มทำงาน และอื่นๆ",
        schema: UserDataSchema,
    }
);

export { getUserDataTool };
