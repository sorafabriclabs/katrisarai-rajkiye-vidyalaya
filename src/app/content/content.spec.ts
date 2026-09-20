import { describe, expect, it } from 'vitest';

import { Text } from '../i18n/language';
import { ACADEMICS, STREAMS, SUBJECTS } from './academics.content';
import { DEPARTMENTS, FACULTY, PRINCIPAL } from './faculty.content';
import { ABOUT, FACTS, HERO } from './home.content';
import { FOOTER_COLUMNS, NAV, SITE, SOURCES, STUDENT_DESK, UI } from './site.content';
import { CAMPUS, CONTACT, RESOURCES, STUDENTS } from './students.content';

/** Devanagari, as a range rather than a list. */
const DEVANAGARI = /[ऀ-ॿ]/;

/** A `Text` is the only object with exactly these two string fields. */
function isText(value: unknown): value is Text {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Text).hi === 'string' &&
    typeof (value as Text).en === 'string' &&
    Object.keys(value).length === 2
  );
}

/** Every `Text` anywhere inside a content export, with a path to find it by. */
function texts(value: unknown, path = ''): { path: string; text: Text }[] {
  if (isText(value)) return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, i) => texts(item, `${path}[${i}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      texts(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const ALL = texts({
  SITE,
  NAV,
  UI,
  STUDENT_DESK,
  FOOTER_COLUMNS,
  SOURCES,
  HERO,
  ABOUT,
  FACTS,
  ACADEMICS,
  STREAMS,
  SUBJECTS,
  FACULTY,
  PRINCIPAL,
  DEPARTMENTS,
  STUDENTS,
  RESOURCES,
  CAMPUS,
  CONTACT,
});

/**
 * The copy is the site. It is also the part most likely to be edited by
 * someone adding a sentence in one language and meaning to come back for the
 * other — which the compiler cannot catch, because both halves of a `Text` are
 * strings and an English one in the `hi` slot type-checks perfectly.
 *
 * These are the checks that stand in for that missing type.
 */
describe('content', () => {
  it('finds a great many strings, so the walker is actually walking', () => {
    // A guard on the guard: if `texts()` ever stops recursing — a content file
    // renamed, an export dropped from the list above — every other test here
    // passes vacuously over an empty array.
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('writes both languages, everywhere', () => {
    for (const { path, text } of ALL) {
      expect(text.hi.trim(), `${path}.hi is empty`).not.toBe('');
      expect(text.en.trim(), `${path}.en is empty`).not.toBe('');
    }
  });

  it('writes the Hindi side in Devanagari', () => {
    for (const { path, text } of ALL) {
      // Unless the two are deliberately the same string — a phone number is a
      // phone number in both, and giving it Devanagari digits would make it
      // uncopyable and undiallable.
      if (text.hi === text.en) continue;
      expect(DEVANAGARI.test(text.hi), `${path}.hi is not in Devanagari: ${text.hi}`).toBe(true);
    }
  });

  it('does not leave Devanagari in the English side', () => {
    for (const { path, text } of ALL) {
      if (text.hi === text.en) continue;
      expect(DEVANAGARI.test(text.en), `${path}.en contains Devanagari: ${text.en}`).toBe(false);
    }
  });
});

/**
 * `SUBJECTS` and `DEPARTMENTS` describe the same six things from two
 * directions — what is taught, and who teaches it. They are separate files
 * because they are edited at different times, and `DepartmentKey` is what
 * stops them drifting.
 */
describe('subjects and departments', () => {
  it('cover exactly the same departments, in the same order', () => {
    expect(DEPARTMENTS.map((d) => d.key)).toEqual(SUBJECTS.map((s) => s.key));
  });

  it('agree on what each department is called', () => {
    for (const department of DEPARTMENTS) {
      const subject = SUBJECTS.find((s) => s.key === department.key)!;
      expect(department.name, department.key).toEqual(subject.name);
    }
  });

  it('adds up to the eleven teachers the college profile records', () => {
    // The number is also printed on the faculty page and in that page's
    // description. If a teacher is added here and the sentence is not, this is
    // where it is noticed.
    const total = DEPARTMENTS.reduce((sum, d) => sum + d.members.length, 0);
    expect(total).toBe(11);
    expect(FACULTY.lead.en).toContain('11');
  });

  it('matches the six subjects the landing page claims', () => {
    expect(SUBJECTS).toHaveLength(6);
    expect(FACTS.find((f) => f.label.en === 'Undergraduate subjects')?.figure).toBe('06');
    expect(FACTS.find((f) => f.label.en === 'Teaching faculty')?.figure).toBe('11');
  });
});
