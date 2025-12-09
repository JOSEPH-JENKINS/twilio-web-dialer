// app/api/numbers/route.ts
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // 1. Check if keys exist
  if (!accountSid || !authToken) {
    console.error("Missing Twilio Credentials in Environment Variables");
    return NextResponse.json({ error: 'Server Config Error: Missing Env Vars' }, { status: 500 });
  }

  const client = Twilio(accountSid, authToken);
  
  try {
    // 2. Try to fetch numbers
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 });
    
    // 3. Check if account actually has numbers
    if (incomingPhoneNumbers.length === 0) {
      console.log("Twilio connection successful, but no numbers found on this account.");
      return NextResponse.json([]);
    }

    const formattedNumbers = incomingPhoneNumbers.map(n => ({
        friendlyName: n.friendlyName,
        phoneNumber: n.phoneNumber
    }));
    
    return NextResponse.json(formattedNumbers);

  } catch (error: any) {
    // 4. Log the specific Twilio error
    console.error("Twilio API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}