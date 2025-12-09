import { NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function POST() {
  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const appSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !appSid) {
    return NextResponse.json({ error: 'Credentials missing' }, { status: 500 });
  }

  const identity = 'user_' + Math.floor(Math.random() * 1000);
  const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });
  
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: appSid,
    incomingAllow: true, 
  });

  token.addGrant(voiceGrant);
  return NextResponse.json({ token: token.toJwt() });
}