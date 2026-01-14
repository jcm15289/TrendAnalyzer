export type KeywordList = {
  id: string;
  name: string;
  description?: string;
  keywords: string[][];  // Array of keyword sets
  color?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const DEFAULT_LISTS: KeywordList[] = [
  {
    id: 'all',
    name: 'All Keywords',
    description: 'All keywords in the system',
    keywords: [],
    color: '#6B7280',
    icon: 'list',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'politics',
    name: 'Politics',
    description: 'Political trends and figures',
    keywords: [
      ['Democrat', 'Republican'],
      ['MAGA'],
      ['Trump'],
      ['anti trump'],
      ['boycott trump'],
      ['hate trump'],
      ['election fraud'],
      ['voter suppression'],
      ['gavin newsom'],
      ['deportation'],
      ['Progressive'],
      ['progressive'],
      ['liberal', 'conservative'],
      ['anti woke']
    ],
    color: '#3B82F6',
    icon: 'landmark',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'media',
    name: 'Media',
    description: 'News and media outlets',
    keywords: [
      ['Cnn'],
      ['cnn'],
      ['Fox News'],
      ['Cuomo']
    ],
    color: '#EF4444',
    icon: 'tv',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'tech',
    name: 'Technology',
    description: 'Tech companies and trends',
    keywords: [],
    color: '#10B981',
    icon: 'cpu',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Financial markets and economy',
    keywords: [
      ['Unemployment'],
      ['unemployment benefits'],
      ['job openings'],
      ['inflation'],
      ['tariffs'],
      ['inequality', 'Inequality']
    ],
    color: '#F59E0B',
    icon: 'trending-up',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'social',
    name: 'Social Issues',
    description: 'Social trends and topics',
    keywords: [
      ['antisemitism'],
      ['boycott usa'],
      ['controversy'],
      ['inmigration lawyer'],
      ['know your rights'],
      ['surrender green card'],
      ['Mamdani']
    ],
    color: '#8B5CF6',
    icon: 'users',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'interesting',
    name: 'Interesting',
    description: 'Interesting trends worth tracking',
    keywords: [],
    color: '#EC4899',
    icon: 'star',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export function getListById(lists: KeywordList[], id: string): KeywordList | undefined {
  return lists.find(list => list.id === id);
}

export function addKeywordToList(
  lists: KeywordList[], 
  listId: string, 
  keywordSet: string[]
): KeywordList[] {
  return lists.map(list => {
    if (list.id === listId) {
      // Check if keyword set already exists in this list
      const exists = list.keywords.some(
        ks => JSON.stringify(ks.slice().sort()) === JSON.stringify(keywordSet.slice().sort())
      );
      
      if (!exists) {
        return {
          ...list,
          keywords: [...list.keywords, keywordSet],
          updatedAt: new Date()
        };
      }
    }
    return list;
  });
}

export function removeKeywordFromList(
  lists: KeywordList[], 
  listId: string, 
  keywordSet: string[]
): KeywordList[] {
  return lists.map(list => {
    if (list.id === listId) {
      return {
        ...list,
        keywords: list.keywords.filter(
          ks => JSON.stringify(ks.slice().sort()) !== JSON.stringify(keywordSet.slice().sort())
        ),
        updatedAt: new Date()
      };
    }
    return list;
  });
}

export function createNewList(name: string, description?: string): KeywordList {
  return {
    id: `list-${Date.now()}`,
    name,
    description,
    keywords: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function deleteList(lists: KeywordList[], listId: string): KeywordList[] {
  // Don't allow deletion of the 'all' list
  if (listId === 'all') {
    return lists;
  }
  return lists.filter(list => list.id !== listId);
}

export function updateList(
  lists: KeywordList[], 
  listId: string, 
  updates: Partial<Omit<KeywordList, 'id' | 'createdAt'>>
): KeywordList[] {
  return lists.map(list => {
    if (list.id === listId) {
      return {
        ...list,
        ...updates,
        updatedAt: new Date()
      };
    }
    return list;
  });
}

// Get all unique keywords from all lists
export function getAllKeywordsFromLists(lists: KeywordList[]): string[][] {
  const allKeywords = new Set<string>();
  
  lists.forEach(list => {
    list.keywords.forEach(keywordSet => {
      allKeywords.add(JSON.stringify(keywordSet.slice().sort()));
    });
  });
  
  return Array.from(allKeywords).map(ks => JSON.parse(ks));
}

// Get keywords for a specific list
export function getKeywordsForList(lists: KeywordList[], listId: string): string[][] {
  if (listId === 'all') {
    return getAllKeywordsFromLists(lists);
  }
  
  const list = getListById(lists, listId);
  return list ? list.keywords : [];
}
