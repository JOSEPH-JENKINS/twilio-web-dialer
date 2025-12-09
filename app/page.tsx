'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, Mic, MicOff, Delete, User, Users, Hash, X, Star, Clock, Settings as SettingsIcon } from 'lucide-react';
import { useContacts } from '@/hooks/useContact';

interface TwilioNumber { friendlyName: string; phoneNumber: string; }

export default function WebDialer() {
  // --- STATE ---
  const [device, setDevice] = useState<Device | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [keypadVisible, setKeypadVisible] = useState(false);
  const [view, setView] = useState<'dialer' | 'contacts' | 'settings'>('dialer');
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');

  const [myNumbers, setMyNumbers] = useState<TwilioNumber[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>('');
  
  const { contacts, saveContact, deleteContact, getContactName } = useContacts();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // --- HANDLERS ---
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
  
  // --- KEYPAD BUTTON WITH LONG PRESS FOR '+' ---
  const KeypadBtn = ({v,s}: {v:string, s?:string}) => {
    const isLongPress = useRef(false);

    const startPress = useCallback(() => {
      isLongPress.current = false;
      if (v === '0') {
        longPressTimerRef.current = setTimeout(() => {
          isLongPress.current = true;
          sendDtmf('+');
        }, 600); // 600ms long press for +
      }
    }, [v]);

    const endPress = useCallback(() => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (!isLongPress.current) {
        sendDtmf(v);
      }
    }, [v]);

    return (
      <button 
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
        onTouchStart={startPress} onTouchEnd={(e) => { e.preventDefault(); endPress(); }}
        className="w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full bg-zinc-100 active:bg-zinc-300 flex flex-col items-center justify-center transition-colors select-none"
      >
        <span className="text-3xl text-black font-normal">{v}</span>
        {s && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{s}</span>}
      </button>
    );
  };

  // --- COMPONENTS ---
  const NavItem = ({icon: Icon, label, active, onClick}: any) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 w-full py-2 ${active ? 'text-blue-500' : 'text-zinc-400'}`}>
      <Icon size={24} className={active ? 'fill-current' : ''} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  const BottomNav = () => (
    <div className="flex border-t border-zinc-200 bg-zinc-50/90 backdrop-blur-lg pb-4 sm:pb-0">
      <NavItem icon={Star} label="Favorites" />
      <NavItem icon={Clock} label="Recents" />
      <NavItem icon={Users} label="Contacts" active={view === 'contacts'} onClick={() => setView('contacts')} />
      <NavItem icon={Hash} label="Keypad" active={view === 'dialer'} onClick={() => setView('dialer')} />
      <NavItem icon={SettingsIcon} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
    </div>
  );

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-zinc-100 text-black flex items-center justify-center font-sans antialiased">
      <div className="w-full max-w-sm h-screen sm:h-[850px] bg-white sm:border border-zinc-200 sm:rounded-[3rem] overflow-hidden relative flex flex-col shadow-xl">
        
        {/* Save Contact Modal */}
        {showSaveModal && (
            <div className="absolute inset-0 bg-black/20 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white p-6 rounded-3xl w-full shadow-2xl scale-in-95">
                    <h3 className="text-xl font-semibold mb-4 text-center">New Contact</h3>
                    <input autoFocus placeholder="Name" className="w-full bg-zinc-100 border-none p-4 rounded-xl mb-4 text-lg focus:ring-2 ring-blue-500 focus:outline-none"
                        value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                    <div className="flex gap-2">
                        <button onClick={() => setShowSaveModal(false)} className="flex-1 p-3 bg-zinc-200 rounded-xl font-medium text-blue-500">Cancel</button>
                        <button onClick={() => { if(newContactName && inputValue) { saveContact(newContactName, inputValue); setShowSaveModal(false); setNewContactName(''); }}} className="flex-1 p-3 bg-blue-500 text-white rounded-xl font-medium">Save</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- ACTIVE CALL SCREEN --- */}
        {callStatus !== 'idle' ? (
          <div className="flex-1 flex flex-col items-center pt-16 pb-12 animate-in slide-in-from-bottom duration-300 bg-zinc-50">
            <div className="w-28 h-28 bg-zinc-200 rounded-full flex items-center justify-center mb-6"><User size={64} className="text-zinc-500" /></div>
            <h2 className="text-3xl font-semibold mb-2">{getContactName(inputValue)}</h2>
            <p className="text-zinc-500 text-xl mb-16">{callStatus === 'connecting' ? 'calling...' : new Date(duration * 1000).toISOString().substr(14, 5)}</p>

            <div className="grid grid-cols-3 gap-8 mb-auto w-full max-w-[280px]">
              <button onClick={toggleMute} className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${isMuted ? 'bg-white border-blue-500 text-blue-500' : 'bg-zinc-100 border-zinc-100 text-black'}`}>{isMuted ? <MicOff size={32}/> : <Mic size={32}/>}</div>
                <span className="text-sm font-medium">mute</span>
              </button>
              <button onClick={() => setKeypadVisible(!keypadVisible)} className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${keypadVisible ? 'bg-white border-blue-500 text-blue-500' : 'bg-zinc-100 border-zinc-100 text-black'}`}><Hash size={32}/></div>
                <span className="text-sm font-medium">keypad</span>
              </button>
              <button className="flex flex-col items-center gap-2 opacity-50"><div className="w-16 h-16 rounded-full flex items-center justify-center bg-zinc-100 text-black"><Users size={32}/></div><span className="text-sm font-medium">add</span></button>
            </div>

            {keypadVisible && <div className="absolute inset-x-0 bottom-32 bg-white/95 backdrop-blur-md p-4 grid grid-cols-3 gap-4 justify-items-center rounded-t-3xl shadow-lg z-10">{['1','2','3','4','5','6','7','8','9','*','0','#'].map(d=><button key={d} onClick={()=>sendDtmf(d)} className="w-full h-14 bg-zinc-100 active:bg-zinc-200 rounded-xl text-2xl font-medium">{d}</button>)}<button onClick={()=>setKeypadVisible(false)} className="col-span-3 py-2 text-blue-500 font-medium">Hide</button></div>}

            <button onClick={handleHangup} className="w-20 h-20 bg-red-500 active:bg-red-600 rounded-full flex items-center justify-center shadow-lg mb-8"><Phone size={40} className="rotate-[135deg] fill-white text-white" /></button>
          </div>
        ) : (
          /* --- MAIN SCREENS --- */
          <div className="flex-1 flex flex-col relative">
            {view === 'contacts' && (
             <div className="flex-1 flex flex-col p-6 animate-in fade-in">
                <h2 className="text-3xl font-bold mb-6">Contacts</h2>
                <div className="space-y-2 overflow-y-auto no-scrollbar">
                    {contacts.length === 0 ? <p className="text-zinc-500 text-center mt-8">No contacts yet.</p> : contacts.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-4 bg-zinc-50 active:bg-zinc-100 rounded-xl transition-colors">
                            <div onClick={() => { setInputValue(c.number); setView('dialer'); handleCall(c.number); }} className="flex-1 cursor-pointer">
                                <div className="font-semibold text-lg">{c.name}</div><div className="text-zinc-500">{c.number}</div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
            )}

            {view === 'settings' && (
                <div className="flex-1 flex flex-col p-6 animate-in fade-in">
                    <h2 className="text-3xl font-bold mb-6">Settings</h2>
                    <div className="bg-zinc-50 p-4 rounded-xl">
                        <label className="block text-sm font-medium text-zinc-500 mb-2">Caller ID (Call From)</label>
                        <select value={selectedCallerId} onChange={(e)=>setSelectedCallerId(e.target.value)} className="w-full bg-white border border-zinc-200 p-3 rounded-lg font-medium">
                            {myNumbers.map(n=><option key={n.phoneNumber} value={n.phoneNumber}>{n.friendlyName} ({n.phoneNumber})</option>)}
                        </select>
                    </div>
                </div>
            )}
            
            {view === 'dialer' && (
             <div className="flex-1 flex flex-col animate-in fade-in">
                {/* Number Display Section */}
                <div className="flex-1 flex flex-col justify-end items-center pb-10 px-4">
                  <div className="h-20 flex items-center justify-center">
                    <input value={inputValue} readOnly className="bg-transparent text-center text-4xl sm:text-5xl font-medium w-full focus:outline-none tracking-tight placeholder:text-zinc-300" placeholder=""/>
                  </div>
                  <button 
                    onClick={() => inputValue && setShowSaveModal(true)} 
                    className={`text-blue-500 text-base font-medium h-8 transition-opacity ${!inputValue || getContactName(inputValue) !== inputValue ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                  >
                    Add Number
                  </button>
                  {inputValue && getContactName(inputValue) !== inputValue && <div className="text-zinc-500 text-sm font-medium h-8">{getContactName(inputValue)}</div>}
                </div>

                {/* Keypad */}
                <div className="px-12 pb-8">
                    <div className="grid grid-cols-3 gap-x-6 gap-y-5 justify-items-center max-w-[300px] mx-auto">
                    <KeypadBtn v="1"/><KeypadBtn v="2" s="ABC"/><KeypadBtn v="3" s="DEF"/>
                    <KeypadBtn v="4" s="GHI"/><KeypadBtn v="5" s="JKL"/><KeypadBtn v="6" s="MNO"/>
                    <KeypadBtn v="7" s="PQRS"/><KeypadBtn v="8" s="TUV"/><KeypadBtn v="9" s="WXYZ"/>
                    <KeypadBtn v="*"/><KeypadBtn v="0" s="+" /><KeypadBtn v="#"/>
                    </div>
                </div>

                {/* Call Actions */}
                <div className="pb-8 px-16 flex items-center justify-center gap-8 relative">
                  <div className="w-12"></div> {/* Spacer */}
                  <button onClick={()=>handleCall()} disabled={!device||!inputValue} className="w-20 h-20 bg-green-500 active:bg-green-600 rounded-full flex items-center justify-center transition-colors shadow-md disabled:opacity-50">
                    <Phone size={40} className="fill-white text-white" />
                  </button>
                  <button onClick={()=>setInputValue(p=>p.slice(0,-1))} onLongPress={()=>setInputValue('')} className={`w-12 flex justify-center text-zinc-400 active:text-zinc-600 transition-opacity ${!inputValue && 'opacity-0 pointer-events-none'}`}>
                    <Delete size={32} strokeWidth={2.5} />
                  </button>
                </div>
             </div>
            )}
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}