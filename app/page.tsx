'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { useContacts } from '@/hooks/useContact';

// Icons need to be text/emoji to match your design exactly, 
// or we can use the Lucide icons if you prefer. 
// I will use text/emoji to match your HTML exactly.

interface TwilioNumber { friendlyName: string; phoneNumber: string; }

export default function WebDialer() {
  // --- LOGIC STATE ---
  const [device, setDevice] = useState<Device | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  
  // Data State
  const [myNumbers, setMyNumbers] = useState<TwilioNumber[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>('');
  
  // UI State (Inputs)
  const [inputValue, setInputValue] = useState(''); // The "To" number
  
  // Contacts State
  const { contacts, saveContact, deleteContact } = useContacts();
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Call UI State
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false); // In-call dialpad
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- SETUP ---
  useEffect(() => {
    const setup = async () => {
      try {
        const nRes = await fetch('/api/numbers');
        const nums = await nRes.json();
        if(nums.length) { setMyNumbers(nums); setSelectedCallerId(nums[0].phoneNumber); }

        const tRes = await fetch('/api/token', { method: 'POST' });
        const { token } = await tRes.json();

        const dev = new Device(token, { codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU] });
        dev.register();
        setDevice(dev);
      } catch (e) { console.error("Setup error", e); }
    };
    setup();
    return () => { if (device) device.destroy(); };
  }, []);

  // --- TIMER ---
  useEffect(() => {
    if (callStatus === 'connected') timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    else { if(timerRef.current) clearInterval(timerRef.current); setDuration(0); }
    return () => { if(timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // --- ACTIONS ---
  const makeCall = async (numberOverride?: string) => {
    const dest = numberOverride || inputValue;
    if (!device || !dest || !selectedCallerId) return;
    try {
      setCallStatus('connecting');
      const call = await device.connect({ params: { To: dest, callerId: selectedCallerId } });
      call.on('accept', () => { setCallStatus('connected'); setCurrentCall(call); });
      call.on('disconnect', () => { 
          setCallStatus('idle'); 
          setCurrentCall(null); 
          setIsMuted(false); 
          setShowDialpad(false); 
      });
      call.on('error', () => setCallStatus('idle'));
    } catch (e) { setCallStatus('idle'); }
  };

  const hangUp = () => currentCall?.disconnect();
  
  const toggleMute = () => { 
    if(currentCall) { 
        const newState = !isMuted;
        currentCall.mute(newState); 
        setIsMuted(newState); 
    }
  };

  const sendDigit = (d: string) => { 
      currentCall?.sendDigits(d); 
  };

  const handleSaveContact = () => {
      if(contactName && contactNumber) {
          saveContact(contactName, contactNumber);
          setContactName('');
          setContactNumber('');
      }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // --- SAFE BUTTON COMPONENT (Fixes Ghost Clicks) ---
  const SafeButton = ({ onClick, children, className, style }: any) => {
    const pressedRef = useRef(false);

    const onDown = () => { pressedRef.current = true; };
    const onUp = (e: any) => {
        if (pressedRef.current) {
            e.preventDefault(); 
            onClick();
        }
        pressedRef.current = false;
    };
    const onLeave = () => { pressedRef.current = false; };

    return (
        <button
            onMouseDown={onDown}
            onMouseUp={onUp}
            onMouseLeave={onLeave}
            onTouchStart={onDown}
            onTouchEnd={onUp}
            className={className}
            style={style}
        >
            {children}
        </button>
    );
  };

  // --- RENDER ---
  return (
    <div className="container-app">
        <div className="header">
            <h1>Phone</h1>
        </div>

        {/* --- LOADING STATE --- */}
        {!device && (
            <div className="card">
                <div style={{textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.6)'}}>
                    Loading your phone numbers...
                </div>
            </div>
        )}

        {/* --- MAIN DIALER (Visible when Idle) --- */}
        {device && callStatus === 'idle' && (
            <div className="animate-in fade-in">
                
                {/* Dialer Card */}
                <div className="card">
                    <div className="section-title">From</div>
                    <select value={selectedCallerId} onChange={(e) => setSelectedCallerId(e.target.value)}>
                        {myNumbers.map(n => (
                            <option key={n.phoneNumber} value={n.phoneNumber}>
                                {n.friendlyName}
                            </option>
                        ))}
                    </select>

                    <div className="section-title" style={{marginTop: '20px'}}>To</div>
                    <input 
                        type="tel" 
                        placeholder="Phone number" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />

                    <SafeButton className="btn btn-primary" onClick={() => makeCall()}>
                        Call
                    </SafeButton>
                </div>

                {/* Save Contact Card */}
                <div className="card">
                    <div className="section-title">Save Contact</div>
                    <input 
                        type="text" 
                        placeholder="Name" 
                        value={contactName} 
                        onChange={(e) => setContactName(e.target.value)}
                    />
                    <input 
                        type="tel" 
                        placeholder="Phone number" 
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                    />
                    <SafeButton className="btn btn-secondary" onClick={handleSaveContact}>
                        Save
                    </SafeButton>
                </div>

                {/* Contacts List Card */}
                {contacts.length > 0 && (
                    <div className="card contacts-section">
                        <div className="section-title">Contacts</div>
                        <div>
                            {contacts.map((contact) => (
                                <div key={contact.id} className="contact-item">
                                    <div style={{flex: 1}}>
                                        <div className="contact-name">{contact.name}</div>
                                        <div className="contact-number">{contact.number}</div>
                                    </div>
                                    <div className="contact-actions" style={{display: 'flex', gap: '8px'}}>
                                        <SafeButton className="icon-btn" onClick={() => { setInputValue(contact.number); makeCall(contact.number); }}>
                                            📞
                                        </SafeButton>
                                        <SafeButton className="icon-btn delete" onClick={() => deleteContact(contact.id)}>
                                            🗑
                                        </SafeButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- CALL INTERFACE (Visible when Calling) --- */}
        {callStatus !== 'idle' && (
            <div className="call-interface" style={{display: 'block'}}>
                <div className="card">
                    <div className="call-info">
                        <div className="calling-label">{callStatus === 'connecting' ? 'dialing...' : 'connected'}</div>
                        <div className="call-number">{inputValue}</div>
                        <div className="call-duration">{formatTime(duration)}</div>
                    </div>

                    <div className="call-controls">
                        <SafeButton className={`control-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
                            <div className="control-icon">🔇</div>
                            <div className="control-label">mute</div>
                        </SafeButton>
                        
                        <SafeButton className={`control-btn ${showDialpad ? 'active' : ''}`} onClick={() => setShowDialpad(!showDialpad)}>
                            <div className="control-icon">⊞</div>
                            <div className="control-label">keypad</div>
                        </SafeButton>
                        
                        <SafeButton className="control-btn" onClick={() => alert('Speaker requires browser permission')}>
                            <div className="control-icon">🔊</div>
                            <div className="control-label">speaker</div>
                        </SafeButton>
                    </div>

                    {showDialpad && (
                        <div className="dialpad-grid">
                            {['1','2','3','4','5','6','7','8','9','*','0','#'].map(digit => (
                                <SafeButton key={digit} className="dialpad-btn" onClick={() => sendDigit(digit)}>
                                    {digit}
                                </SafeButton>
                            ))}
                        </div>
                    )}

                    <SafeButton className="end-call-btn" onClick={hangUp}>
                        <div className="end-call-icon">📞</div>
                    </SafeButton>
                </div>
            </div>
        )}

    </div>
  );
}