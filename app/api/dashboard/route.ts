import { auth } from "@/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";

function rowsToObjects(rows: string[][]) {
  if (!rows.length) return [];
  const [headers, ...data] = rows;
  return data.map((row) =>
    Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""]))
  );
}

async function getSheetData(
  authClient: any,
  spreadsheetId: string,
  range: string
) {
  const sheets = google.sheets({
    version: "v4",
    auth: authClient,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

export async function GET() {
  try {
    const session = (await auth()) as any;

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const clientId = process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;

    if (!spreadsheetId || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    oauth2Client.setCredentials({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      expiry_date: session.expiresAt ? session.expiresAt * 1000 : undefined,
    });

    await oauth2Client.getAccessToken();

    const [billing, capacity, employees, tasks, calls] = await Promise.all([
      getSheetData(oauth2Client, spreadsheetId, "Billing!A:Z"),
      getSheetData(oauth2Client, spreadsheetId, "Capacity!A:Z"),
      getSheetData(oauth2Client, spreadsheetId, "Employees!A:Z"),
      getSheetData(oauth2Client, spreadsheetId, "Tasks!A:Z"),
      getSheetData(oauth2Client, spreadsheetId, "Calls!A:Z"),
    ]);

    return NextResponse.json({
      billing: rowsToObjects(billing),
      capacity: rowsToObjects(capacity),
      employees: rowsToObjects(employees),
      tasks: rowsToObjects(tasks),
      calls: rowsToObjects(calls),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}