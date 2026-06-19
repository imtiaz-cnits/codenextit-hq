import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      console.error("GEMINI_API_KEY is not configured");
      return NextResponse.json(
        { error: "Gemini API key is missing. Please add GEMINI_API_KEY to your .env file." },
        { status: 500 }
      );
    }

    // Convert File to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "audio/webm";

    // Call Gemini API (2.5 Flash is incredibly fast, accurate, and has a huge free tier)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "Transcribe the audio exactly. If there is no speech, output nothing. Do not add any introductory or concluding comments." },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini Transcription Error:", errorData);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return NextResponse.json({ text: candidateText.trim() });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
