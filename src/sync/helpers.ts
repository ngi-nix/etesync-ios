import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import * as ICAL from 'ical.js';
import * as sjcl from 'sjcl';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { ContactType, EventType } from '../pim-types';

export interface NativeEvent extends Calendar.Event {
  uid: string; // This is the EteSync UUID for the event
}

export interface NativeContact extends Contacts.Contact {
  uid: string; // This is the EteSync UUID for the contact
}

export function entryNativeHashCalc(_entry: {uid: string}, ignoreKeys: string[] = []) {
  const entry = _entry as any;
  const sha = new sjcl.hash.sha256();
  Object.keys(entry).sort().forEach((key) => {
    if (!entry[key] || ignoreKeys.includes(key)) {
      return;
    }
    sha.update(key);
    sha.update(entry[key]);
  });
  return sjcl.codec.hex.fromBits(sha.finalize());
}

function eventAlarmVobjectToNative(alarm: ICAL.Component) {
  const trigger = alarm.getFirstPropertyValue('trigger');

  if (!('isNegative' in trigger)) {
    // FIXME: we only handle relative alarms at the moment (should have isNegative)
    return undefined;
  }

  const relativeOffset =
    ((trigger.isNegative) ? -1 : 1) *
    (
      (((trigger.days * 24) + trigger.hours) * 60) +
      trigger.minutes
    );

  const ret: Calendar.Alarm = {
    relativeOffset,
  };

  return ret;
}

function eventRruleVobjectToNative(event: EventType) {
  const rrule = event.component.getFirstPropertyValue('rrule');
  if (!rrule) {
    return undefined;
  }

  const frequency = (Calendar.Frequency as any)[rrule.freq];
  if (!frequency) {
    return undefined;
  }

  const ret: Calendar.RecurrenceRule = {
    frequency,
    interval: rrule.interval || undefined,
    endDate: rrule.until || undefined,
    occurrence: rrule.count || undefined,
  };

  return ret;
}

export function eventVobjectToNative(event: EventType) {
  const allDay = event.startDate.isDate;
  let endDate = event.endDate.clone();

  if (allDay) {
    endDate.adjust(-1, 0, 0, 0);
    // FIXME: why is it even needed?
    if (event.startDate.compare(endDate) > 0) {
      endDate = event.startDate.clone();
    }
  }

  const ret: NativeEvent = {
    uid: event.uid,
    title: event.title || '',
    allDay,
    startDate: event.startDate.toJSDate(),
    endDate: endDate.toJSDate(),
    location: event.location || '',
    notes: event.description || '',
    alarms: event.component.getAllSubcomponents('valarm').map(eventAlarmVobjectToNative).filter((x) => x) as any,
    recurrenceRule: eventRruleVobjectToNative(event),
    timeZone: event.timezone || '',
  };

  return ret;
}


function fromDate(date: Date, allDay: boolean) {
  const ret = ICAL.Time.fromJSDate(date, false);
  if (!allDay) {
    return ret;
  } else {
    const data = ret.toJSON();
    data.isDate = allDay;
    return ICAL.Time.fromData(data);
  }
}

export function eventNativeToVobject(event: NativeEvent) {
  const startDate = fromDate(new Date(event.startDate), event.allDay);
  const endDate = fromDate(new Date(event.endDate), event.allDay);

  if (event.allDay) {
    endDate.adjust(1, 0, 0, 0);
  }

  const ret = new EventType();
  ret.uid = event.uid;
  ret.summary = event.title || '';
  ret.startDate = startDate;
  ret.endDate = endDate;
  ret.location = event.location || '';
  ret.description = event.notes || '';

  return ret;
}

function contactFieldToNative<T>(contact: ContactType, fieldName: string, mapper: (fieldType: string, value: any) => T) {
  return contact.comp.getAllProperties(fieldName).map((prop) => {
    return mapper(prop.toJSON()[1].type, prop.getFirstValue());
  }).filter((field) => field);
}

export function contactVobjectToNative(contact: ContactType) {
  const phoneNumbers: Contacts.PhoneNumber[] = contactFieldToNative<Contacts.PhoneNumber>(contact, 'tel', (fieldType: string, value: string) => {
    const phoneNumber = parsePhoneNumberFromString(value);
    if (phoneNumber && phoneNumber.isValid()) {
      return {
        id: phoneNumber.formatInternational(),
        number: phoneNumber.formatInternational(),
        digits: phoneNumber.formatNational(),
        countryCode: '+' + phoneNumber.countryCallingCode,
        isPrimary: false,
        label: fieldType,
      };
    } else {
      return undefined;
    }
  });

  const emails: Contacts.Email[] = contactFieldToNative<Contacts.Email>(contact, 'email', (fieldType: string, value: string) => {
    return {
      email: value,
      id: value,
      isPrimary: false,
      label: fieldType,
    };
  });

  const birthdays: Contacts.Date[] = contactFieldToNative<Contacts.Date>(contact, 'bday', (fieldType: string, value: ICAL.Time) => {
    const date = value.toJSDate();
    return {
      id: 'bday',
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      format: Contacts.CalendarFormats.Gregorian,
      label: 'Birthday',
    };
  });

  const notes: string[] = contactFieldToNative<string>(contact, 'note', (fieldType: string, value: string) => {
    return value;
  });

  const titles: string[] = contactFieldToNative<string>(contact, 'note', (fieldType: string, value: string) => {
    return value;
  });
  const jobTitle = titles.length > 0 ? titles[0] : undefined;

  const nickname = contact.comp.getFirstPropertyValue('nickname') || undefined;

  const ret: NativeContact = {
    id: '',
    uid: contact.uid,
    name: contact.fn,
    nickname,
    jobTitle,
    note: notes.length > 0 ? notes.join('\n') : undefined,
    birthday: birthdays.length > 0 ? birthdays[0] : undefined,
    contactType: contact.group ? Contacts.ContactTypes.Company : Contacts.ContactTypes.Person,
    phoneNumbers,
    emails,
  };

  const nField = contact.comp.getFirstProperty('n');
  if (nField) {
    const nFieldParts = nField.getValues()[0];
    ret.lastName = nFieldParts[0];
    ret.firstName = nFieldParts[1];
    ret.middleName = nFieldParts[2];
    ret.namePrefix = nFieldParts[3];
    ret.nameSuffix = nFieldParts[4];
  }

  const orgField = contact.comp.getFirstProperty('org');
  if (orgField) {
    const orgFieldParts = orgField.getValues()[0];
    ret.company = orgFieldParts[0];
    ret.department = `${orgFieldParts[1]} ${orgFieldParts[2]}`;
  }

  return ret;
}
