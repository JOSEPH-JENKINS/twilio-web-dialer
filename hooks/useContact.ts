// hooks/useContacts.ts
import { useState, useEffect } from 'react';

export interface Contact {
  id: string;
  name: string;
  number: string;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Load contacts from browser storage on startup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('my-dialer-contacts');
      if (saved) setContacts(JSON.parse(saved));
    }
  }, []);

  const saveContact = (name: string, number: string) => {
    const newContact = { id: Date.now().toString(), name, number };
    const updated = [...contacts, newContact];
    setContacts(updated);
    localStorage.setItem('my-dialer-contacts', JSON.stringify(updated));
  };

  const deleteContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem('my-dialer-contacts', JSON.stringify(updated));
  };

  const getContactName = (number: string) => {
    const contact = contacts.find(c => c.number === number);
    return contact ? contact.name : number;
  };

  return { contacts, saveContact, deleteContact, getContactName };
}