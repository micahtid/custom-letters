import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Attachment, DataStore, Note, PaperStyle, Profile, StoredLetter } from "./types";

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "store.json");

const emptyStore: DataStore = {
  profiles: {},
  notes: {},
  letters: {}
};

function normalizeStore(input: Partial<DataStore> | null | undefined): DataStore {
  const profiles = input?.profiles ?? {};
  const notes = input?.notes ?? {};
  const lettersInput = input?.letters ?? {};

  const letters = Object.fromEntries(
    Object.entries(lettersInput).map(([id, rawLetter]) => {
      const letter = rawLetter as Partial<StoredLetter>;

      return [
        id,
        {
          id,
          noteId: letter.noteId ?? "",
          profileId: letter.profileId ?? "",
          title: letter.title ?? "Shared note",
          message: letter.message ?? "",
          glyphs: letter.glyphs ?? {},
          paperStyle: letter.paperStyle ?? "plain",
          paperColor: letter.paperColor ?? "#ffffff",
          attachments: letter.attachments ?? [],
          createdAt: letter.createdAt ?? new Date().toISOString()
        } satisfies StoredLetter
      ];
    })
  );

  return {
    profiles,
    notes,
    letters
  };
}

async function readStore(): Promise<DataStore> {
  try {
    const file = await readFile(dataFile, "utf8");
    return normalizeStore(JSON.parse(file) as Partial<DataStore>);
  } catch {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(dataFile, JSON.stringify(emptyStore, null, 2), "utf8");
    return emptyStore;
  }
}

async function writeStore(store: DataStore) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function createProfile(): Profile {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    glyphs: {}
  };
}

export async function ensureProfile() {
  const store = await readStore();
  const profile = createProfile();
  store.profiles[profile.id] = profile;
  await writeStore(store);
  return profile;
}

export async function getProfile(id: string) {
  const store = await readStore();
  return store.profiles[id] ?? null;
}

export async function getNotes(profileId: string) {
  const store = await readStore();

  return Object.values(store.notes)
    .filter((note) => note.profileId === profileId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getNote(id: string) {
  const store = await readStore();
  return store.notes[id] ?? null;
}

export async function saveGlyph(
  profileId: string,
  character: string,
  dataUrl: string
) {
  const store = await readStore();
  const profile = store.profiles[profileId];

  if (!profile) {
    throw new Error("Profile not found.");
  }

  profile.glyphs[character] = {
    character,
    dataUrl,
    updatedAt: new Date().toISOString()
  };

  store.profiles[profileId] = profile;
  await writeStore(store);
  return profile;
}

export async function clearGlyphs(profileId: string) {
  const store = await readStore();
  const profile = store.profiles[profileId];

  if (!profile) {
    throw new Error("Profile not found.");
  }

  profile.glyphs = {};
  store.profiles[profileId] = profile;
  await writeStore(store);
  return profile;
}

export async function createNote(profileId: string) {
  const store = await readStore();
  const profile = store.profiles[profileId];

  if (!profile) {
    throw new Error("Profile not found.");
  }

  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID().slice(0, 8),
    profileId,
    title: "Untitled note",
    message: "",
    createdAt: now,
    updatedAt: now,
    lastSharedLetterId: null
  };

  store.notes[note.id] = note;
  await writeStore(store);
  return note;
}

export async function updateNote(
  profileId: string,
  noteId: string,
  updates: Pick<Note, "title" | "message">
) {
  const store = await readStore();
  const note = store.notes[noteId];

  if (!note || note.profileId !== profileId) {
    throw new Error("Note not found.");
  }

  note.title = updates.title.trim() || "Untitled note";
  note.message = updates.message;
  note.updatedAt = new Date().toISOString();
  store.notes[noteId] = note;
  await writeStore(store);
  return note;
}

export async function shareNote(
  profileId: string,
  noteId: string,
  options: { paperStyle?: PaperStyle; paperColor?: string; attachments?: Attachment[] } = {}
) {
  const store = await readStore();
  const profile = store.profiles[profileId];
  const note = store.notes[noteId];

  if (!profile) {
    throw new Error("Profile not found.");
  }

  if (!note || note.profileId !== profileId) {
    throw new Error("Note not found.");
  }

  const letter: StoredLetter = {
    id: crypto.randomUUID().slice(0, 8),
    noteId,
    profileId,
    title: note.title,
    message: note.message,
    glyphs: profile.glyphs,
    paperStyle: options.paperStyle ?? "plain",
    paperColor: options.paperColor ?? "#ffffff",
    attachments: options.attachments ?? [],
    createdAt: new Date().toISOString()
  };

  store.letters[letter.id] = letter;
  note.lastSharedLetterId = letter.id;
  note.updatedAt = new Date().toISOString();
  store.notes[note.id] = note;
  await writeStore(store);
  return { letter, note };
}

export async function getSharedLetter(id: string) {
  const store = await readStore();
  return store.letters[id] ?? null;
}
