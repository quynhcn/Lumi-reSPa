import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { input, services } = await req.json();

    if (!input) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chưa cấu hình GEMINI_API_KEY trong file .env' },
        { status: 500 }
      );
    }

    const serviceNames = services.map((s: any) => `${s.id}: ${s.name}`).join('\n');
    
    // Yêu cầu AI xuất chuẩn cấu trúc ParsedBooking (để Frontend đọc được)
    const systemInstruction = `
Bạn là một trợ lý ảo của Lumière Spa. Nhiệm vụ của bạn là phân tích yêu cầu đặt lịch của khách hàng và trích xuất thông tin.
Ngày hôm nay là: ${new Date().toLocaleDateString('vi-VN')}
Giờ hiện tại là: ${new Date().toLocaleTimeString('vi-VN')}

Danh sách dịch vụ đang có (ID: Tên):
${serviceNames}

Hãy trả về CHỈ MỘT OBJECT JSON duy nhất đúng định dạng sau, KHÔNG CÓ THÊM BẤT KỲ ĐOẠN TEXT NÀO KHÁC (kể cả markdown \`\`\`json):
{
  "service_id": "ID của dịch vụ phù hợp nhất (hoặc null nếu không rõ)",
  "service_name": "Tên dịch vụ",
  "service_confidence": "high" hoặc "low" hoặc null,
  "date": "Ngày đặt lịch định dạng YYYY-MM-DD (hoặc null)",
  "date_label": "Label của ngày (ví dụ: Hôm nay, Ngày mai, 25/10)",
  "date_confidence": "high" hoặc "low" hoặc null,
  "time": "Giờ đặt lịch định dạng HH:mm (hoặc null)",
  "time_label": "Label giờ (ví dụ: 15:00, Sáng, Chiều)",
  "time_confidence": "high" hoặc "low" hoặc null,
  "gender_preference": "female" hoặc "male" hoặc null,
  "notes": "Các ghi chú/yêu cầu đặc biệt được tổng hợp lại thành 1 chuỗi ngắn gọn (ví dụ: 'thích nhẹ tay, tránh cổ') hoặc null",
  "understood_fields": ["danh sách các trường đã hiểu, vd: 'dịch vụ', 'ngày', 'giờ', 'yêu cầu đặc biệt'"],
  "unclear_fields": ["danh sách các trường bị thiếu hoặc chưa rõ"]
}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          { parts: [{ text: input }] }
        ],
        generationConfig: {
          temperature: 0, // Tính chính xác tuyệt đối
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API Error:', err);
      return NextResponse.json({ error: 'Gemini API failed' }, { status: 502 });
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    
    const parsedData = JSON.parse(resultText);
    
    // Gắn thêm raw_input
    parsedData.raw_input = input;

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error parsing booking with AI:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
