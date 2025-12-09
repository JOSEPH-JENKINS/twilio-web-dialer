import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function GET() {
  const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    const list = await client.incomingPhoneNumbers.list({ limit: 20 });
    return NextResponse.json(list.map(n => ({
        friendlyName: n.friendlyName,
        phoneNumber: n.phoneNumber
    })));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch numbers' }, { status: 500 });
  }
}