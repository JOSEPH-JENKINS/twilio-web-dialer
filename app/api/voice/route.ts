import { NextResponse } from 'next/server';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export async function POST(req: Request) {
  const formData = await req.formData();
  const to = formData.get('To') as string;
  const callerId = formData.get('callerId') as string; 

  const response = new VoiceResponse();

  if (to && callerId) {
    const dial = response.dial({ callerId });
    if (/^[\d\+\-\(\) ]+$/.test(to)) {
        dial.number(to);
    } else {
        dial.client(to);
    }
  } else {
    response.say('Welcome to the Netlify Dialer.');
  }

  return new NextResponse(response.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}