import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { google } from "googleapis";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // @ts-ignore
    const accessToken = session?.accessToken;

    if (!session || !accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken as string });

    const tasksService = google.tasks({ version: "v1", auth: oauth2Client });

    // Fetch tasks from the default task list
    const response = await tasksService.tasks.list({
      tasklist: "@default",
      showCompleted: false, // only fetch active tasks
    });

    const tasks = response.data.items || [];

    // Format tasks to match the frontend expectations
    const formattedTasks = tasks.map((task) => {
      // task.due is a string like "2023-10-25T00:00:00.000Z"
      const dateStr = task.due ? task.due.split("T")[0] : new Date().toISOString().split("T")[0];
      return {
        title: task.title || "Untitled Task",
        date: dateStr,
        color: "#90caf9", // Default Material Blue 200
      };
    });

    return NextResponse.json({ success: true, tasks: formattedTasks });
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch tasks" }, { status: 500 });
  }
}
