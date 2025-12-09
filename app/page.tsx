'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, Mic, MicOff, Delete, User, Users, Hash, Trash2, ArrowLeft } from 'lucide-react';
import { useContacts } from '@/hooks/useContact';

interface TwilioNumber { friendlyName: string; phoneNumber: string; }

export default function WebDialer() {
  const [device, setDevice] = useState<Device | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [keypadVisible, setKeypadVisible] = useState(false);
  const [view, setView] = useState<'dialer' | 'contacts'>('dialer');
  
  // Save Contact Logic
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');

  const [myNumbers, setMyNumbers] = useState<TwilioNumber[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>('');
  
  const { contacts, saveContact, deleteContact, getContactName } = useContacts();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (callStatus === 'connected') timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    else { if(timerRef.current) clearInterval(timerRef.current); setDuration(0); }
    return () => { if(timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const handleCall = async (overrideNum?: string) => {
    const dest = overrideNum || inputValue;
    if (!device || !dest || !selectedCallerId) return;
    try {
      setCallStatus('connecting');
      const call = await device.connect({ params: { To: dest, callerId: selectedCallerId } });
      call.on('accept', () => { setCallStatus('connected'); setCurrentCall(call); });
      call.on('disconnect', () => { setCallStatus('idle'); setCurrentCall(null); setIsMuted(false); });
      call.on('error', () => setCallStatus('idle'));
    } catch (e) { setCallStatus('idle'); }
  };

  const handleHangup = () => currentCall?.disconnect();
  const toggleMute = () => { if(currentCall) { currentCall.mute(!isMuted); setIsMuted(!isMuted); }};
  const sendDtmf = (d: string) => { setInputValue(p => p+d); currentCall?.sendDigits(d); };
  
  const KeypadBtn = ({v,s}:any) => (
    <button onClick={()=>sendDtmf(v)} className="w-20 h-20 rounded-full bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 flex flex-col items-center justify-center transition-colors">
      <span className="text-3xl font-light">{v}</span>{s && <span className="text-[10px] text-zinc-500 font-bold uppercase">{s}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-sans">
      <div className="w-full max-w-sm h-screen sm:h-[850px] bg-black sm:border border-zinc-800 sm:rounded-[3rem] overflow-hidden relative flex flex-col shadow-2xl">
        
        {/* Top Bar */}
        <div className="h-14 flex justify-between items-center px-6 text-sm text-zinc-400 z-20">
            {callStatus === 'idle' && view === 'contacts' && (
                <button onClick={() => setView('dialer')} className="flex items-center gap-1 text-blue-500"><ArrowLeft size={16} /> Keypad</button>
            )}
             <span className="ml-auto">{selectedCallerId ? 'Line: ' + selectedCallerId.slice(-4) : 'Connecting...'}</span>
        </div>

        {/* Save Contact Modal */}
        {showSaveModal && (
            <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
                <div className="bg-zinc-900 p-6 rounded-3xl w-full border border-zinc-700">
                    <h3 className="text-lg font-medium mb-4">New Contact</h3>
                    <input autoFocus placeholder="Name" className="w-full bg-black border border-zinc-700 p-3 rounded-xl mb-4 focus:outline-none focus:border-blue-500"
                        value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                    <div className="flex gap-2">
                        <button onClick={() => setShowSaveModal(false)} className="flex-1 p-3 bg-zinc-800 rounded-xl">Cancel</button>
                        <button onClick={() => { if(newContactName && inputValue) { saveContact(newContactName, inputValue); setShowSaveModal(false); setNewContactName(''); }}} className="flex-1 p-3 bg-blue-600 rounded-xl">Save</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- ACTIVE CALL --- */}
        {callStatus !== 'idle' ? (
          <div className="flex-1 flex flex-col items-center pt-10 pb-12 animate-in slide-in-from-bottom duration-500 bg-gradient-to-b from-zinc-900 to-black">
            <div className="w-24 h-24 bg-zinc-700 rounded-full flex items-center justify-center mb-6"><User size={48} className="text-zinc-400" /></div>
            <h2 className="text-3xl font-medium mb-2">{getContactName(inputValue)}</h2>
            <p className="text-zinc-500 text-lg mb-12">{callStatus === 'connecting' ? 'Calling...' : new Date(duration * 1000).toISOString().substr(14, 5)}</p>

            <div className="grid grid-cols-3 gap-6 mb-auto w-full px-8">
              <button onClick={toggleMute} className="flex flex-col items-center gap-2"><div className={`w-16 h-16 rounded-full flex items-center justify-center ${isMuted ? 'bg-white text-black' : 'bg-zinc-800 text-white'}`}>{isMuted ? <MicOff size={28}/> : <Mic size={28}/>}</div><span className="text-xs">Mute</span></button>
              <button onClick={() => setKeypadVisible(!keypadVisible)} className="flex flex-col items-center gap-2"><div className={`w-16 h-16 rounded-full flex items-center justify-center bg-zinc-800 ${keypadVisible ? 'bg-white text-black' : 'text-white'}`}><Hash size={28}/></div><span className="text-xs">Keypad</span></button>
            </div>

            {keypadVisible && <div className="absolute inset-x-0 bottom-32 bg-zinc-900/95 p-4 grid grid-cols-3 gap-4 justify-items-center rounded-t-3xl border-t border-zinc-700">{['1','2','3','4','5','6','7','8','9','*','0','#'].map(d=><button key={d} onClick={()=>sendDtmf(d)} className="w-14 h-10 bg-zinc-800 rounded text-xl">{d}</button>)}</div>}

            <button onClick={handleHangup} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg shadow-red-900/40"><Phone size={36} className="rotate-[135deg] fill-current" /></button>
          </div>
        ) : (
          /* --- DIALER / CONTACTS --- */
          view === 'contacts' ? (
             <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-right duration-300">
                <h2 className="text-3xl font-bold mb-6">Contacts</h2>
                <div className="space-y-2 overflow-y-auto">
                    {contacts.map(c => (
                        <div key={c.id} className="flex justify-between p-4 bg-zinc-900/50 rounded-2xl hover:bg-zinc-900 group">
                            <div onClick={() => { setInputValue(c.number); setView('dialer'); handleCall(c.number); }} className="flex-1 cursor-pointer">
                                <div className="font-medium text-lg">{c.name}</div><div className="text-zinc-500 text-sm">{c.number}</div>
                            </div>
                            <button onClick={() => deleteContact(c.id)} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                    ))}
                </div>
             </div>
          ) : (
             <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-left duration-300">
                <div className="flex-1 flex flex-col justify-end items-center pb-6 px-4">
                  {inputValue && <button onClick={() => setShowSaveModal(true)} className="mb-4 text-blue-500 text-sm font-medium">Add Number</button>}
                  <input value={inputValue} readOnly className="bg-transparent text-center text-4xl font-light w-full focus:outline-none mb-2"/>
                  {inputValue && getContactName(inputValue) !== inputValue && <div className="text-zinc-500 text-sm mb-2">{getContactName(inputValue)}</div>}
                  <button onClick={()=>setInputValue(p=>p.slice(0,-1))} className={`text-zinc-500 ${!inputValue && 'opacity-0'}`}><Delete size={24}/></button>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-4 px-10 pb-8 justify-items-center">
                  <KeypadBtn v="1"/><KeypadBtn v="2" s="ABC"/><KeypadBtn v="3" s="DEF"/><KeypadBtn v="4" s="GHI"/><KeypadBtn v="5" s="JKL"/><KeypadBtn v="6" s="MNO"/><KeypadBtn v="7" s="PQRS"/><KeypadBtn v="8" s="TUV"/><KeypadBtn v="9" s="WXYZ"/><KeypadBtn v="*"/><KeypadBtn v="0" s="+"/><KeypadBtn v="#" />
                </div>

                <div className="pb-12 px-12 flex items-center justify-between">
                  <div className="relative group w-12 flex flex-col items-center">
                     <select value={selectedCallerId} onChange={(e)=>setSelectedCallerId(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer z-10">{myNumbers.map(n=><option key={n.phoneNumber} value={n.phoneNumber}>{n.friendlyName}</option>)}</select>
                     <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center mb-1"><User size={22} className="text-zinc-400"/></div>
                     <span className="text-[10px] text-zinc-500">From</span>
                  </div>
                  <button onClick={()=>handleCall()} disabled={!device||!inputValue} className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-400 transition-colors disabled:opacity-50"><Phone size={36} className="fill-current" /></button>
                  <button onClick={()=>setView('contacts')} className="flex flex-col items-center gap-1 w-12"><div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center"><Users size={22} className="text-zinc-400"/></div><span className="text-[10px] text-zinc-500">Contacts</span></button>
                </div>
             </div>
          )
        )}
      </div>
    </div>
  );
}