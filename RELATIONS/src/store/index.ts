import {create} from 'zustand';
import {Contact, RelationEdge, Interaction, CustomDate, Story, TimeViewMode} from '../types';
import {saveContacts, saveEdges, loadContacts, loadEdges} from '../services/storage';

interface AppState {
  contacts: Contact[];
  edges: RelationEdge[];
  currentViewContactId: string | null;
  timeViewMode: TimeViewMode;
  timeTravelDate: string | null;
  futureYears: number;
  isLoading: boolean;
  isHydrated: boolean;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  setCurrentViewContactId: (id: string | null) => void;
  addEdge: (edge: RelationEdge) => void;
  updateEdge: (id: string, updates: Partial<RelationEdge>) => void;
  addInteraction: (contactId: string, interaction: Interaction) => void;
  addCustomDate: (contactId: string, customDate: CustomDate) => void;
  deleteCustomDate: (contactId: string, customDateId: string) => void;
  addStory: (contactId: string, story: Story) => void;
  updateStory: (contactId: string, storyId: string, updates: Partial<Story>) => void;
  deleteStory: (contactId: string, storyId: string) => void;
  setTimeViewMode: (mode: TimeViewMode) => void;
  setTimeTravelDate: (date: string | null) => void;
  setFutureYears: (years: number) => void;
  getContactsAtTime: (date: string) => Contact[];
  updateLastContactDate: (contactId: string) => void;
  getContactsByRelationType: (relationType: string) => Contact[];
  getSortedContacts: (sortBy: 'lastContact' | 'depth' | 'name') => Contact[];
  hydrate: () => Promise<void>;
  persistData: () => Promise<void>;
}

const persistContacts = async (contacts: Contact[]) => {
  try {
    await saveContacts(contacts);
  } catch (error) {
    console.error('Failed to persist contacts:', error);
  }
};

const persistEdges = async (edges: RelationEdge[]) => {
  try {
    await saveEdges(edges);
  } catch (error) {
    console.error('Failed to persist edges:', error);
  }
};

export const useStore = create<AppState>((set, get) => ({
  contacts: [],
  edges: [],
  currentViewContactId: null,
  timeViewMode: 'present',
  timeTravelDate: null,
  futureYears: 1,
  isLoading: true,
  isHydrated: false,

  hydrate: async () => {
    try {
      set({isLoading: true});
      const [loadedContacts, loadedEdges] = await Promise.all([
        loadContacts(),
        loadEdges(),
      ]);
      set({
        contacts: loadedContacts,
        edges: loadedEdges,
        isLoading: false,
        isHydrated: true,
      });
    } catch (error) {
      console.error('Failed to hydrate store:', error);
      set({isLoading: false, isHydrated: true});
    }
  },

  persistData: async () => {
    const {contacts, edges} = get();
    await Promise.all([
      persistContacts(contacts),
      persistEdges(edges),
    ]);
  },

  addContact: (contact) =>
    set((state) => {
      const newContacts = [...state.contacts, contact];
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  updateContact: (id, updates) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === id ? {...c, ...updates, updatedAt: new Date().toISOString()} : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  deleteContact: (id) =>
    set((state) => {
      const newContacts = state.contacts.filter((c) => c.id !== id);
      const newEdges = state.edges.filter((e) => e.from !== id && e.to !== id);
      persistContacts(newContacts);
      persistEdges(newEdges);
      return {
        contacts: newContacts,
        edges: newEdges,
        currentViewContactId:
          state.currentViewContactId === id ? null : state.currentViewContactId,
      };
    }),

  setCurrentViewContactId: (id) =>
    set(() => ({
      currentViewContactId: id,
    })),

  addEdge: (edge) =>
    set((state) => {
      const newEdges = [...state.edges, edge];
      persistEdges(newEdges);
      return {edges: newEdges};
    }),

  updateEdge: (id, updates) =>
    set((state) => {
      const newEdges = state.edges.map((e) =>
        e.id === id ? {...e, ...updates} : e
      );
      persistEdges(newEdges);
      return {edges: newEdges};
    }),

  addInteraction: (contactId, interaction) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              interactionRecords: [...c.interactionRecords, interaction],
              lastContactDate: interaction.date,
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  addCustomDate: (contactId, customDate) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              customDates: [...c.customDates, customDate],
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  deleteCustomDate: (contactId, customDateId) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              customDates: c.customDates.filter((d) => d.id !== customDateId),
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  addStory: (contactId, story) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              stories: [...c.stories, story],
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  updateStory: (contactId, storyId, updates) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              stories: c.stories.map((s) =>
                s.id === storyId ? {...s, ...updates, updatedAt: new Date().toISOString()} : s
              ),
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  deleteStory: (contactId, storyId) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              stories: c.stories.filter((s) => s.id !== storyId),
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  setTimeViewMode: (mode) =>
    set(() => ({
      timeViewMode: mode,
    })),

  setTimeTravelDate: (date) =>
    set(() => ({
      timeTravelDate: date,
    })),

  setFutureYears: (years) =>
    set(() => ({
      futureYears: years,
    })),

  getContactsAtTime: (date) => {
    const {contacts} = get();
    const targetDate = new Date(date);
    return contacts.filter((c) => {
      if (!c.knownDate) return true;
      return new Date(c.knownDate) <= targetDate;
    });
  },

  updateLastContactDate: (contactId) =>
    set((state) => {
      const newContacts = state.contacts.map((c) =>
        c.id === contactId
          ? {
              ...c,
              lastContactDate: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      persistContacts(newContacts);
      return {contacts: newContacts};
    }),

  getContactsByRelationType: (relationType) => {
    const {contacts} = get();
    if (!relationType || relationType === 'all') return contacts;
    return contacts.filter((c) => c.relationType === relationType);
  },

  getSortedContacts: (sortBy) => {
    const {contacts} = get();
    const sorted = [...contacts];
    switch (sortBy) {
      case 'lastContact':
        return sorted.sort((a, b) => {
          const dateA = a.lastContactDate ? new Date(a.lastContactDate).getTime() : 0;
          const dateB = b.lastContactDate ? new Date(b.lastContactDate).getTime() : 0;
          return dateB - dateA;
        });
      case 'depth':
        return sorted.sort((a, b) => b.relationDepth - a.relationDepth);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      default:
        return sorted;
    }
  },
}));