import { NativeModules } from 'react-native';

export type HashesForItem = [string, string];

interface EteSyncNativeModule {
  hashEvent(eventId: string): Promise<string>;
  calculateHashesForEvents(calendarId: string, from: number, to: number): Promise<HashesForItem[]>;
  hashReminder(eventId: string): Promise<string>;
  calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]>;
  hashContact(contactIdd: string): Promise<string>;
  calculateHashesForContacts(containerId: string): Promise<HashesForItem[]>;
}

const EteSyncNative = NativeModules.EteSyncNative as EteSyncNativeModule;

export function calculateHashesForEvents(calendarId: string, from: Date, to: Date): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForEvents(calendarId, from.getTime() / 1000, to.getTime() / 1000);
}

export const hashEvent = EteSyncNative.hashEvent;

export function calculateHashesForReminders(calendarId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForReminders(calendarId);
}

export const hashReminder = EteSyncNative.hashReminder;

export function calculateHashesForContacts(containerId: string): Promise<HashesForItem[]> {
  return EteSyncNative.calculateHashesForContacts(containerId);
}

export const hashContact = EteSyncNative.hashContact;
